import { db, type ToolCallRecord, type NoteItem, type TaskItem } from '../../store/db';
import { searchKnowledgeBase } from './rag';

export type SupportedToolName = ToolCallRecord['toolName'];

const VALID_TOOLS = new Set<SupportedToolName>([
  'create_note',
  'add_task',
  'complete_task',
  'set_reminder',
  'search_notes',
  'calculate',
  'search_documents',
  'save_memory',
]);

export interface ParsedToolInvocation {
  tool: SupportedToolName;
  args: Record<string, unknown>;
}

/**
 * Repairs common malformed JSON emitted by small 1B/3B local models:
 * - Markdown fences
 * - Trailing commas
 * - Single-quoted strings
 * - Missing final closing braces
 */
export function repairMalformedJson(raw: string): string {
  let cleaned = raw.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  const firstBrace = cleaned.indexOf('{');
  if (firstBrace !== -1) {
    cleaned = cleaned.slice(firstBrace);
  }

  // Remove trailing commas before } or ]
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

  // Balance braces if truncated
  let openBraces = 0;
  for (const ch of cleaned) {
    if (ch === '{') openBraces++;
    if (ch === '}') openBraces--;
  }
  while (openBraces > 0) {
    cleaned += '}';
    openBraces--;
  }

  return cleaned;
}

export function validateAndParseToolJson(rawJsonCandidate: string): ParsedToolInvocation | null {
  try {
    const repaired = repairMalformedJson(rawJsonCandidate);
    const parsed = JSON.parse(repaired);
    if (!parsed || typeof parsed !== 'object') return null;

    const toolName = (parsed.tool || parsed.action || parsed.name) as SupportedToolName;
    if (!VALID_TOOLS.has(toolName)) return null;

    const args =
      parsed.args && typeof parsed.args === 'object'
        ? (parsed.args as Record<string, unknown>)
        : (parsed.parameters as Record<string, unknown>) || parsed;

    return { tool: toolName, args };
  } catch {
    return null;
  }
}

export function extractToolJsonFromText(text: string): {
  cleanResponseText: string;
  invocation: ParsedToolInvocation | null;
} {
  const codeBlockRegex = /```(?:json|tool_call)?\s*(\{[\s\S]*?\})\s*```/i;
  const match = text.match(codeBlockRegex);
  if (match) {
    const inv = validateAndParseToolJson(match[1]);
    if (inv) {
      return {
        cleanResponseText: text.replace(match[0], '').trim(),
        invocation: inv,
      };
    }
  }

  // Also check inline {"tool": "..."} blocks
  const inlineRegex = /(\{\s*"tool"\s*:\s*"[a-z_]+"[\s\S]*?\})/i;
  const inlineMatch = text.match(inlineRegex);
  if (inlineMatch) {
    const inv = validateAndParseToolJson(inlineMatch[1]);
    if (inv) {
      return {
        cleanResponseText: text.replace(inlineMatch[0], '').trim(),
        invocation: inv,
      };
    }
  }

  return { cleanResponseText: text, invocation: null };
}

function safeEvaluateMath(expr: string): string {
  const sanitized = expr.replace(/[^0-9+\-*/().%\s^]/g, '').trim();
  if (!sanitized) return 'Invalid mathematical expression';
  const jsExpr = sanitized.replace(/\^/g, '**');
  // eslint-disable-next-line no-new-func
  const fn = new Function(`"use strict"; return (${jsExpr});`);
  const result = fn();
  if (typeof result === 'number' && Number.isFinite(result)) {
    return Number(result.toFixed(6)).toString();
  }
  return String(result);
}

export async function executeLocalTool(
  invocation: ParsedToolInvocation
): Promise<ToolCallRecord> {
  const id = `tool-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const { tool, args } = invocation;

  switch (tool) {
    case 'create_note': {
      const title = String(args.title || 'Untitled Note').trim();
      const content = String(args.content || args.body || title).trim();
      const tags = Array.isArray(args.tags)
        ? args.tags.map(String)
        : ['agent-note'];
      const noteId = `note-${Date.now()}`;
      const newNote: NoteItem = {
        id: noteId,
        title,
        content,
        tags,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await db.notes.put(newNote);
      return {
        id,
        toolName: 'create_note',
        args: { title, content, tags },
        resultSummary: `Created note "${title}" in local vault.`,
        status: 'executed',
        undoPayload: {
          table: 'notes',
          recordId: noteId,
        },
      };
    }

    case 'add_task': {
      const title = String(args.title || args.task || 'New Task').trim();
      const rawPriority = String(args.priority || 'medium').toLowerCase();
      const priority: TaskItem['priority'] =
        rawPriority === 'high' || rawPriority === 'low' ? rawPriority : 'medium';
      const dueDate = String(args.dueDate || 'Today');
      const taskId = `task-${Date.now()}`;
      await db.tasks.put({
        id: taskId,
        title,
        completed: false,
        priority,
        dueDate,
        createdAt: Date.now(),
      });
      return {
        id,
        toolName: 'add_task',
        args: { title, priority, dueDate },
        resultSummary: `Added task "${title}" (${priority} priority).`,
        status: 'executed',
        undoPayload: {
          table: 'tasks',
          recordId: taskId,
        },
      };
    }

    case 'complete_task': {
      const query = String(args.taskTitleOrId || args.title || args.id || '').toLowerCase();
      const allTasks = await db.tasks.toArray();
      const target =
        allTasks.find((t) => !t.completed && t.title.toLowerCase().includes(query)) ||
        allTasks.find((t) => !t.completed);
      if (!target) {
        return {
          id,
          toolName: 'complete_task',
          args,
          resultSummary: 'No matching incomplete task found.',
          status: 'executed',
        };
      }
      await db.tasks.update(target.id, { completed: true });
      return {
        id,
        toolName: 'complete_task',
        args: { title: target.title },
        resultSummary: `Marked task "${target.title}" as completed.`,
        status: 'executed',
        undoPayload: {
          table: 'tasks_complete',
          recordId: target.id,
          previousState: false,
        },
      };
    }

    case 'set_reminder': {
      const title = String(args.title || args.reminder || 'Reminder').trim();
      const remindAt = String(args.remindAt || args.time || 'Today · 18:00 Local');
      const remId = `rem-${Date.now()}`;
      await db.reminders.put({
        id: remId,
        title,
        remindAt,
        dismissed: false,
        createdAt: Date.now(),
      });
      return {
        id,
        toolName: 'set_reminder',
        args: { title, remindAt },
        resultSummary: `Set reminder "${title}" for ${remindAt}.`,
        status: 'executed',
        undoPayload: {
          table: 'reminders',
          recordId: remId,
        },
      };
    }

    case 'search_notes': {
      const query = String(args.query || '').toLowerCase();
      const notes = await db.notes.toArray();
      const matches = notes.filter(
        (n) =>
          n.title.toLowerCase().includes(query) ||
          n.content.toLowerCase().includes(query) ||
          n.tags.some((t) => t.toLowerCase().includes(query))
      );
      return {
        id,
        toolName: 'search_notes',
        args: { query },
        resultSummary:
          matches.length > 0
            ? `Found ${matches.length} note(s): ${matches.map((m) => `"${m.title}"`).join(', ')}`
            : `No notes matched "${query}".`,
        status: 'executed',
      };
    }

    case 'calculate': {
      const expression = String(args.expression || '');
      try {
        const value = safeEvaluateMath(expression);
        return {
          id,
          toolName: 'calculate',
          args: { expression },
          resultSummary: `${expression} = ${value}`,
          status: 'executed',
        };
      } catch {
        return {
          id,
          toolName: 'calculate',
          args: { expression },
          resultSummary: `Could not evaluate "${expression}".`,
          status: 'executed',
        };
      }
    }

    case 'search_documents': {
      const query = String(args.query || '');
      const citations = await searchKnowledgeBase(query, 3);
      return {
        id,
        toolName: 'search_documents',
        args: { query },
        resultSummary:
          citations.length > 0
            ? `Retrieved ${citations.length} relevant passage(s) from ${citations[0].documentName}.`
            : `No matching indexed document chunks for "${query}".`,
        status: 'executed',
      };
    }

    case 'save_memory': {
      const fact = String(args.fact || '').trim();
      const memId = `mem-${Date.now()}`;
      await db.memories.put({
        id: memId,
        fact,
        category: 'preference',
        active: true,
        createdAt: Date.now(),
      });
      return {
        id,
        toolName: 'save_memory',
        args: { fact },
        resultSummary: `Saved to long-term memory: "${fact}"`,
        status: 'executed',
        undoPayload: {
          table: 'memories',
          recordId: memId,
        },
      };
    }
  }
}

export async function undoToolExecution(toolCall: ToolCallRecord): Promise<string> {
  const payload = toolCall.undoPayload;
  if (!payload || !payload.recordId) {
    return 'Nothing to undo for read-only tool.';
  }

  if (payload.table === 'notes') {
    await db.notes.delete(payload.recordId);
    return 'Removed created note from IndexedDB.';
  }
  if (payload.table === 'tasks') {
    await db.tasks.delete(payload.recordId);
    return 'Removed added task from IndexedDB.';
  }
  if (payload.table === 'tasks_complete') {
    await db.tasks.update(payload.recordId, { completed: false });
    return 'Reverted task completion state.';
  }
  if (payload.table === 'reminders') {
    await db.reminders.delete(payload.recordId);
    return 'Removed reminder from IndexedDB.';
  }
  if (payload.table === 'memories') {
    await db.memories.delete(payload.recordId);
    return 'Removed fact from long-term memory.';
  }

  return 'Action undone.';
}

/**
 * Detects explicit user intent for local tool actions so both small local models
 * and the offline sovereign runtime reliably trigger structured JSON tool calls.
 */
export function detectImplicitToolFromUserPrompt(
  prompt: string
): ParsedToolInvocation | null {
  const trimmed = prompt.trim();
  const lower = trimmed.toLowerCase();

  // 1. Create note
  const noteMatch = trimmed.match(
    /(?:create|save|make|write)\s+(?:a\s+)?note(?:\s+(?:titled|called|about))?\s+["']?([^"'\n.]+)["']?(?:\s*[:\-–]\s*|\s+that\s+says\s+|\s+with\s+content\s+)?(.*)$/i
  );
  if (noteMatch) {
    const title = noteMatch[1].trim();
    const content = (noteMatch[2] || title).trim();
    return {
      tool: 'create_note',
      args: { title, content, tags: ['quick-note'] },
    };
  }

  // 2. Complete task
  const completeMatch = trimmed.match(
    /(?:complete|finish|check\s+off|mark\s+done)\s+(?:the\s+)?task\s+["']?([^"'\n]+)["']?/i
  );
  if (completeMatch) {
    return {
      tool: 'complete_task',
      args: { taskTitleOrId: completeMatch[1].trim() },
    };
  }

  // 3. Add task
  const taskMatch = trimmed.match(
    /(?:add|create|new)\s+(?:a\s+)?(?:(high|medium|low)\s+priority\s+)?task\s+(?:to\s+)?["']?([^"'\n]+)["']?/i
  );
  if (taskMatch) {
    return {
      tool: 'add_task',
      args: {
        priority: (taskMatch[1] || 'medium').toLowerCase(),
        title: taskMatch[2].trim(),
        dueDate: 'Today',
      },
    };
  }

  // 4. Set reminder
  const reminderMatch = trimmed.match(
    /(?:set\s+(?:a\s+)?reminder|remind\s+me)\s+(?:to\s+)?["']?([^"'\n]+?)["']?(?:\s+(?:at|on|in|for)\s+([^"'\n]+))?$/i
  );
  if (reminderMatch) {
    return {
      tool: 'set_reminder',
      args: {
        title: reminderMatch[1].trim(),
        remindAt: (reminderMatch[2] || 'Today · 18:00 Local').trim(),
      },
    };
  }

  // 5. Calculate math
  const calcMatch = trimmed.match(
    /(?:calculate|compute|what\s+is|evaluate)\s+([0-9+\-*/().%\s^]{3,})/i
  );
  if (calcMatch && /[+\-*/%^]/.test(calcMatch[1])) {
    return {
      tool: 'calculate',
      args: { expression: calcMatch[1].trim() },
    };
  }

  // 6. Search notes
  if (lower.startsWith('search notes for ') || lower.startsWith('find notes about ')) {
    const q = trimmed.replace(/^(?:search\s+notes\s+for|find\s+notes\s+about)\s+/i, '').trim();
    return {
      tool: 'search_notes',
      args: { query: q },
    };
  }

  // 7. Remember fact
  const memMatch = trimmed.match(
    /(?:remember\s+that|save\s+to\s+memory(?:\s+that)?)\s+(.+)$/i
  );
  if (memMatch) {
    return {
      tool: 'save_memory',
      args: { fact: memMatch[1].trim() },
    };
  }

  return null;
}
