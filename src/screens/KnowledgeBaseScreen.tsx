import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Upload,
  FileText,
  Trash2,
  CheckCircle2,
  Loader2,
  Plus,
  Brain,
  Sparkles,
  Edit3,
  Check,
  X,
} from 'lucide-react';
import { db, type KnowledgeDocument, type MemoryFact } from '../store/db';
import { ingestDocumentToVault, splitTextIntoChunks, embedTextsInWorker } from '../lib/llm/rag';
import { ScrollTrigger } from '../lib/animations';

export const KnowledgeBaseScreen: React.FC = () => {
  const documents =
    useLiveQuery(() => db.documents.orderBy('createdAt').reverse().toArray()) || [];
  const memories =
    useLiveQuery(() => db.memories.orderBy('createdAt').reverse().toArray()) || [];

  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [newFactText, setNewFactText] = useState('');
  const [newFactCategory, setNewFactCategory] = useState<MemoryFact['category']>('preference');
  const [editingMemId, setEditingMemId] = useState<string | null>(null);
  const [editingMemText, setEditingMemText] = useState('');

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadStatus(`Parsing & indexing "${file.name}" in local Web Worker...`);
      try {
        await ingestDocumentToVault(file, (done, total) => {
          setUploadStatus(`Embedding "${file.name}": chunk ${done} of ${total}...`);
        });
        setUploadStatus(`Indexed "${file.name}" into local IndexedDB vector vault.`);
        ScrollTrigger.refresh();
      } catch (err) {
        setUploadStatus(
          `Failed to index "${file.name}": ${
            err instanceof Error ? err.message : 'Parse error'
          }`
        );
      }
    }
  };

  const handleCreateSampleDoc = async () => {
    setUploadStatus('Generating sample Security Field Manual in local vault...');
    const sampleContent = `# KAVACH FIELD MANUAL: AIR-GAPPED OPERATIONS (2026)

## Section 1: Zero-Network Cryptographic Guarantees
All user conversations, personal notes, and document vector chunks reside exclusively inside the browser's IndexedDB origin store. No cloud API endpoints are contacted during inference.

## Section 2: Local RAG Vector Retrieval
Uploaded PDF, Markdown, and plaintext documents are segmented into 460-character overlapping windows and embedded into 384-dimensional unit vectors using Xenova/all-MiniLM-L6-v2 inside an isolated Web Worker.

## Section 3: Emergency Vault Evacuation
Operators may export their entire IndexedDB vault as a single portable JSON archive from the Settings screen or execute an immediate cryptographic wipe.`;

    const docId = `doc-${Date.now()}`;
    const chunks = splitTextIntoChunks(sampleContent);
    const embeddings = await embedTextsInWorker(chunks, false);

    await db.documents.put({
      id: docId,
      name: `Air_Gapped_Field_Manual_${documents.length + 1}.md`,
      size: sampleContent.length,
      mimeType: 'text/markdown',
      status: 'indexed',
      useInAnswers: true,
      chunkCount: chunks.length,
      createdAt: Date.now(),
      rawText: sampleContent,
    });

    await db.chunks.bulkPut(
      chunks.map((content, idx) => ({
        id: `${docId}-chunk-${idx}`,
        documentId: docId,
        documentName: `Air_Gapped_Field_Manual_${documents.length + 1}.md`,
        content,
        chunkIndex: idx,
        embedding: embeddings[idx],
      }))
    );

    setUploadStatus('Sample Field Manual indexed and active for RAG citations.');
    ScrollTrigger.refresh();
  };

  const toggleUseInAnswers = async (doc: KnowledgeDocument) => {
    await db.documents.update(doc.id, { useInAnswers: !doc.useInAnswers });
  };

  const deleteDocument = async (id: string) => {
    await db.transaction('rw', [db.documents, db.chunks], async () => {
      await db.chunks.where('documentId').equals(id).delete();
      await db.documents.delete(id);
    });
  };

  const handleAddMemoryFact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFactText.trim()) return;
    await db.memories.put({
      id: `mem-${Date.now()}`,
      fact: newFactText.trim(),
      category: newFactCategory,
      active: true,
      createdAt: Date.now(),
    });
    setNewFactText('');
  };

  const saveMemoryEdit = async (id: string) => {
    if (editingMemText.trim()) {
      await db.memories.update(id, { fact: editingMemText.trim() });
    }
    setEditingMemId(null);
  };

  return (
    <div className="max-w-6xl mx-auto w-full px-6 py-10 space-y-12">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b kavach-divider pb-5">
        <div>
          <span className="font-editorial-label italic text-base">
            Local RAG &amp; Personal Memory · Transformers.js Worker
          </span>
          <h1 className="text-5xl sm:text-6xl font-display-bebas mt-1">
            KNOWLEDGE BASE &amp; MEMORY VAULT
          </h1>
        </div>
        <button
          type="button"
          onClick={handleCreateSampleDoc}
          className="px-4 py-2.5 rounded-[20px] border kavach-divider bg-[#E8D2B5] text-[#1C0A0A] text-xs font-medium flex items-center gap-2 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#590907]" />
          <span>Add Sample Field Manual</span>
        </button>
      </div>

      {/* Drag and Drop Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFilesSelected(e.dataTransfer.files);
        }}
        className={`kavach-card p-10 text-center transition-all border-2 border-dashed ${
          isDragging
            ? 'border-[#590907] bg-[#590907]/10'
            : 'border-[#1C0A0A]/25 dark:border-[#E8D2B5]/25'
        }`}
      >
        <Upload className="w-8 h-8 mx-auto mb-3 text-[#590907] dark:text-[#E8D2B5]" />
        <h2 className="text-3xl font-display-bebas tracking-wide">
          DROP PDF, MARKDOWN, OR TXT FILES TO INDEX LOCALLY
        </h2>
        <p className="text-xs sm:text-sm opacity-80 max-w-xl mx-auto mt-1 mb-5">
          Parsed in-browser via <code>pdf.js</code>, chunked with overlap, and embedded into 384-dimensional vectors (`all-MiniLM-L6-v2` worker). Zero bytes uploaded to the cloud.
        </p>

        <label className="inline-flex items-center gap-2 px-6 py-3 rounded-[20px] bg-[#590907] hover:bg-[#7A1012] text-[#E8D2B5] text-xs font-medium cursor-pointer transition-colors">
          <Upload className="w-4 h-4" />
          <span>Select Local Files (.PDF, .MD, .TXT)</span>
          <input
            type="file"
            multiple
            accept=".pdf,.txt,.md,.markdown"
            onChange={(e) => handleFilesSelected(e.target.files)}
            className="hidden"
          />
        </label>

        {uploadStatus && (
          <p className="mt-4 text-xs font-mono text-[#590907] dark:text-[#E8D2B5]">
            {uploadStatus}
          </p>
        )}
      </div>

      {/* Indexed Document Cards */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-display-bebas">
            INDEXED DOCUMENTS ({documents.length})
          </h2>
          <span className="font-editorial-label italic text-sm opacity-80">
            Toggle &ldquo;Use in answers&rdquo; to control active RAG context
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {documents.map((doc) => (
            <div key={doc.id} className="kavach-card p-6 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3 border-b kavach-divider pb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="w-4 h-4 text-[#590907] dark:text-[#E8D2B5] shrink-0" />
                    <h3 className="font-semibold text-sm truncate">{doc.name}</h3>
                  </div>
                  <span className="flex items-center gap-1 text-xs font-mono shrink-0">
                    {doc.status === 'processing' ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Processing</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-800 dark:text-emerald-400" />
                        <span>Indexed</span>
                      </>
                    )}
                  </span>
                </div>

                <p className="text-xs opacity-80 line-clamp-2 font-mono">
                  {doc.rawText.slice(0, 180)}
                </p>
              </div>

              <div className="pt-3 border-t kavach-divider flex items-center justify-between gap-4 text-xs">
                <div className="font-mono text-[11px] opacity-75">
                  {doc.chunkCount} chunks · {(doc.size / 1024).toFixed(1)} KB
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={doc.useInAnswers}
                      onChange={() => toggleUseInAnswers(doc)}
                      className="accent-[#590907] w-4 h-4 rounded cursor-pointer"
                    />
                    <span className="font-medium">Use in answers</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => deleteDocument(doc.id)}
                    className="p-1.5 rounded-lg hover:bg-[#590907]/15 text-[#590907] dark:text-[#E8D2B5] cursor-pointer"
                    title="Delete document and chunks"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Long-Term Memory Facts Editor */}
      <section className="space-y-4 pt-4 border-t kavach-divider">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-3xl font-display-bebas flex items-center gap-2">
              <Brain className="w-6 h-6 text-[#590907] dark:text-[#E8D2B5]" />
              <span>LONG-TERM PERSONAL MEMORY FACTS ({memories.length})</span>
            </h2>
            <p className="text-xs opacity-80">
              Short facts remembered about you by the agent or added manually. Editable and toggleable anytime.
            </p>
          </div>
        </div>

        <form onSubmit={handleAddMemoryFact} className="kavach-card p-4 flex flex-wrap gap-3">
          <select
            value={newFactCategory}
            onChange={(e) => setNewFactCategory(e.target.value as MemoryFact['category'])}
            className="px-3 py-2 rounded-xl bg-[#1C0A0A]/5 dark:bg-[#E8D2B5]/10 border kavach-divider text-xs font-medium"
          >
            <option value="preference">Preference</option>
            <option value="project">Project</option>
            <option value="identity">Identity</option>
            <option value="constraint">Constraint</option>
          </select>

          <input
            type="text"
            value={newFactText}
            onChange={(e) => setNewFactText(e.target.value)}
            placeholder="Add a personal fact for Kavach to remember offline (e.g., 'Prefers concise Rust and TypeScript examples')..."
            className="flex-1 min-w-[220px] px-3.5 py-2 rounded-xl bg-transparent border kavach-divider text-xs focus:outline-none focus:border-[#590907]"
          />

          <button
            type="submit"
            className="px-5 py-2 rounded-xl bg-[#590907] hover:bg-[#7A1012] text-[#E8D2B5] text-xs font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Save Fact</span>
          </button>
        </form>

        <div className="space-y-2.5">
          {memories.map((mem) => (
            <div
              key={mem.id}
              className="kavach-card px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs"
            >
              {editingMemId === mem.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={editingMemText}
                    onChange={(e) => setEditingMemText(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-white/80 text-[#1C0A0A] border border-[#590907] text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => saveMemoryEdit(mem.id)}
                    className="p-1.5 rounded-lg bg-[#590907] text-[#E8D2B5]"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingMemId(null)}
                    className="p-1.5 rounded-lg border kavach-divider"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={mem.active}
                      onChange={() => db.memories.update(mem.id, { active: !mem.active })}
                      className="accent-[#590907] w-4 h-4 cursor-pointer shrink-0"
                    />
                    <span className="font-editorial-label italic text-sm capitalize opacity-75 shrink-0">
                      {mem.category} ·
                    </span>
                    <span className={mem.active ? 'font-medium' : 'line-through opacity-50'}>
                      {mem.fact}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingMemId(mem.id);
                        setEditingMemText(mem.fact);
                      }}
                      className="p-1.5 rounded-lg hover:bg-[#1C0A0A]/10 cursor-pointer"
                      title="Edit memory fact"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => db.memories.delete(mem.id)}
                      className="p-1.5 rounded-lg hover:bg-[#590907]/15 text-[#590907] dark:text-[#E8D2B5] cursor-pointer"
                      title="Delete memory fact"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
