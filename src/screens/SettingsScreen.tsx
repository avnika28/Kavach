import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Sliders,
  Download,
  Upload,
  Trash2,
  HardDrive,
  Sun,
  Moon,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  Terminal,
  ShieldCheck,
} from 'lucide-react';
import {
  db,
  DEFAULT_SETTINGS,
  exportVaultAsJson,
  importVaultFromJson,
  wipeEntireVault,
  ensureSeedData,
} from '../store/db';
import { KAVACH_MODELS, type ProviderMode } from '../lib/llm/types';
import {
  DEFAULT_OLLAMA_BASE_URL,
  DEFAULT_OLLAMA_MODEL,
  validateLocalhostBaseUrl,
} from '../lib/llm/ollamaProvider';
import { providerManager, useProviderManager } from '../lib/llm/providerManager';
import { PWAInstallButton } from '../components/PWAInstallButton';

export const SettingsScreen: React.FC = () => {
  const settings = useLiveQuery(() => db.settings.get('global')) || DEFAULT_SETTINGS;
  const providerSnap = useProviderManager();

  const [personaDraft, setPersonaDraft] = useState(settings.persona);
  const [baseUrlDraft, setBaseUrlDraft] = useState(
    settings.ollamaBaseUrl || DEFAULT_OLLAMA_BASE_URL
  );
  const [baseUrlError, setBaseUrlError] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [showWipeModal, setShowWipeModal] = useState(false);
  const [storageInfo, setStorageInfo] = useState({ usageMB: 14.2, quotaMB: 2048 });
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  useEffect(() => {
    setPersonaDraft(settings.persona);
  }, [settings.persona]);

  useEffect(() => {
    setBaseUrlDraft(settings.ollamaBaseUrl || DEFAULT_OLLAMA_BASE_URL);
  }, [settings.ollamaBaseUrl]);

  useEffect(() => {
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then((est) => {
        setStorageInfo({
          usageMB: Number(((est.usage || 14_800_000) / (1024 * 1024)).toFixed(2)),
          quotaMB: Number(((est.quota || 2_147_483_648) / (1024 * 1024)).toFixed(0)),
        });
      });
    }
  }, []);

  const updateSetting = async (patch: Partial<typeof settings>) => {
    await db.settings.put({ ...settings, ...patch });
    setStatusBanner('Configuration saved to local IndexedDB.');
    setTimeout(() => setStatusBanner(null), 2400);
  };

  const handleSaveBaseUrl = async () => {
    const check = validateLocalhostBaseUrl(baseUrlDraft);
    if (!check.valid) {
      setBaseUrlError(check.reason || 'Only localhost URLs are allowed.');
      return;
    }
    setBaseUrlError(null);
    setBaseUrlDraft(check.normalizedUrl);
    await updateSetting({ ollamaBaseUrl: check.normalizedUrl });
    await providerManager.checkOllamaHealth(check.normalizedUrl);
  };

  const handleTestConnection = async () => {
    const check = validateLocalhostBaseUrl(baseUrlDraft);
    if (!check.valid) {
      setBaseUrlError(check.reason || 'Only localhost URLs are allowed.');
      return;
    }
    setBaseUrlError(null);
    const res = await providerManager.checkOllamaHealth(check.normalizedUrl);
    setStatusBanner(
      res.running
        ? `Ollama Connected (${res.models.length} model${res.models.length === 1 ? '' : 's'} detected at ${check.normalizedUrl}).`
        : 'Ollama Not running or blocked by CORS at localhost.'
    );
    setTimeout(() => setStatusBanner(null), 3200);
  };

  const handleCopyCommand = async (key: string, cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedCmd(key);
      setTimeout(() => setCopiedCmd(null), 1800);
    } catch {
      // Ignore clipboard permission errors
    }
  };

  const handleExportJson = async () => {
    const json = await exportVaultAsJson();
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kavach-vault-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusBanner('Exported full IndexedDB vault as JSON.');
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        await importVaultFromJson(String(ev.target?.result || ''));
        setStatusBanner('Restored local vault from JSON archive.');
      } catch (err) {
        setStatusBanner(
          `Import error: ${err instanceof Error ? err.message : 'Invalid JSON'}`
        );
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmWipe = async () => {
    await wipeEntireVault();
    await ensureSeedData();
    setShowWipeModal(false);
    setStatusBanner('All local data wiped and reset to clean state.');
  };

  const installedOllamaModels = providerSnap.health.models;
  const currentOllamaModel = settings.ollamaModel || DEFAULT_OLLAMA_MODEL;
  const ollamaDropdownOptions = Array.from(
    new Set([
      ...installedOllamaModels.map((m) => m.name),
      currentOllamaModel,
      DEFAULT_OLLAMA_MODEL,
      'llama3.2:1b',
      'llama3.2:3b',
    ])
  );

  const setupCommands = [
    {
      id: 'install',
      step: '1. Install Ollama from ollama.com',
      cmd: 'curl -fsSL https://ollama.com/install.sh | sh',
    },
    {
      id: 'pull',
      step: '2. Pull the recommended local model',
      cmd: 'ollama pull qwen2.5:3b',
    },
    {
      id: 'origins-win',
      step: '3a. Allow browser access (Windows)',
      cmd: 'setx OLLAMA_ORIGINS "*"',
    },
    {
      id: 'origins-unix',
      step: '3b. Allow browser access (macOS / Linux)',
      cmd: 'export OLLAMA_ORIGINS="*"',
    },
    {
      id: 'serve',
      step: '4. Fully restart Ollama local server',
      cmd: 'ollama serve',
    },
    {
      id: 'local-dev',
      step: '5. Run app locally if opened on HTTPS',
      cmd: 'npm run dev',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto w-full px-6 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b kavach-divider pb-5">
        <div>
          <span className="font-editorial-label italic text-base">
            System Governance · Offline PWA &amp; Vault Controls
          </span>
          <h1 className="text-5xl sm:text-6xl font-display-bebas mt-1">
            SOVEREIGN SETTINGS
          </h1>
        </div>
        <PWAInstallButton />
      </div>

      {statusBanner && (
        <div className="kavach-card px-5 py-3 flex items-center gap-2 text-xs font-medium text-[#590907] dark:text-[#E8D2B5]">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusBanner}</span>
        </div>
      )}

      {/* 1. Provider Manager, Ollama Local Server & Generation Sliders */}
      <section className="kavach-card p-7 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b kavach-divider pb-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#590907] dark:text-[#E8D2B5]" />
            <h2 className="text-2xl font-display-bebas">
              01 · PROVIDER MANAGER, OLLAMA &amp; GENERATION SLIDERS
            </h2>
          </div>
          <span className="font-mono text-xs opacity-75">
            Active:{' '}
            {providerManager.resolveActiveBackend(settings.providerMode || 'auto') ===
            'ollama'
              ? `Ollama (${currentOllamaModel})`
              : 'Browser (WebLLM)'}
          </span>
        </div>

        {/* Privacy Guarantee Note */}
        <div className="px-4 py-2.5 rounded-xl bg-[var(--bg-page)] border kavach-divider flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 kavach-accent-text shrink-0" />
            <span className="font-medium">
              Ollama runs on your computer. Your data never leaves it.
            </span>
          </div>
          <span className="font-mono text-[11px] opacity-70 hidden sm:inline">
            localhost-only lock active
          </span>
        </div>

        {/* Provider Mode & WebLLM Model Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-editorial-label italic mb-1.5">
              Provider Mode (Auto / Ollama / Browser WebLLM)
            </label>
            <select
              value={settings.providerMode || 'auto'}
              onChange={(e) => {
                const nextMode = e.target.value as ProviderMode;
                updateSetting({
                  providerMode: nextMode,
                  engineMode: nextMode === 'ollama' ? 'ollama' : 'webgpu',
                });
              }}
              className="w-full px-3.5 py-2.5 rounded-xl bg-transparent border kavach-divider text-xs font-mono"
            >
              <option value="auto" className="bg-[#E8D2B5] text-[#1C0A0A]">
                Auto (Use Ollama if running, else Browser WebLLM)
              </option>
              <option value="ollama" className="bg-[#E8D2B5] text-[#1C0A0A]">
                Ollama (Local server)
              </option>
              <option value="webllm" className="bg-[#E8D2B5] text-[#1C0A0A]">
                Browser (WebLLM)
              </option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-editorial-label italic mb-1.5">
              Browser Fallback / WebLLM Model (`@mlc-ai/web-llm`)
            </label>
            <select
              value={settings.selectedModel}
              onChange={(e) => updateSetting({ selectedModel: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-transparent border kavach-divider text-xs font-mono"
            >
              {KAVACH_MODELS.map((m) => (
                <option key={m.id} value={m.id} className="bg-[#E8D2B5] text-[#1C0A0A]">
                  {m.tier} — {m.name} ({m.downloadSizeLabel})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Ollama Base URL, Test Connection, and Model Dropdown from /api/tags */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
          <div className="space-y-1.5">
            <label className="block text-xs font-editorial-label italic">
              Ollama Base URL (Localhost Only)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={baseUrlDraft}
                onChange={(e) => setBaseUrlDraft(e.target.value)}
                onBlur={handleSaveBaseUrl}
                placeholder="http://localhost:11434"
                className="flex-1 min-w-0 px-3.5 py-2 rounded-xl bg-transparent border kavach-divider text-xs font-mono focus:outline-none"
              />
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={providerSnap.checking}
                className="px-3.5 py-2 rounded-xl kavach-btn-accent text-xs font-medium flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${providerSnap.checking ? 'animate-spin' : ''}`}
                />
                <span>Test connection</span>
              </button>
            </div>
            {baseUrlError && (
              <p className="text-[11px] font-mono kavach-accent-text">{baseUrlError}</p>
            )}
            <div className="flex items-center justify-between text-[11px] font-mono pt-0.5">
              <span>Status:</span>
              <span
                className={
                  providerSnap.health.running
                    ? 'font-semibold'
                    : 'opacity-75'
                }
              >
                {providerSnap.health.running
                  ? `● Connected (${installedOllamaModels.length} installed)`
                  : '○ Not running'}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-editorial-label italic">
              Ollama Model (from `/api/tags`)
            </label>
            <select
              value={currentOllamaModel}
              onChange={(e) => updateSetting({ ollamaModel: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl bg-transparent border kavach-divider text-xs font-mono"
            >
              {ollamaDropdownOptions.map((modelName) => {
                const isInstalled = installedOllamaModels.some(
                  (m) => m.name === modelName
                );
                return (
                  <option
                    key={modelName}
                    value={modelName}
                    className="bg-[#E8D2B5] text-[#1C0A0A]"
                  >
                    {modelName} {isInstalled ? '(Installed)' : ''}
                  </option>
                );
              })}
            </select>
            <p className="text-[11px] font-mono opacity-70">
              {installedOllamaModels.length > 0
                ? `Loaded ${installedOllamaModels.length} model(s) from ${settings.ollamaBaseUrl || DEFAULT_OLLAMA_BASE_URL}/api/tags`
                : 'Default: qwen2.5:3b (Start Ollama to auto-list installed tags)'}
            </p>
          </div>
        </div>

        {/* Friendly Ollama Setup Help Panel when Ollama is not running */}
        {!providerSnap.health.running && (
          <div className="p-5 rounded-2xl bg-[var(--bg-page)] border kavach-divider space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 kavach-accent-text" />
                <h3 className="text-lg font-display-bebas tracking-wide">
                  OLLAMA LOCAL SERVER SETUP GUIDE
                </h3>
              </div>
              <span className="text-[11px] font-mono opacity-75">
                Optional · Browser WebLLM remains active
              </span>
            </div>

            <p className="text-xs leading-relaxed opacity-85">
              Ollama was not detected at{' '}
              <code className="font-mono">{settings.ollamaBaseUrl || DEFAULT_OLLAMA_BASE_URL}</code>.
              Kavach is currently using the in-browser engine automatically. To connect a local Ollama server on your machine, run these steps:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {setupCommands.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-[var(--bg-card)] border kavach-divider space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold">{item.step}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyCommand(item.id, item.cmd)}
                      className="px-2 py-0.5 rounded border kavach-divider text-[10px] font-mono flex items-center gap-1 cursor-pointer hover:bg-[var(--bg-page)]"
                    >
                      {copiedCmd === item.id ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <code className="block text-[11px] font-mono opacity-90 truncate">
                    {item.cmd}
                  </code>
                </div>
              ))}
            </div>

            {providerSnap.health.corsOrNetworkError && (
              <div className="p-3 rounded-xl border kavach-divider bg-[var(--bg-card)] text-xs space-y-1.5">
                <div className="font-mono font-semibold text-[11px] kavach-accent-text">
                  CORS &amp; HTTPS Localhost Hint
                </div>
                <p className="text-[11px] opacity-85 leading-relaxed">
                  If Ollama is running but fetch failed with a network/CORS error, run{' '}
                  <code className="font-mono">setx OLLAMA_ORIGINS "*"</code> (Windows) or{' '}
                  <code className="font-mono">export OLLAMA_ORIGINS="*"</code> /{' '}
                  <code className="font-mono">launchctl setenv OLLAMA_ORIGINS "*"</code>{' '}
                  (macOS/Linux), then fully quit and restart Ollama.
                </p>
                <p className="text-[11px] opacity-85 leading-relaxed">
                  Note: If this app is opened from an HTTPS site, your browser may block requests to{' '}
                  <code className="font-mono">http://localhost:11434</code>—run the app locally with{' '}
                  <code className="font-mono">npm run dev</code> for unrestricted local loopback access.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Sliders: Temperature, Top P, Repeat Penalty, Max Tokens, Context Length */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">Sampling Temperature</span>
              <span className="font-mono tabular-nums">
                {(settings.temperature ?? 0.6).toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.05"
              value={settings.temperature ?? 0.6}
              onChange={(e) => updateSetting({ temperature: parseFloat(e.target.value) })}
              className="w-full accent-[#590907] cursor-pointer"
            />
            <div className="flex justify-between text-[11px] opacity-65 font-mono">
              <span>0.0 (Deterministic)</span>
              <span>Default: 0.6</span>
              <span>1.5 (Creative)</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">Top P (`top_p`)</span>
              <span className="font-mono tabular-nums">
                {(settings.topP ?? 0.9).toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={settings.topP ?? 0.9}
              onChange={(e) => updateSetting({ topP: parseFloat(e.target.value) })}
              className="w-full accent-[#590907] cursor-pointer"
            />
            <div className="flex justify-between text-[11px] opacity-65 font-mono">
              <span>0.1 (Focused)</span>
              <span>Default: 0.9</span>
              <span>1.0</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">Repeat Penalty (`repeat_penalty`)</span>
              <span className="font-mono tabular-nums">
                {(settings.repeatPenalty ?? 1.1).toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="1.0"
              max="1.5"
              step="0.05"
              value={settings.repeatPenalty ?? 1.1}
              onChange={(e) =>
                updateSetting({ repeatPenalty: parseFloat(e.target.value) })
              }
              className="w-full accent-[#590907] cursor-pointer"
            />
            <div className="flex justify-between text-[11px] opacity-65 font-mono">
              <span>1.0 (None)</span>
              <span>Default: 1.1</span>
              <span>1.5 (Strict)</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">Max Generation Tokens</span>
              <span className="font-mono tabular-nums">{settings.maxTokens} tokens</span>
            </div>
            <input
              type="range"
              min="128"
              max="4096"
              step="128"
              value={settings.maxTokens}
              onChange={(e) => updateSetting({ maxTokens: parseInt(e.target.value, 10) })}
              className="w-full accent-[#590907] cursor-pointer"
            />
            <div className="flex justify-between text-[11px] opacity-65 font-mono">
              <span>128</span>
              <span>1024</span>
              <span>4096</span>
            </div>
          </div>

          <div className="space-y-2 md:col-span-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">Context Length (`num_ctx`)</span>
              <span className="font-mono tabular-nums">
                {settings.contextLength ?? 4096} tokens
              </span>
            </div>
            <input
              type="range"
              min="1024"
              max="16384"
              step="1024"
              value={settings.contextLength ?? 4096}
              onChange={(e) =>
                updateSetting({ contextLength: parseInt(e.target.value, 10) })
              }
              className="w-full accent-[#590907] cursor-pointer"
            />
            <div className="flex justify-between text-[11px] opacity-65 font-mono">
              <span>1024</span>
              <span>Default: 4096</span>
              <span>16384</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. System Persona Editor & Editorial Theme Toggle */}
      <section className="kavach-card p-7 space-y-5">
        <div className="flex items-center justify-between border-b kavach-divider pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#590907] dark:text-[#E8D2B5]" />
            <h2 className="text-2xl font-display-bebas">
              02 · AGENT PERSONA &amp; EDITORIAL THEME
            </h2>
          </div>

          <button
            type="button"
            onClick={() =>
              updateSetting({ theme: settings.theme === 'dark' ? 'light' : 'dark' })
            }
            className="px-3.5 py-1.5 rounded-xl border kavach-divider text-xs font-medium flex items-center gap-2 cursor-pointer"
          >
            {settings.theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5" />
                <span>Theme: Wine Dark (#1F0504)</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5" />
                <span>Theme: Sage Light (#A5A79B)</span>
              </>
            )}
          </button>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-editorial-label italic">
            System Persona Instructions
          </label>
          <textarea
            rows={4}
            value={personaDraft}
            onChange={(e) => setPersonaDraft(e.target.value)}
            className="w-full p-3.5 rounded-xl bg-transparent border kavach-divider text-xs leading-relaxed focus:outline-none focus:border-[#590907]"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => updateSetting({ persona: personaDraft })}
              className="px-4 py-2 rounded-xl bg-[#590907] hover:bg-[#7A1012] text-[#E8D2B5] text-xs font-medium cursor-pointer"
            >
              Save Persona
            </button>
          </div>
        </div>
      </section>

      {/* 3. Storage Meter, JSON Export/Import & Wipe All Data */}
      <section className="kavach-card p-7 space-y-6">
        <div className="flex items-center justify-between border-b kavach-divider pb-3">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-[#590907] dark:text-[#E8D2B5]" />
            <h2 className="text-2xl font-display-bebas">
              03 · VAULT STORAGE METER, JSON BACKUP &amp; WIPE
            </h2>
          </div>
          <span className="font-mono text-xs tabular-nums">
            {storageInfo.usageMB} MB / {storageInfo.quotaMB} MB
          </span>
        </div>

        <div className="w-full h-3 rounded-full bg-[#1C0A0A]/15 dark:bg-[#E8D2B5]/15 overflow-hidden">
          <div
            className="h-full bg-[#590907]"
            style={{
              width: `${Math.max(
                5,
                Math.min(100, (storageInfo.usageMB / storageInfo.quotaMB) * 100)
              )}%`,
            }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleExportJson}
              className="px-4 py-2.5 rounded-xl bg-[#590907] hover:bg-[#7A1012] text-[#E8D2B5] text-xs font-medium flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export All Data as JSON</span>
            </button>

            <label className="px-4 py-2.5 rounded-xl border kavach-divider text-xs font-medium flex items-center gap-2 cursor-pointer hover:bg-[#1C0A0A]/5">
              <Upload className="w-4 h-4" />
              <span>Import JSON Backup</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportJson}
                className="hidden"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={() => setShowWipeModal(true)}
            className="px-4 py-2.5 rounded-xl border border-[#590907] text-[#590907] dark:text-[#E8D2B5] hover:bg-[#590907] hover:text-[#E8D2B5] text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Wipe All Data</span>
          </button>
        </div>
      </section>

      {/* Destructive Confirmation Modal for Wipe All Data */}
      {showWipeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C0A0A]/75 p-4">
          <div className="kavach-card max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 text-[#590907] dark:text-[#E8D2B5]">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-2xl font-display-bebas">
                CONFIRM CRYPTOGRAPHIC VAULT WIPE
              </h3>
            </div>
            <p className="text-xs sm:text-sm leading-relaxed opacity-85">
              This will erase all conversations, messages, notes, tasks, reminders, indexed RAG documents, vector embeddings, and personal memory facts from IndexedDB.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowWipeModal(false)}
                className="px-4 py-2 rounded-xl border kavach-divider text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmWipe}
                className="px-4 py-2 rounded-xl bg-[#590907] hover:bg-[#7A1012] text-[#E8D2B5] text-xs font-medium cursor-pointer"
              >
                Confirm Wipe All Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
