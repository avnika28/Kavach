export interface ModelOption {
  id: string;
  tier: 'Fast ~1B' | 'Balanced ~3B' | 'Ultra-Light ~360M';
  name: string;
  params: string;
  quantization: string;
  vramMB: number;
  downloadSizeLabel: string;
  description: string;
  recommended?: boolean;
}

export const KAVACH_MODELS: ModelOption[] = [
  {
    id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    tier: 'Fast ~1B',
    name: 'Llama 3.2 · 1B Instruct',
    params: '1.24B',
    quantization: 'q4f16_1',
    vramMB: 880,
    downloadSizeLabel: '~680 MB',
    description:
      'Default sovereign engine. Sub-35ms token streaming on integrated WebGPU laptops with reliable local JSON tool synthesis.',
    recommended: true,
  },
  {
    id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
    tier: 'Balanced ~3B',
    name: 'Llama 3.2 · 3B Instruct',
    params: '3.21B',
    quantization: 'q4f16_1',
    vramMB: 2260,
    downloadSizeLabel: '~1.85 GB',
    description:
      'Higher-depth editorial synthesis, multi-document RAG cross-referencing, and nuanced long-context reasoning.',
  },
  {
    id: 'SmolLM2-360M-Instruct-q4f16_1-MLC',
    tier: 'Ultra-Light ~360M',
    name: 'SmolLM2 · 360M Instruct',
    params: '360M',
    quantization: 'q4f16_1',
    vramMB: 380,
    downloadSizeLabel: '~240 MB',
    description:
      'Compact fallback model for low-VRAM devices or rapid initial download on constrained connections.',
  },
];

export interface DownloadProgressState {
  progress: number; // 0 to 1
  text: string;
  timeElapsed?: number;
  status: 'idle' | 'checking-gpu' | 'downloading' | 'ready' | 'error';
  errorMessage?: string;
  activeBackend: 'webgpu-mlc' | 'local-sovereign-runtime' | 'ollama-local';
}

export type ProviderMode = 'auto' | 'ollama' | 'webllm';

export interface OllamaModelTag {
  name: string;
  size?: number;
  modified_at?: string;
  details?: {
    parameter_size?: string;
    quantization_level?: string;
    family?: string;
  };
}

export interface OllamaHealthStatus {
  running: boolean;
  checkedAt: number;
  models: OllamaModelTag[];
  corsOrNetworkError?: boolean;
  errorMessage?: string;
}

export interface StreamGenerateOptions {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature: number;
  topP?: number;
  repeatPenalty?: number;
  contextLength?: number;
  maxTokens: number;
  model?: string;
  baseUrl?: string;
  formatJson?: boolean;
  onToken: (tokenDelta: string, fullText: string) => void;
}

export interface WebGPUCheckResult {
  supported: boolean;
  adapterName: string;
  reason?: string;
}

export interface LLMProvider {
  readonly providerName: string;
  checkWebGPU(): Promise<WebGPUCheckResult>;
  initModel(
    modelId: string,
    onProgress: (state: DownloadProgressState) => void,
    preferInstantLocal?: boolean
  ): Promise<void>;
  generateStream(options: StreamGenerateOptions): Promise<string>;
  abort(): void;
  getStatus(): DownloadProgressState;
}

