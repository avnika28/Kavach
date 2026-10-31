import Dexie, { type Table } from 'dexie';

export interface CitationItem {
  chunkId: string;
  documentId: string;
  documentName: string;
  snippet: string;
  score: number;
}

export interface ToolCallRecord {
  id: string;
  toolName:
    | 'create_note'
    | 'add_task'
    | 'complete_task'
    | 'set_reminder'
    | 'search_notes'
    | 'calculate'
    | 'search_documents'
    | 'save_memory';
  args: Record<string, unknown>;
  resultSummary: string;
  status: 'executed' | 'undone' | 'pending_confirmation' | 'cancelled';
  undoPayload?: {
    table: string;
    recordId?: string;
    previousState?: unknown;
  };
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  modelId: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  citations?: CitationItem[];
  toolCall?: ToolCallRecord;
  providerLabel?: string;
}

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface TaskItem {
  id: string;
  title: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
  createdAt: number;
}

export interface ReminderItem {
  id: string;
  title: string;
  remindAt: string;
  dismissed: boolean;
  createdAt: number;
}

export interface KnowledgeDocument {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  status: 'processing' | 'indexed' | 'error';
  useInAnswers: boolean;
  chunkCount: number;
  createdAt: number;
  rawText: string;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  documentName: string;
  content: string;
  chunkIndex: number;
  embedding: number[];
}

export interface MemoryFact {
  id: string;
  fact: string;
  category: 'preference' | 'identity' | 'project' | 'constraint';
  active: boolean;
  createdAt: number;
}

export interface AppSettings {
  id: string; // always 'global'
  selectedModel: string;
  engineMode: 'webgpu' | 'local-instant' | 'ollama';
  providerMode: 'auto' | 'ollama' | 'webllm';
  ollamaBaseUrl: string;
  ollamaModel: string;
  temperature: number;
  topP: number;
  repeatPenalty: number;
  maxTokens: number;
  contextLength: number;
  persona: string;
  theme: 'light' | 'dark';
  onboardingCompleted: boolean;
  simulateOffline: boolean;
}

export const KAVACH_DEFAULT_SYSTEM_PROMPT =
  "You are Kavach, a helpful, accurate assistant. Answer in the user's language (Hindi, Hinglish or English). Give clear, structured, direct answers using short paragraphs or bullets. If you are unsure or the question needs current or real-time facts, say so briefly. Never invent facts. Never reply with raw document text.";

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'global',
  selectedModel: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
  engineMode: 'webgpu',
  providerMode: 'auto',
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: 'qwen2.5:3b',
  temperature: 0.6,
  topP: 0.9,
  repeatPenalty: 1.1,
  maxTokens: 1024,
  contextLength: 4096,
  persona: KAVACH_DEFAULT_SYSTEM_PROMPT,
  theme: 'light',
  onboardingCompleted: false,
  simulateOffline: false,
};

/**
 * Deterministic 384-dimensional local vector embedding generator.
 * Used for instant initial seeding and as an air-gapped fallback when the
 * Transformers.js ONNX model has not yet been cached in IndexedDB.
 */
export function computeDeterministicEmbedding(text: string): number[] {
  const dim = 384;
  const vec = new Float32Array(dim);
  const normalized = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  for (let i = 0; i < normalized.length; i++) {
    const word = normalized[i];
    let hash1 = 2166136261;
    let hash2 = 16777619;
    for (let c = 0; c < word.length; c++) {
      const code = word.charCodeAt(c);
      hash1 = Math.imul(hash1 ^ code, 16777619);
      hash2 = Math.imul(hash2 + code * (c + 1), 1099511628211);
    }
    const idx1 = Math.abs(hash1) % dim;
    const idx2 = Math.abs(hash2) % dim;
    const idx3 = Math.abs(hash1 ^ hash2) % dim;
    vec[idx1] += 1.0;
    vec[idx2] += 0.65;
    vec[idx3] += 0.35;

    // Character 3-grams for fuzzy semantic recall
    for (let g = 0; g + 2 < word.length; g++) {
      const trigram =
        word.charCodeAt(g) * 31 * 31 +
        word.charCodeAt(g + 1) * 31 +
        word.charCodeAt(g + 2);
      const tIdx = Math.abs(trigram) % dim;
      vec[tIdx] += 0.4;
    }
  }

  let norm = 0;
  for (let i = 0; i < dim; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm) || 1;
  const out = new Array<number>(dim);
  for (let i = 0; i < dim; i++) {
    out[i] = Number((vec[i] / norm).toFixed(5));
  }
  return out;
}

class KavachDatabase extends Dexie {
  conversations!: Table<Conversation, string>;
  messages!: Table<ChatMessage, string>;
  notes!: Table<NoteItem, string>;
  tasks!: Table<TaskItem, string>;
  reminders!: Table<ReminderItem, string>;
  documents!: Table<KnowledgeDocument, string>;
  chunks!: Table<DocumentChunk, string>;
  memories!: Table<MemoryFact, string>;
  settings!: Table<AppSettings, string>;

  constructor() {
    super('KavachSovereignVaultDB');
    this.version(1).stores({
      conversations: 'id, updatedAt, createdAt',
      messages: 'id, conversationId, createdAt',
      notes: 'id, updatedAt, createdAt',
      tasks: 'id, completed, priority, createdAt',
      reminders: 'id, remindAt, dismissed, createdAt',
      documents: 'id, status, useInAnswers, createdAt',
      chunks: 'id, documentId, chunkIndex',
      memories: 'id, category, active, createdAt',
      settings: 'id',
    });
  }
}

export const db = new KavachDatabase();

export async function ensureSeedData(): Promise<void> {
  const existingSettings = await db.settings.get('global');
  if (!existingSettings) {
    await db.settings.put(DEFAULT_SETTINGS);
  } else if (
    !existingSettings.providerMode ||
    !existingSettings.ollamaBaseUrl ||
    !existingSettings.ollamaModel ||
    typeof existingSettings.topP !== 'number' ||
    typeof existingSettings.repeatPenalty !== 'number' ||
    typeof existingSettings.contextLength !== 'number'
  ) {
    await db.settings.put({
      ...DEFAULT_SETTINGS,
      ...existingSettings,
      providerMode:
        existingSettings.providerMode ||
        (existingSettings.engineMode === 'ollama' ? 'ollama' : 'auto'),
      ollamaBaseUrl: existingSettings.ollamaBaseUrl || DEFAULT_SETTINGS.ollamaBaseUrl,
      ollamaModel: existingSettings.ollamaModel || DEFAULT_SETTINGS.ollamaModel,
      topP:
        typeof existingSettings.topP === 'number'
          ? existingSettings.topP
          : DEFAULT_SETTINGS.topP,
      repeatPenalty:
        typeof existingSettings.repeatPenalty === 'number'
          ? existingSettings.repeatPenalty
          : DEFAULT_SETTINGS.repeatPenalty,
      contextLength:
        typeof existingSettings.contextLength === 'number'
          ? existingSettings.contextLength
          : DEFAULT_SETTINGS.contextLength,
    });
  }

  const convCount = await db.conversations.count();
  if (convCount === 0) {
    const now = Date.now();
    const convId = 'conv-welcome';
    await db.conversations.put({
      id: convId,
      title: 'Sovereign Workspace Briefing',
      createdAt: now - 3600_000,
      updatedAt: now - 1800_000,
      modelId: DEFAULT_SETTINGS.selectedModel,
    });

    await db.messages.bulkPut([
      {
        id: 'msg-welcome-1',
        conversationId: convId,
        role: 'user',
        content: 'How does Kavach keep my documents, notes, and prompts private?',
        createdAt: now - 3500_000,
      },
      {
        id: 'msg-welcome-2',
        conversationId: convId,
        role: 'assistant',
        content:
          'Kavach runs entirely inside your browser using **WebGPU (`@mlc-ai/web-llm`)** inside a dedicated Web Worker.\n\n- **Zero Cloud Calls**: No prompt, note, task, or uploaded PDF ever leaves this machine.\n- **Local Vector Vault**: Documents are parsed via `pdf.js`, chunked, and embedded locally in IndexedDB (`Dexie`).\n- **Local Tool Execution**: Ask me to `"create a note"`, `"add a task"`, `"set a reminder"`, or `"calculate"` and I will execute it directly against your local database with one-click Undo.',
        createdAt: now - 3490_000,
        citations: [
          {
            chunkId: 'chunk-seed-1',
            documentId: 'doc-seed-architecture',
            documentName: 'Kavach_Sovereign_Architecture.md',
            snippet:
              'All inference tokens are generated on-device via WebGPU shaders. Persistent memory, vector embeddings (384-d), and personal tools reside strictly inside IndexedDB.',
            score: 0.94,
          },
        ],
      },
    ]);
  }

  const noteCount = await db.notes.count();
  if (noteCount === 0) {
    const now = Date.now();
    await db.notes.bulkPut([
      {
        id: 'note-1',
        title: 'Air-Gapped Research Protocol',
        content:
          'Always verify local model weights checksum after initial WebGPU shader compilation. Keep sensitive legal and financial PDFs inside the local Knowledge Base with "Use in answers" enabled only when querying.',
        tags: ['security', 'protocol'],
        createdAt: now - 86400_000 * 2,
        updatedAt: now - 86400_000,
      },
      {
        id: 'note-2',
        title: 'Q4 Product Architecture Decisions',
        content:
          '1. Replace external cloud telemetry with local IndexedDB metrics.\n2. Standardize on Llama-3.2-1B-Instruct q4 for sub-40ms token latency on laptop GPUs.\n3. Use all-MiniLM-L6-v2 in a background worker for RAG.',
        tags: ['architecture', 'llm'],
        createdAt: now - 43200_000,
        updatedAt: now - 21600_000,
      },
    ]);
  }

  const taskCount = await db.tasks.count();
  if (taskCount === 0) {
    const now = Date.now();
    await db.tasks.bulkPut([
      {
        id: 'task-1',
        title: 'Audit local IndexedDB storage quota & export JSON backup',
        completed: false,
        priority: 'high',
        dueDate: 'Today',
        createdAt: now - 7200_000,
      },
      {
        id: 'task-2',
        title: 'Upload Q4 financial briefing PDF into Knowledge Base',
        completed: false,
        priority: 'medium',
        dueDate: 'Tomorrow',
        createdAt: now - 5400_000,
      },
      {
        id: 'task-3',
        title: 'Verify WebGPU shader cache persists across offline reload',
        completed: true,
        priority: 'low',
        dueDate: 'Completed',
        createdAt: now - 86400_000,
      },
    ]);
  }

  const reminderCount = await db.reminders.count();
  if (reminderCount === 0) {
    const now = Date.now();
    await db.reminders.bulkPut([
      {
        id: 'rem-1',
        title: 'Weekly local vault JSON snapshot export',
        remindAt: 'Friday · 17:00 Local',
        dismissed: false,
        createdAt: now - 3600_000,
      },
      {
        id: 'rem-2',
        title: 'Review long-term memory facts in Knowledge Base',
        remindAt: 'Monday · 09:30 Local',
        dismissed: false,
        createdAt: now - 7200_000,
      },
    ]);
  }

  const memCount = await db.memories.count();
  if (memCount === 0) {
    const now = Date.now();
    await db.memories.bulkPut([
      {
        id: 'mem-1',
        fact: 'Prefers concise, direct answers with technical specifics and zero cloud dependencies.',
        category: 'preference',
        active: true,
        createdAt: now - 86400_000,
      },
      {
        id: 'mem-2',
        fact: 'Working on privacy-first local AI workflows and offline-capable web applications.',
        category: 'project',
        active: true,
        createdAt: now - 43200_000,
      },
    ]);
  }

  const docCount = await db.documents.count();
  if (docCount === 0) {
    const now = Date.now();
    const docId = 'doc-seed-architecture';
    const docName = 'Kavach_Sovereign_Architecture.md';
    const sampleChunks = [
      'Kavach Sovereign Architecture Specification: All inference tokens are generated on-device via WebGPU shaders using @mlc-ai/web-llm inside an isolated Web Worker. Persistent memory, vector embeddings (384-d), and personal tools reside strictly inside IndexedDB.',
      'Local Retrieval-Augmented Generation (RAG): Uploaded PDF, Markdown, and TXT documents are split into overlapping semantic chunks and embedded locally with Xenova/all-MiniLM-L6-v2. Cosine similarity runs in-memory over IndexedDB vectors.',
      'Deterministic Local Tool Calling: When the user requests to create a note, add a task, complete a task, set a reminder, search notes, or calculate an expression, Kavach emits a validated JSON action block and provides a one-click Undo snapshot.',
    ];

    await db.documents.put({
      id: docId,
      name: docName,
      size: sampleChunks.join('\n\n').length,
      mimeType: 'text/markdown',
      status: 'indexed',
      useInAnswers: true,
      chunkCount: sampleChunks.length,
      createdAt: now - 86400_000,
      rawText: sampleChunks.join('\n\n'),
    });

    await db.chunks.bulkPut(
      sampleChunks.map((text, idx) => ({
        id: `chunk-seed-${idx + 1}`,
        documentId: docId,
        documentName: docName,
        content: text,
        chunkIndex: idx,
        embedding: computeDeterministicEmbedding(text),
      }))
    );
  }
}

export async function exportVaultAsJson(): Promise<string> {
  const [
    conversations,
    messages,
    notes,
    tasks,
    reminders,
    documents,
    chunks,
    memories,
    settings,
  ] = await Promise.all([
    db.conversations.toArray(),
    db.messages.toArray(),
    db.notes.toArray(),
    db.tasks.toArray(),
    db.reminders.toArray(),
    db.documents.toArray(),
    db.chunks.toArray(),
    db.memories.toArray(),
    db.settings.toArray(),
  ]);

  return JSON.stringify(
    {
      app: 'Kavach Sovereign Vault',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        conversations,
        messages,
        notes,
        tasks,
        reminders,
        documents,
        chunks,
        memories,
        settings,
      },
    },
    null,
    2
  );
}

export async function importVaultFromJson(jsonText: string): Promise<void> {
  const parsed = JSON.parse(jsonText);
  const data = parsed?.data || parsed;
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid Kavach backup JSON structure.');
  }

  await db.transaction(
    'rw',
    [
      db.conversations,
      db.messages,
      db.notes,
      db.tasks,
      db.reminders,
      db.documents,
      db.chunks,
      db.memories,
      db.settings,
    ],
    async () => {
      if (Array.isArray(data.conversations)) {
        await db.conversations.clear();
        await db.conversations.bulkPut(data.conversations);
      }
      if (Array.isArray(data.messages)) {
        await db.messages.clear();
        await db.messages.bulkPut(data.messages);
      }
      if (Array.isArray(data.notes)) {
        await db.notes.clear();
        await db.notes.bulkPut(data.notes);
      }
      if (Array.isArray(data.tasks)) {
        await db.tasks.clear();
        await db.tasks.bulkPut(data.tasks);
      }
      if (Array.isArray(data.reminders)) {
        await db.reminders.clear();
        await db.reminders.bulkPut(data.reminders);
      }
      if (Array.isArray(data.documents)) {
        await db.documents.clear();
        await db.documents.bulkPut(data.documents);
      }
      if (Array.isArray(data.chunks)) {
        await db.chunks.clear();
        await db.chunks.bulkPut(data.chunks);
      }
      if (Array.isArray(data.memories)) {
        await db.memories.clear();
        await db.memories.bulkPut(data.memories);
      }
      if (Array.isArray(data.settings) && data.settings.length > 0) {
        await db.settings.clear();
        await db.settings.bulkPut(data.settings);
      }
    }
  );
}

export async function wipeEntireVault(): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.conversations,
      db.messages,
      db.notes,
      db.tasks,
      db.reminders,
      db.documents,
      db.chunks,
      db.memories,
      db.settings,
    ],
    async () => {
      await Promise.all([
        db.conversations.clear(),
        db.messages.clear(),
        db.notes.clear(),
        db.tasks.clear(),
        db.reminders.clear(),
        db.documents.clear(),
        db.chunks.clear(),
        db.memories.clear(),
        db.settings.clear(),
      ]);
      await db.settings.put(DEFAULT_SETTINGS);
    }
  );
}
