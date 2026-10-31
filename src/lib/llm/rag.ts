import {
  db,
  computeDeterministicEmbedding,
  type CitationItem,
  type DocumentChunk,
  type KnowledgeDocument,
} from '../../store/db';

let embeddingWorker: Worker | null = null;

function getEmbeddingWorker(): Worker | null {
  if (typeof window === 'undefined') return null;
  if (!embeddingWorker) {
    try {
      embeddingWorker = new Worker(
        new URL('../../workers/embedding.worker.ts', import.meta.url),
        { type: 'module' }
      );
    } catch {
      embeddingWorker = null;
    }
  }
  return embeddingWorker;
}

export async function embedTextsInWorker(
  texts: string[],
  useNeuralModel = false,
  onProgress?: (completed: number, total: number) => void
): Promise<number[][]> {
  const worker = getEmbeddingWorker();
  if (!worker) {
    return texts.map((t) => computeDeterministicEmbedding(t));
  }

  return new Promise((resolve) => {
    const reqId = `emb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const timeout = setTimeout(() => {
      worker.removeEventListener('message', handleMsg);
      resolve(texts.map((t) => computeDeterministicEmbedding(t)));
    }, 15000);

    const handleMsg = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.id !== reqId) return;
      if (data.type === 'PROGRESS' && onProgress) {
        onProgress(data.completed, data.total);
      } else if (data.type === 'DONE') {
        clearTimeout(timeout);
        worker.removeEventListener('message', handleMsg);
        resolve(data.embeddings as number[][]);
      } else if (data.type === 'ERROR') {
        clearTimeout(timeout);
        worker.removeEventListener('message', handleMsg);
        resolve(texts.map((t) => computeDeterministicEmbedding(t)));
      }
    };

    worker.addEventListener('message', handleMsg);
    worker.postMessage({
      id: reqId,
      type: 'EMBED_BATCH',
      texts,
      useNeuralModel,
    });
  });
}

export async function extractTextFromFile(file: File): Promise<string> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.pdf') || file.type === 'application/pdf') {
    try {
      const pdfjsLib = await import('pdfjs-dist');
      // Disable external CDN worker fetch so PDF parsing works 100% offline
      if (pdfjsLib.GlobalWorkerOptions) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '';
      }
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer),
        useSystemFonts: true,
        isEvalSupported: false,
      });
      const pdf = await loadingTask.promise;
      const pagesText: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((item: any) => ('str' in item ? item.str : ''))
          .join(' ');
        if (strings.trim()) {
          pagesText.push(strings.trim());
        }
      }
      if (pagesText.length > 0) {
        return pagesText.join('\n\n');
      }
    } catch {
      // Fallback: extract printable ASCII/UTF-8 runs from the PDF buffer
      const rawBytes = new Uint8Array(await file.arrayBuffer());
      const decoder = new TextDecoder('utf-8', { fatal: false });
      const decoded = decoder.decode(rawBytes);
      const printable = decoded
        .replace(/[^\x20-\x7E\n\r]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return printable.slice(0, 12000) || `Uploaded PDF Document: ${file.name}`;
    }
  }

  return await file.text();
}

export function splitTextIntoChunks(text: string, chunkSize = 460, overlap = 80): string[] {
  const clean = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!clean) return [];
  if (clean.length <= chunkSize) return [clean];

  const paragraphs = clean.split(/\n\n+/);
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    if ((current + '\n\n' + para).trim().length <= chunkSize) {
      current = current ? `${current}\n\n${para}` : para;
    } else {
      if (current) {
        chunks.push(current.trim());
        const tail = current.slice(Math.max(0, current.length - overlap));
        current = `${tail} ${para}`.trim();
      } else {
        // Long single paragraph
        let idx = 0;
        while (idx < para.length) {
          chunks.push(para.slice(idx, idx + chunkSize).trim());
          idx += chunkSize - overlap;
        }
        current = '';
      }
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.filter(Boolean);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export async function ingestDocumentToVault(
  file: File,
  onProgress?: (completed: number, total: number) => void
): Promise<KnowledgeDocument> {
  const docId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const initialDoc: KnowledgeDocument = {
    id: docId,
    name: file.name,
    size: file.size,
    mimeType: file.type || 'text/plain',
    status: 'processing',
    useInAnswers: true,
    chunkCount: 0,
    createdAt: Date.now(),
    rawText: '',
  };

  await db.documents.put(initialDoc);

  try {
    const rawText = await extractTextFromFile(file);
    const textChunks = splitTextIntoChunks(rawText);
    const embeddings = await embedTextsInWorker(textChunks, false, onProgress);

    const chunkRecords: DocumentChunk[] = textChunks.map((content, idx) => ({
      id: `${docId}-chunk-${idx}`,
      documentId: docId,
      documentName: file.name,
      content,
      chunkIndex: idx,
      embedding: embeddings[idx] || computeDeterministicEmbedding(content),
    }));

    await db.chunks.bulkPut(chunkRecords);

    const updatedDoc: KnowledgeDocument = {
      ...initialDoc,
      status: 'indexed',
      chunkCount: chunkRecords.length,
      rawText,
    };
    await db.documents.put(updatedDoc);
    return updatedDoc;
  } catch (err) {
    const failedDoc: KnowledgeDocument = {
      ...initialDoc,
      status: 'error',
    };
    await db.documents.put(failedDoc);
    throw err;
  }
}

export const RAG_RELEVANCE_THRESHOLD = 0.45;
export const RAG_MAX_CHUNKS = 3;

const STOPWORDS = new Set([
  'what',
  'who',
  'where',
  'when',
  'why',
  'how',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'the',
  'a',
  'an',
  'of',
  'in',
  'on',
  'at',
  'to',
  'for',
  'and',
  'or',
  'with',
  'from',
  'about',
  'can',
  'you',
  'tell',
  'me',
  'does',
  'do',
  'did',
  'has',
  'have',
  'this',
  'that',
  'it',
  'by',
]);

export function extractMeaningfulTerms(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

export type MessageRouteType = 'tool' | 'rag' | 'general';

/**
 * Classifies the user message BEFORE running full RAG or LLM generation:
 * - tool request (note/task/reminder/calculate) -> 'tool'
 * - question about uploaded documents / personal data -> 'rag'
 * - general question -> 'general'
 */
export async function classifyUserMessageRoute(
  query: string,
  hasToolIntent: boolean
): Promise<MessageRouteType> {
  if (hasToolIntent) {
    return 'tool';
  }

  const lower = query.toLowerCase().trim();

  // Explicit document / personal vault keywords
  const explicitDocKeywords = [
    'document',
    'documents',
    'uploaded',
    'pdf',
    'manual',
    'manifesto',
    'kavach',
    'vault',
    'indexed',
    'my notes',
    'my files',
    'according to',
    'in my file',
  ];
  if (explicitDocKeywords.some((kw) => lower.includes(kw))) {
    return 'rag';
  }

  // Otherwise check if any active document shares meaningful content terms
  const queryTerms = extractMeaningfulTerms(query);
  if (queryTerms.length === 0) return 'general';

  const activeDocs = await db.documents
    .filter((d) => d.status === 'indexed' && d.useInAnswers)
    .toArray();
  if (activeDocs.length === 0) return 'general';

  for (const doc of activeDocs) {
    const hay = `${doc.name} ${doc.rawText}`.toLowerCase();
    const matchedTerms = queryTerms.filter((t) => hay.includes(t));
    if (matchedTerms.length > 0 && matchedTerms.length / queryTerms.length >= 0.34) {
      return 'rag';
    }
  }

  return 'general';
}

export async function searchKnowledgeBase(
  query: string,
  topK = RAG_MAX_CHUNKS
): Promise<CitationItem[]> {
  if (!query.trim()) return [];
  const activeDocs = await db.documents
    .filter((d) => d.status === 'indexed' && d.useInAnswers)
    .toArray();

  if (activeDocs.length === 0) return [];
  const activeDocIds = new Set(activeDocs.map((d) => d.id));

  const allChunks = await db.chunks
    .filter((c) => activeDocIds.has(c.documentId))
    .toArray();

  if (allChunks.length === 0) return [];

  const queryTerms = extractMeaningfulTerms(query);
  if (queryTerms.length === 0) return [];

  const queryVec = computeDeterministicEmbedding(queryTerms.join(' '));
  const maxChunks = Math.min(topK, RAG_MAX_CHUNKS);

  const scored = allChunks.map((chunk) => {
    const chunkTerms = extractMeaningfulTerms(
      `${chunk.documentName} ${chunk.content}`
    );
    const chunkCleanVec = computeDeterministicEmbedding(chunkTerms.join(' '));
    const rawCosine = cosineSimilarity(queryVec, chunkCleanVec);

    const lowerContent = `${chunk.documentName} ${chunk.content}`.toLowerCase();
    let matchedCount = 0;
    for (const term of queryTerms) {
      if (lowerContent.includes(term)) {
        matchedCount++;
      }
    }

    // If zero meaningful query terms appear in the chunk and rawCosine < threshold, score stays below 0.45
    const termOverlapRatio = matchedCount / queryTerms.length;
    const combinedScore =
      matchedCount > 0
        ? Math.max(rawCosine, 0.35 + termOverlapRatio * 0.52)
        : rawCosine * 0.5;

    return {
      chunkId: chunk.id,
      documentId: chunk.documentId,
      documentName: chunk.documentName,
      snippet: chunk.content,
      score: Math.min(0.99, Number(combinedScore.toFixed(2))),
    };
  });

  return scored
    .filter((item) => item.score >= RAG_RELEVANCE_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxChunks);
}

