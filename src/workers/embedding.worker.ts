import { pipeline, env } from '@huggingface/transformers';

// Configure Transformers.js to allow browser caching and skip local FS checks
env.allowLocalModels = false;
env.useBrowserCache = true;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let extractorPromise: Promise<any> | null = null;

function fallbackDeterministicVector(text: string): number[] {
  const dim = 384;
  const vec = new Float32Array(dim);
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    let h1 = 2166136261;
    let h2 = 16777619;
    for (let c = 0; c < w.length; c++) {
      const code = w.charCodeAt(c);
      h1 = Math.imul(h1 ^ code, 16777619);
      h2 = Math.imul(h2 + code * (c + 1), 1099511628211);
    }
    vec[Math.abs(h1) % dim] += 1.0;
    vec[Math.abs(h2) % dim] += 0.65;
    vec[Math.abs(h1 ^ h2) % dim] += 0.35;
    for (let g = 0; g + 2 < w.length; g++) {
      const tri = w.charCodeAt(g) * 961 + w.charCodeAt(g + 1) * 31 + w.charCodeAt(g + 2);
      vec[Math.abs(tri) % dim] += 0.4;
    }
  }

  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  const out = new Array<number>(dim);
  for (let i = 0; i < dim; i++) out[i] = Number((vec[i] / norm).toFixed(5));
  return out;
}

async function getEmbedding(text: string, useNeuralModel: boolean): Promise<{ vector: number[]; engine: string }> {
  if (!useNeuralModel) {
    return { vector: fallbackDeterministicVector(text), engine: 'local-deterministic-384d' };
  }

  try {
    if (!extractorPromise) {
      extractorPromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        dtype: 'fp32',
      });
    }
    const extractor = await extractorPromise;
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    const vector = Array.from(output.data as Float32Array).map((v) => Number(v.toFixed(5)));
    return { vector, engine: 'all-MiniLM-L6-v2' };
  } catch {
    return { vector: fallbackDeterministicVector(text), engine: 'local-deterministic-384d' };
  }
}

self.onmessage = async (event: MessageEvent) => {
  const { id, type, texts, useNeuralModel = false } = event.data || {};
  if (type === 'EMBED_BATCH' && Array.isArray(texts)) {
    try {
      const results: number[][] = [];
      let activeEngine = 'local-deterministic-384d';
      for (let i = 0; i < texts.length; i++) {
        const res = await getEmbedding(texts[i], useNeuralModel);
        results.push(res.vector);
        activeEngine = res.engine;
        self.postMessage({
          id,
          type: 'PROGRESS',
          completed: i + 1,
          total: texts.length,
          engine: activeEngine,
        });
      }
      self.postMessage({
        id,
        type: 'DONE',
        embeddings: results,
        engine: activeEngine,
      });
    } catch (err) {
      self.postMessage({
        id,
        type: 'ERROR',
        error: err instanceof Error ? err.message : 'Embedding worker error',
      });
    }
  }
};
