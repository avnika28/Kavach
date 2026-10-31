import {
  type DownloadProgressState,
  type LLMProvider,
  type OllamaHealthStatus,
  type OllamaModelTag,
  type StreamGenerateOptions,
  type WebGPUCheckResult,
} from './types';

export const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434';
export const DEFAULT_OLLAMA_MODEL = 'qwen2.5:3b';

/**
 * Privacy guard: strictly allows localhost / loopback origins only
 * (localhost, 127.0.0.1, [::1]) so zero external requests can ever occur.
 */
export function validateLocalhostBaseUrl(rawUrl?: string): {
  valid: boolean;
  normalizedUrl: string;
  reason?: string;
} {
  const candidate = (rawUrl || DEFAULT_OLLAMA_BASE_URL).trim().replace(/\/+$/, '');
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        valid: false,
        normalizedUrl: DEFAULT_OLLAMA_BASE_URL,
        reason: 'Only http:// or https:// localhost URLs are permitted.',
      };
    }
    const host = parsed.hostname.toLowerCase();
    const isLoopback =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '[::1]' ||
      host === '::1';

    if (!isLoopback) {
      return {
        valid: false,
        normalizedUrl: DEFAULT_OLLAMA_BASE_URL,
        reason:
          'Privacy lock: Only calls to localhost (127.0.0.1 / localhost) are allowed. External servers are blocked.',
      };
    }

    return {
      valid: true,
      normalizedUrl: `${parsed.protocol}//${parsed.host}`,
    };
  } catch {
    return {
      valid: false,
      normalizedUrl: DEFAULT_OLLAMA_BASE_URL,
      reason: 'Invalid URL format. Expected http://localhost:11434.',
    };
  }
}

export class OllamaUserAbortError extends Error {
  constructor() {
    super('Generation stopped by user');
    this.name = 'OllamaUserAbortError';
  }
}

export class OllamaProvider implements LLMProvider {
  public readonly providerName = 'Ollama (Local Server)';
  private baseUrl = DEFAULT_OLLAMA_BASE_URL;
  private modelId = DEFAULT_OLLAMA_MODEL;
  private abortController: AbortController | null = null;
  private userAborted = false;

  private status: DownloadProgressState = {
    progress: 1,
    text: 'Ready · Local Ollama',
    status: 'ready',
    activeBackend: 'ollama-local',
  };

  public configure(baseUrl: string, modelId: string): void {
    const check = validateLocalhostBaseUrl(baseUrl);
    if (check.valid) {
      this.baseUrl = check.normalizedUrl;
    }
    if (modelId && modelId.trim()) {
      this.modelId = modelId.trim();
    }
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public getModelId(): string {
    return this.modelId;
  }

  public async checkWebGPU(): Promise<WebGPUCheckResult> {
    return {
      supported: true,
      adapterName: `Ollama Local Server (${this.baseUrl})`,
    };
  }

  public async initModel(
    modelId: string,
    onProgress: (state: DownloadProgressState) => void
  ): Promise<void> {
    if (modelId) {
      this.modelId = modelId;
    }
    this.status = {
      progress: 1,
      text: `Ready · Local · Ollama (${this.modelId})`,
      status: 'ready',
      activeBackend: 'ollama-local',
    };
    onProgress(this.status);
  }

  public getStatus(): DownloadProgressState {
    return this.status;
  }

  public abort(): void {
    this.userAborted = true;
    if (this.abortController) {
      try {
        this.abortController.abort();
      } catch {
        // Ignore abort exceptions
      }
      this.abortController = null;
    }
  }

  /**
   * Health check: GET {baseUrl}/api/tags with a 2000ms timeout to detect if Ollama is running
   * and retrieve installed models in a single local call.
   */
  public async checkHealth(
    overrideBaseUrl?: string,
    timeoutMs = 2000
  ): Promise<OllamaHealthStatus> {
    const check = validateLocalhostBaseUrl(overrideBaseUrl || this.baseUrl);
    if (!check.valid) {
      return {
        running: false,
        checkedAt: Date.now(),
        models: [],
        corsOrNetworkError: false,
        errorMessage: check.reason,
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${check.normalizedUrl}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      });

      if (!response.ok) {
        return {
          running: false,
          checkedAt: Date.now(),
          models: [],
          corsOrNetworkError: false,
          errorMessage: `Ollama returned HTTP ${response.status}`,
        };
      }

      const data = await response.json();
      const rawModels = Array.isArray(data?.models) ? data.models : [];
      const models: OllamaModelTag[] = rawModels
        .map((m: Record<string, unknown>) => ({
          name: String(m.name || m.model || ''),
          size: typeof m.size === 'number' ? m.size : undefined,
          modified_at: typeof m.modified_at === 'string' ? m.modified_at : undefined,
          details:
            m.details && typeof m.details === 'object'
              ? (m.details as OllamaModelTag['details'])
              : undefined,
        }))
        .filter((m: OllamaModelTag) => Boolean(m.name));

      return {
        running: true,
        checkedAt: Date.now(),
        models,
        corsOrNetworkError: false,
      };
    } catch (err) {
      const isTimeout = err instanceof DOMException && err.name === 'AbortError';
      const isTypeError = err instanceof TypeError;
      return {
        running: false,
        checkedAt: Date.now(),
        models: [],
        corsOrNetworkError: isTypeError || !isTimeout,
        errorMessage: isTimeout
          ? 'Connection timed out after 2s (Ollama daemon not responding).'
          : 'Could not reach Ollama at localhost. Ensure Ollama is running and OLLAMA_ORIGINS allows browser requests.',
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Models list: GET {baseUrl}/api/tags to populate the model dropdown.
   */
  public async listModels(overrideBaseUrl?: string): Promise<OllamaModelTag[]> {
    const health = await this.checkHealth(overrideBaseUrl, 2000);
    return health.models;
  }

  /**
   * Chat: POST {baseUrl}/api/chat with { model, messages, stream: true, options: {
   * temperature, top_p, repeat_penalty, num_ctx: 4096 } }.
   * Parses streaming NDJSON line by line and streams tokens to the UI.
   */
  public async generateStream(options: StreamGenerateOptions): Promise<string> {
    const check = validateLocalhostBaseUrl(options.baseUrl || this.baseUrl);
    if (!check.valid) {
      throw new Error(check.reason || 'Invalid localhost URL for Ollama.');
    }

    const targetModel = (options.model || this.modelId || DEFAULT_OLLAMA_MODEL).trim();
    this.userAborted = false;
    this.abortController = new AbortController();

    const payload: Record<string, unknown> = {
      model: targetModel,
      messages: options.messages,
      stream: true,
      options: {
        temperature: options.temperature ?? 0.6,
        top_p: options.topP ?? 0.9,
        repeat_penalty: options.repeatPenalty ?? 1.1,
        num_ctx: options.contextLength ?? 4096,
        num_predict: options.maxTokens ?? 1024,
      },
    };

    if (options.formatJson) {
      payload.format = 'json';
    }

    let response: Response;
    try {
      response = await fetch(`${check.normalizedUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: this.abortController.signal,
      });
    } catch (err) {
      if (this.userAborted || (err instanceof DOMException && err.name === 'AbortError')) {
        throw new OllamaUserAbortError();
      }
      throw err;
    }

    if (!response.ok) {
      let errDetail = `HTTP ${response.status}`;
      try {
        const errJson = await response.json();
        if (errJson?.error) errDetail = String(errJson.error);
      } catch {
        // Ignore non-JSON error body
      }
      throw new Error(`Ollama /api/chat failed: ${errDetail}`);
    }

    if (!response.body) {
      const fallbackJson = await response.json();
      const content = String(fallbackJson?.message?.content || '');
      if (content) {
        options.onToken(content, content);
      }
      return content;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullText = '';

    try {
      while (true) {
        if (this.userAborted) {
          break;
        }
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Keep the last potentially incomplete line in buffer
        buffer = lines.pop() ?? '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.error) {
              throw new Error(String(parsed.error));
            }
            const tokenDelta =
              typeof parsed?.message?.content === 'string'
                ? parsed.message.content
                : typeof parsed?.response === 'string'
                ? parsed.response
                : '';
            if (tokenDelta) {
              fullText += tokenDelta;
              options.onToken(tokenDelta, fullText);
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message && !line.startsWith('{')) {
              continue;
            }
            if (parseErr instanceof Error && ! parseErr.message.includes('JSON')) {
              throw parseErr;
            }
          }
        }
      }

      // Flush any trailing line in buffer
      const remaining = buffer.trim();
      if (remaining && !this.userAborted) {
        try {
          const parsed = JSON.parse(remaining);
          const tokenDelta =
            typeof parsed?.message?.content === 'string'
              ? parsed.message.content
              : '';
          if (tokenDelta) {
            fullText += tokenDelta;
            options.onToken(tokenDelta, fullText);
          }
        } catch {
          // Ignore trailing incomplete fragment
        }
      }
    } catch (err) {
      if (this.userAborted || (err instanceof DOMException && err.name === 'AbortError')) {
        return fullText;
      }
      throw err;
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // Ignore reader lock release
      }
      this.abortController = null;
    }

    return fullText;
  }
}

export const ollamaProvider = new OllamaProvider();
