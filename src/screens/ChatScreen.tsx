import React, { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Send,
  Square,
  RotateCcw,
  Wrench,
  Undo2,
  BookOpen,
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
  CheckCircle2,
  FileText,
  Brain,
} from 'lucide-react';
import {
  db,
  DEFAULT_SETTINGS,
  KAVACH_DEFAULT_SYSTEM_PROMPT,
  type ChatMessage,
  type CitationItem,
  type ToolCallRecord,
} from '../store/db';
import { type ProviderMode } from '../lib/llm/types';
import { providerManager, useProviderManager } from '../lib/llm/providerManager';
import {
  searchKnowledgeBase,
  classifyUserMessageRoute,
  RAG_MAX_CHUNKS,
} from '../lib/llm/rag';
import {
  detectImplicitToolFromUserPrompt,
  executeLocalTool,
  extractToolJsonFromText,
  undoToolExecution,
} from '../lib/llm/toolSchema';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { gsap, prefersReducedMotion } from '../lib/animations';

interface ChatScreenProps {
  conversationId: string;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({ conversationId }) => {
  const settings = useLiveQuery(() => db.settings.get('global')) || DEFAULT_SETTINGS;
  const messages =
    useLiveQuery(
      () =>
        db.messages
          .where('conversationId')
          .equals(conversationId)
          .sortBy('createdAt'),
      [conversationId]
    ) || [];

  const activeDocs =
    useLiveQuery(() =>
      db.documents.filter((d) => d.status === 'indexed' && d.useInAnswers).toArray()
    ) || [];

  const activeMemories =
    useLiveQuery(() => db.memories.filter((m) => m.active).toArray()) || [];

  const [inputPrompt, setInputPrompt] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [contextPanelOpen, setContextPanelOpen] = useState(true);
  const [undoFeedback, setUndoFeedback] = useState<Record<string, string>>({});
  const providerSnap = useProviderManager();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const contextPanelRef = useRef<HTMLAsideElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isStreaming]);

  useEffect(() => {
    if (!lastMessageRef.current || prefersReducedMotion()) return;
    gsap.fromTo(
      lastMessageRef.current,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' }
    );

    const chips = lastMessageRef.current.querySelectorAll('.kavach-tool-chip');
    if (chips.length > 0) {
      gsap.fromTo(
        chips,
        { scale: 0.92, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.5, ease: 'expo.out' }
      );
    }
  }, [messages.length]);

  useEffect(() => {
    if (!contextPanelRef.current) return;
    if (prefersReducedMotion()) {
      contextPanelRef.current.style.width = contextPanelOpen ? '288px' : '0px';
      contextPanelRef.current.style.opacity = contextPanelOpen ? '1' : '0';
      return;
    }
    gsap.to(contextPanelRef.current, {
      width: contextPanelOpen ? 288 : 0,
      opacity: contextPanelOpen ? 1 : 0,
      duration: 0.55,
      ease: 'power3.out',
    });
  }, [contextPanelOpen]);

  const handleSwitchProviderMode = async (mode: ProviderMode) => {
    await db.settings.put({
      ...settings,
      providerMode: mode,
      engineMode: mode === 'ollama' ? 'ollama' : 'webgpu',
    });
  };

  const runGenerationForUserPrompt = async (userText: string) => {
    setIsStreaming(true);
    setStreamingContent('');

    try {
      const implicitTool = detectImplicitToolFromUserPrompt(userText);
      const route = await classifyUserMessageRoute(userText, Boolean(implicitTool));

      let executedTool: ToolCallRecord | undefined;
      if (route === 'tool' && implicitTool) {
        executedTool = await executeLocalTool(implicitTool);
      }

      // Only run RAG when routed to 'rag'; searchKnowledgeBase enforces cosine >= 0.45 and max 3 chunks
      const citations: CitationItem[] =
        route === 'rag' ? await searchKnowledgeBase(userText, RAG_MAX_CHUNKS) : [];

      const honestFallbackPrompt =
        'You run fully offline with a small model and no internet. If the question needs current or real-time facts (news, who currently holds a position, prices, weather, dates) or you are not sure, say you are not certain, give your best known answer, and mention it may be outdated. Never invent facts. Never answer using unrelated documents.';

      const memorySection =
        activeMemories.length > 0
          ? `\nUser Long-Term Memory Facts:\n${activeMemories.map((m) => `- ${m.fact}`).join('\n')}`
          : '';

      const ragSection =
        citations.length > 0
          ? `\nWrite the answer in your own words using these document chunks as context (never print raw chunk text verbatim):\n[INDEXED_DOCUMENT_CONTEXT]\n${citations
              .map((c) => `Source (${c.documentName}): ${c.snippet}`)
              .join('\n')}\n[/INDEXED_DOCUMENT_CONTEXT]`
          : '';

      const basePersona = settings.persona || KAVACH_DEFAULT_SYSTEM_PROMPT;
      const systemPrompt = `${basePersona}\n${KAVACH_DEFAULT_SYSTEM_PROMPT}\n${honestFallbackPrompt}${memorySection}${ragSection}\nIf you need to invoke a local tool, output a JSON block with {"tool": "create_note" | "add_task" | "complete_task" | "set_reminder" | "calculate" | "search_notes" | "search_documents", "args": {...}}.`;

      // Keep the last 10 messages as context, trimmed to fit contextLength
      const maxContextChars = Math.max(2048, (settings.contextLength ?? 4096) * 3);
      let usedChars = systemPrompt.length + userText.length;
      const recentSlice = messages.slice(-10);
      const trimmedRecent: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
      for (let i = recentSlice.length - 1; i >= 0; i--) {
        const m = recentSlice[i];
        const msgContent =
          m.content.length > 1600 ? `${m.content.slice(0, 1600)}...` : m.content;
        if (usedChars + msgContent.length > maxContextChars) break;
        usedChars += msgContent.length;
        trimmedRecent.unshift({ role: m.role, content: msgContent });
      }
      const historyContext = trimmedRecent;

      const needsModelToolJson = route === 'tool' && !executedTool;

      const streamResult = await providerManager.generateStream(
        {
          messages: [
            { role: 'system', content: systemPrompt },
            ...historyContext,
            { role: 'user', content: userText },
          ],
          temperature: settings.temperature ?? 0.6,
          topP: settings.topP ?? 0.9,
          repeatPenalty: settings.repeatPenalty ?? 1.1,
          contextLength: settings.contextLength ?? 4096,
          maxTokens: settings.maxTokens ?? 1024,
          formatJson: needsModelToolJson,
          onToken: (_delta, fullText) => {
            setStreamingContent(fullText);
          },
        },
        settings
      );

      let rawOutput = streamResult.text;
      let { cleanResponseText, invocation } = extractToolJsonFromText(rawOutput);

      // Retry/repair logic when a tool action was requested from Ollama/LLM but JSON validation failed
      if (needsModelToolJson && !invocation && streamResult.usedBackend === 'ollama') {
        try {
          const repairResult = await providerManager.generateStream(
            {
              messages: [
                {
                  role: 'system',
                  content:
                    'Return ONLY a valid JSON object matching {"tool": "create_note" | "add_task" | "complete_task" | "set_reminder" | "calculate" | "search_notes" | "search_documents", "args": {...}}.',
                },
                { role: 'user', content: userText },
              ],
              temperature: 0.2,
              maxTokens: 256,
              formatJson: true,
              onToken: () => {},
            },
            settings
          );
          const repaired = extractToolJsonFromText(repairResult.text);
          if (repaired.invocation) {
            invocation = repaired.invocation;
            if (!cleanResponseText) {
              cleanResponseText = repaired.cleanResponseText;
            }
          }
        } catch {
          // Keep initial response if repair attempt fails
        }
      }

      if (invocation && !executedTool) {
        executedTool = await executeLocalTool(invocation);
      }

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-ai`,
        conversationId,
        role: 'assistant',
        content: cleanResponseText || rawOutput || 'Action completed on device.',
        createdAt: Date.now(),
        citations: citations.length > 0 && !executedTool ? citations : undefined,
        toolCall: executedTool,
        providerLabel: streamResult.providerLabel,
      };

      await db.messages.put(assistantMessage);
      await db.conversations.update(conversationId, {
        updatedAt: Date.now(),
      });
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputPrompt.trim();
    if (!trimmed || isStreaming) return;

    setInputPrompt('');

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      conversationId,
      role: 'user',
      content: trimmed,
      createdAt: Date.now(),
    };

    await db.messages.put(userMsg);

    const currentConv = await db.conversations.get(conversationId);
    if (currentConv && currentConv.title === 'New Sovereign Thread') {
      await db.conversations.update(conversationId, {
        title: trimmed.slice(0, 42),
        updatedAt: Date.now(),
      });
    }

    await runGenerationForUserPrompt(trimmed);
  };

  const handleStop = () => {
    providerManager.abortActiveGeneration();
    setIsStreaming(false);
  };

  const handleRegenerate = async () => {
    if (isStreaming || messages.length === 0) return;
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMessage) return;

    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === 'assistant') {
      await db.messages.delete(lastMsg.id);
    }

    await runGenerationForUserPrompt(lastUserMessage.content);
  };

  const handleUndoTool = async (msg: ChatMessage) => {
    if (!msg.toolCall || msg.toolCall.status === 'undone') return;
    const summary = await undoToolExecution(msg.toolCall);
    const updatedTool: ToolCallRecord = {
      ...msg.toolCall,
      status: 'undone',
    };
    await db.messages.update(msg.id, { toolCall: updatedTool });
    setUndoFeedback((prev) => ({ ...prev, [msg.id]: summary }));
  };

  const quickPrompts = [
    'Create a note titled "Edge Shader Audit" that says Verify FP16 matrix multiplication latency.',
    'Add a high priority task to review the Q4 offline vector index',
    'Set a reminder to export the JSON vault backup at Friday 18:00',
    'Calculate (1024 * 38.5) / 16',
    'How does Kavach handle RAG and vector embeddings offline?',
  ];

  return (
    <div className="flex-1 flex min-h-[calc(100vh-58px)] overflow-hidden">
      {/* Main Chat Column (Calmer Mode: generous whitespace, WCAG AA contrast) */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Sub-header Toolbar */}
        <div className="px-6 py-2.5 border-b kavach-divider flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 truncate">
            <span className="font-mono uppercase tracking-[0.16em] text-[11px] opacity-75">
              04 // AGENT THREAD
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-[11px] opacity-85 truncate">
              {settings.selectedModel}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {messages.some((m) => m.role === 'user') && !isStreaming && (
              <button
                type="button"
                onClick={handleRegenerate}
                className="px-3 py-1 rounded-full border kavach-divider hover:bg-[var(--bg-card)] flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                title="Regenerate last response"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Regenerate</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setContextPanelOpen((v) => !v)}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full border kavach-divider hover:bg-[var(--bg-card)] text-xs font-medium cursor-pointer"
              title="Toggle Local Context & RAG Inspector"
            >
              {contextPanelOpen ? (
                <PanelRightClose className="w-3.5 h-3.5" />
              ) : (
                <PanelRightOpen className="w-3.5 h-3.5" />
              )}
              <span>Sources &amp; Context</span>
            </button>
          </div>
        </div>

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-10 py-8 space-y-7 max-w-4xl w-full mx-auto">
          {messages.map((msg, idx) => {
            const isLast = idx === messages.length - 1;
            const isUser = msg.role === 'user';

            return (
              <div
                key={msg.id}
                ref={isLast ? lastMessageRef : undefined}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div className="mb-1.5 px-1 flex items-center gap-2 text-[11px] font-mono tracking-[0.08em] opacity-70">
                  <span>
                    {isUser
                      ? 'OPERATOR'
                      : msg.providerLabel ||
                        providerManager.formatAgentLabel(
                          providerManager.resolveActiveBackend(
                            settings.providerMode || 'auto'
                          ),
                          settings.ollamaModel
                        )}
                  </span>
                  <span>·</span>
                  <span>
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {/* Agent messages on secondary-color cards (.kavach-card), User messages in accent color (.kavach-user-bubble) */}
                <div
                  className={
                    isUser
                      ? 'kavach-user-bubble px-5 py-3.5 max-w-[85%] sm:max-w-[75%] shadow-xs'
                      : 'kavach-card p-6 max-w-[92%] sm:max-w-[85%] w-full space-y-4'
                  }
                >
                  <MarkdownRenderer content={msg.content} isUserBubble={isUser} />

                  {/* Tool Chip with Undo */}
                  {msg.toolCall && (
                    <div className="kavach-tool-chip mt-3 pt-3 border-t kavach-divider flex flex-wrap items-center justify-between gap-3 bg-[var(--bg-page)] px-4 py-3 rounded-xl">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Wrench className="w-4 h-4 kavach-accent-text shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-xs font-mono font-semibold">
                            <span>{msg.toolCall.toolName}</span>
                            <span className="text-[10px] opacity-70">
                              {msg.toolCall.status === 'undone'
                                ? '(Reverted)'
                                : '(Executed Locally)'}
                            </span>
                          </div>
                          <p className="text-xs opacity-85 truncate">
                            {undoFeedback[msg.id] || msg.toolCall.resultSummary}
                          </p>
                        </div>
                      </div>

                      {msg.toolCall.undoPayload && msg.toolCall.status !== 'undone' && (
                        <button
                          type="button"
                          onClick={() => handleUndoTool(msg)}
                          className="px-3.5 py-1 rounded-full kavach-btn-accent text-xs font-medium flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          <Undo2 className="w-3 h-3" />
                          <span>Undo</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* RAG Source Citations */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="pt-3 border-t kavach-divider space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider font-semibold">
                        <BookOpen className="w-3.5 h-3.5 kavach-accent-text" />
                        <span>Indexed Vault Citations ({msg.citations.length})</span>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {msg.citations.map((cit) => (
                          <div
                            key={cit.chunkId}
                            className="p-3 rounded-xl bg-[var(--bg-page)] border kavach-divider text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between font-mono text-[11px]">
                              <span className="font-semibold truncate">{cit.documentName}</span>
                              <span>Cosine Score: {cit.score}</span>
                            </div>
                            <p className="text-[11px] opacity-80 line-clamp-2">{cit.snippet}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Source Attribution & Provider Label under Agent Message */}
                  {!isUser && (
                    <div className="pt-2 border-t kavach-divider flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono opacity-75">
                      <span>
                        {msg.providerLabel ||
                          providerManager.formatAgentLabel(
                            providerManager.resolveActiveBackend(
                              settings.providerMode || 'auto'
                            ),
                            settings.ollamaModel
                          )}
                      </span>
                      {!msg.toolCall && (
                        <span>
                          {msg.citations && msg.citations.length > 0
                            ? 'Answered from your documents'
                            : 'Answered from model knowledge (offline, may be outdated)'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isStreaming && (
            <div className="flex flex-col items-start">
              <div className="mb-1.5 px-1 flex items-center gap-2 text-xs font-mono uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 kavach-accent-text" />
                <span>Kavach · Streaming On-Device Tokens...</span>
              </div>
              <div className="kavach-card p-6 max-w-[92%] sm:max-w-[85%] w-full">
                <MarkdownRenderer content={streamingContent || 'Synthesizing on device...'} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompt Starters */}
        <div className="max-w-4xl w-full mx-auto px-4 sm:px-10 pb-2">
          <div className="flex items-center gap-2 overflow-x-auto pb-1.5 no-scrollbar">
            {quickPrompts.map((qp, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setInputPrompt(qp)}
                className="px-3.5 py-1.5 rounded-full border kavach-divider bg-[var(--bg-card)] text-xs whitespace-nowrap hover:border-[var(--accent-primary)] transition-colors cursor-pointer shrink-0"
              >
                {qp.length > 48 ? `${qp.slice(0, 48)}...` : qp}
              </button>
            ))}
          </div>
        </div>

        {/* Input Composer */}
        <form
          onSubmit={handleSend}
          className="max-w-4xl w-full mx-auto px-4 sm:px-10 pb-6 pt-1"
        >
          <div className="kavach-card p-2.5 space-y-2">
            <div className="flex items-end gap-2">
              <textarea
                rows={2}
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask anything offline, query indexed PDFs, or say 'Create a note...', 'Add a task...', 'Calculate...' (Enter to send)"
                className="flex-1 bg-transparent px-3 py-1.5 text-sm focus:outline-none resize-none"
              />

              {isStreaming ? (
                <button
                  type="button"
                  onClick={handleStop}
                  className="px-5 py-2.5 rounded-full kavach-btn-accent text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!inputPrompt.trim()}
                  className="px-6 py-2.5 rounded-full kavach-btn-accent disabled:opacity-40 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <span>Send</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Small Provider Mode Switch in Chat Composer */}
            <div className="px-3 pt-1.5 border-t kavach-divider flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="opacity-70">Backend:</span>
                {(
                  [
                    { id: 'auto', label: 'Auto' },
                    { id: 'ollama', label: 'Ollama (Local server)' },
                    { id: 'webllm', label: 'Browser (WebLLM)' },
                  ] as const
                ).map((opt) => {
                  const active = (settings.providerMode || 'auto') === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSwitchProviderMode(opt.id)}
                      className={`px-2.5 py-0.5 rounded-full border kavach-divider transition-colors cursor-pointer ${
                        active
                          ? 'kavach-btn-accent font-semibold'
                          : 'bg-[var(--bg-page)] opacity-75 hover:opacity-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5 opacity-80">
                <span className="kavach-accent-text">●</span>
                <span>
                  {providerManager.resolveActiveBackend(
                    settings.providerMode || 'auto'
                  ) === 'ollama'
                    ? `Ollama · ${settings.ollamaModel || 'qwen2.5:3b'}`
                    : 'WebLLM · On-device'}
                </span>
                {providerSnap.health.running && (
                  <span className="opacity-65 hidden sm:inline">
                    (localhost:11434 ready)
                  </span>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Collapsible Source & Context Panel */}
      <aside
        ref={contextPanelRef}
        className="hidden lg:block shrink-0 border-l kavach-divider overflow-hidden"
        style={{ width: 288 }}
      >
        <div className="w-[288px] p-5 space-y-6 text-xs">
          <div className="pb-3 border-b kavach-divider">
            <h3 className="text-xl font-poster tracking-wide">
              ACTIVE VAULT CONTEXT
            </h3>
            <p className="font-mono text-[11px] uppercase tracking-wider opacity-75">
              Injected locally into prompt
            </p>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between font-semibold">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 kavach-accent-text" />
                <span>RAG Documents ({activeDocs.length})</span>
              </span>
              <span className="font-mono text-[11px] opacity-70">Cosine Top-2</span>
            </div>
            {activeDocs.map((doc) => (
              <div
                key={doc.id}
                className="p-2.5 rounded-xl border kavach-divider bg-[var(--bg-card)] flex items-center justify-between gap-2"
              >
                <span className="truncate font-medium">{doc.name}</span>
                <span className="font-mono text-[10px] opacity-75 shrink-0">
                  {doc.chunkCount} chunks
                </span>
              </div>
            ))}
          </div>

          <div className="space-y-2.5 pt-3 border-t kavach-divider">
            <div className="flex items-center gap-1.5 font-semibold">
              <Brain className="w-3.5 h-3.5 kavach-accent-text" />
              <span>Long-Term Memory ({activeMemories.length})</span>
            </div>
            {activeMemories.map((mem) => (
              <div
                key={mem.id}
                className="p-2.5 rounded-xl border kavach-divider bg-[var(--bg-card)] leading-relaxed opacity-90"
              >
                {mem.fact}
              </div>
            ))}
          </div>

          <div className="space-y-2 pt-3 border-t kavach-divider">
            <div className="flex items-center gap-1.5 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 kavach-accent-text" />
              <span>Local Tool Schemas</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
              {[
                'create_note',
                'add_task',
                'complete_task',
                'set_reminder',
                'search_notes',
                'calculate',
                'search_documents',
                'save_memory',
              ].map((t) => (
                <div
                  key={t}
                  className="px-2 py-1 rounded bg-[var(--bg-card)] border kavach-divider truncate"
                >
                  {t}
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};
