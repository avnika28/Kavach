import { useEffect, useState } from 'react';
import { db, DEFAULT_SETTINGS, type AppSettings } from '../../store/db';
import {
  type OllamaHealthStatus,
  type OllamaModelTag,
  type ProviderMode,
  type StreamGenerateOptions,
} from './types';
import { llmProvider } from './webllmProvider';
import {
  DEFAULT_OLLAMA_BASE_URL,
  DEFAULT_OLLAMA_MODEL,
  ollamaProvider,
  OllamaUserAbortError,
} from './ollamaProvider';

export interface ProviderManagerSnapshot {
  health: OllamaHealthStatus;
  checking: boolean;
  lastToast: { id: number; message: string } | null;
}

export interface StreamWithProviderResult {
  text: string;
  usedBackend: 'ollama' | 'webllm';
  providerLabel: string;
}

class KavachProviderManager {
  private snapshot: ProviderManagerSnapshot = {
    health: {
      running: false,
      checkedAt: 0,
      models: [],
      corsOrNetworkError: false,
    },
    checking: false,
    lastToast: null,
  };

  private listeners = new Set<(snap: ProviderManagerSnapshot) => void>();
  private intervalId: number | null = null;
  private initialized = false;

  public startMonitoring(): void {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    void this.checkOllamaHealth();

    // Re-run health check every 15s
    this.intervalId = window.setInterval(() => {
      void this.checkOllamaHealth();
    }, 15_000);

    // Re-run health check on window focus
    window.addEventListener('focus', this.handleWindowFocus);
  }

  private handleWindowFocus = (): void => {
    void this.checkOllamaHealth();
  };

  public stopMonitoring(): void {
    if (this.intervalId !== null && typeof window !== 'undefined') {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', this.handleWindowFocus);
    }
    this.initialized = false;
  }

  public getSnapshot(): ProviderManagerSnapshot {
    return this.snapshot;
  }

  public subscribe(listener: (snap: ProviderManagerSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.snapshot);
    }
  }

  public notifyToast(message: string): void {
    this.snapshot = {
      ...this.snapshot,
      lastToast: {
        id: Date.now(),
        message,
      },
    };
    this.emit();
  }

  public async checkOllamaHealth(overrideBaseUrl?: string): Promise<OllamaHealthStatus> {
    this.snapshot = {
      ...this.snapshot,
      checking: true,
    };
    this.emit();

    let baseUrl = overrideBaseUrl;
    let configuredModel = DEFAULT_OLLAMA_MODEL;
    try {
      const settings = await db.settings.get('global');
      if (!baseUrl) {
        baseUrl = settings?.ollamaBaseUrl || DEFAULT_OLLAMA_BASE_URL;
      }
      if (settings?.ollamaModel) {
        configuredModel = settings.ollamaModel;
      }
    } catch {
      baseUrl = baseUrl || DEFAULT_OLLAMA_BASE_URL;
    }

    ollamaProvider.configure(baseUrl || DEFAULT_OLLAMA_BASE_URL, configuredModel);
    const health = await ollamaProvider.checkHealth(baseUrl, 2000);

    // If Ollama is running and has models, auto-select an installed model if current isn't installed
    if (health.running && health.models.length > 0) {
      try {
        const settings = await db.settings.get('global');
        if (settings) {
          const hasConfigured = health.models.some(
            (m) => m.name === settings.ollamaModel
          );
          if (!hasConfigured && !settings.ollamaModel) {
            await db.settings.update('global', {
              ollamaModel: health.models[0].name,
            });
          }
        }
      } catch {
        // Ignore DB read issues during health check
      }
    }

    this.snapshot = {
      ...this.snapshot,
      health,
      checking: false,
    };
    this.emit();
    return health;
  }

  public resolveActiveBackend(mode: ProviderMode): 'ollama' | 'webllm' {
    if (mode === 'ollama') return 'ollama';
    if (mode === 'webllm') return 'webllm';
    // 'auto': use Ollama if health check passes, else WebLLM
    return this.snapshot.health.running ? 'ollama' : 'webllm';
  }

  public getTopBarBadgeText(mode: ProviderMode): string {
    const resolved = this.resolveActiveBackend(mode);
    return resolved === 'ollama' ? 'Local · Ollama' : 'Offline · Browser';
  }

  public formatAgentLabel(
    backend: 'ollama' | 'webllm',
    ollamaModel?: string
  ): string {
    if (backend === 'ollama') {
      const modelName = (ollamaModel || DEFAULT_OLLAMA_MODEL).trim();
      return `Ollama · ${modelName} · On-device`;
    }
    return 'WebLLM · On-device';
  }

  public abortActiveGeneration(): void {
    ollamaProvider.abort();
    llmProvider.abort();
  }

  /**
   * Streams generation using the configured provider mode.
   * In "Auto" (or if Ollama fails mid-session), falls back to Browser (WebLLM)
   * and emits a toast notification.
   */
  public async generateStream(
    options: StreamGenerateOptions,
    settings: AppSettings = DEFAULT_SETTINGS
  ): Promise<StreamWithProviderResult> {
    const mode: ProviderMode = settings.providerMode || 'auto';
    const baseUrl = settings.ollamaBaseUrl || DEFAULT_OLLAMA_BASE_URL;
    const ollamaModel = this.pickEffectiveOllamaModel(
      settings.ollamaModel,
      this.snapshot.health.models
    );

    ollamaProvider.configure(baseUrl, ollamaModel);

    let shouldTryOllama = false;
    if (mode === 'ollama') {
      shouldTryOllama = true;
    } else if (mode === 'auto') {
      // If we haven't checked recently or currently healthy, verify health
      if (Date.now() - this.snapshot.health.checkedAt > 15_000) {
        const freshHealth = await this.checkOllamaHealth(baseUrl);
        shouldTryOllama = freshHealth.running;
      } else {
        shouldTryOllama = this.snapshot.health.running;
      }
    }

    if (shouldTryOllama) {
      let partialText = '';
      try {
        const text = await ollamaProvider.generateStream({
          ...options,
          baseUrl,
          model: ollamaModel,
          temperature: settings.temperature ?? 0.6,
          topP: settings.topP ?? 0.9,
          repeatPenalty: settings.repeatPenalty ?? 1.1,
          contextLength: settings.contextLength ?? 4096,
          maxTokens: settings.maxTokens ?? 1024,
          onToken: (delta, full) => {
            partialText = full;
            options.onToken(delta, full);
          },
        });

        // Mark health as running since call succeeded
        if (!this.snapshot.health.running) {
          void this.checkOllamaHealth(baseUrl);
        }

        return {
          text,
          usedBackend: 'ollama',
          providerLabel: this.formatAgentLabel('ollama', ollamaModel),
        };
      } catch (err) {
        if (err instanceof OllamaUserAbortError) {
          return {
            text: partialText || 'Generation stopped.',
            usedBackend: 'ollama',
            providerLabel: this.formatAgentLabel('ollama', ollamaModel),
          };
        }

        // Mark Ollama as not running after failure
        this.snapshot = {
          ...this.snapshot,
          health: {
            ...this.snapshot.health,
            running: false,
            checkedAt: Date.now(),
            corsOrNetworkError: true,
            errorMessage:
              err instanceof Error ? err.message : 'Ollama connection interrupted',
          },
        };
        this.emit();

        this.notifyToast(
          mode === 'auto'
            ? 'Ollama unreachable mid-session — automatically switched to Browser (WebLLM).'
            : 'Ollama not reachable at localhost — answered via Browser (WebLLM) fallback.'
        );
      }
    }

    const webllmText = await llmProvider.generateStream({
      ...options,
      temperature: settings.temperature ?? 0.6,
      maxTokens: settings.maxTokens ?? 1024,
    });

    return {
      text: webllmText,
      usedBackend: 'webllm',
      providerLabel: this.formatAgentLabel('webllm'),
    };
  }

  private pickEffectiveOllamaModel(
    configuredModel: string | undefined,
    installedModels: OllamaModelTag[]
  ): string {
    const desired = (configuredModel || DEFAULT_OLLAMA_MODEL).trim();
    if (installedModels.length === 0) return desired;
    const exact = installedModels.find((m) => m.name === desired);
    if (exact) return exact.name;
    return desired || installedModels[0].name;
  }
}

export const providerManager = new KavachProviderManager();

export function useProviderManager(): ProviderManagerSnapshot {
  const [snap, setSnap] = useState<ProviderManagerSnapshot>(() =>
    providerManager.getSnapshot()
  );

  useEffect(() => {
    providerManager.startMonitoring();
    return providerManager.subscribe(setSnap);
  }, []);

  return snap;
}
