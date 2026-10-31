# Kavach — Offline Personal AI Agent

**YOUR AI. YOUR DEVICE.**  
Kavach is a 100% offline-capable, privacy-first personal AI agent built with **React 19 + TypeScript + Vite + Tailwind CSS v4**. All intelligence, document indexing (RAG), vector embeddings, and personal productivity tools execute inside your browser using **WebGPU (`@mlc-ai/web-llm`)**, **Transformers.js (`@huggingface/transformers`)**, and **Dexie (`IndexedDB`)**.

---

## 1. Quick Setup & Running Locally

```bash
# Install dependencies
npm install

# Start development server (port 3000)
npm run dev

# Build production offline PWA bundle
npm run build
```

---

## 2. How Offline Execution Works

1. **Zero Cloud APIs**: Kavach never sends prompts, notes, tasks, or documents to external cloud LLM APIs.
2. **In-Browser WebGPU LLM (`src/workers/llm.worker.ts`)**:
   - Uses `@mlc-ai/web-llm` (`WebWorkerMLCEngineHandler`) in a dedicated Web Worker so token streaming never blocks the main UI thread.
   - Default model: `Llama-3.2-1B-Instruct-q4f16_1-MLC` (~680 MB download, cached in browser Cache Storage / IndexedDB).
   - Also includes a zero-download **On-Device Sovereign Runtime** fallback so users on machines without physical WebGPU hardware can immediately use offline chat, RAG citations, and local JSON tool calling.
3. **Local Vector RAG (`src/lib/llm/rag.ts` & `src/workers/embedding.worker.ts`)**:
   - Parses `.pdf` (via `pdfjs-dist`), `.md`, and `.txt` files locally.
   - Splits documents into overlapping chunks and computes 384-dimensional normalized embeddings (`Xenova/all-MiniLM-L6-v2` in a Web Worker with an air-gapped deterministic 384-d semantic fallback).
   - Stores chunks and vectors in Dexie (`IndexedDB`) and performs cosine similarity retrieval with source citations.
4. **Local JSON Tool Calling (`src/lib/llm/toolSchema.ts`)**:
   - Validates and repairs malformed JSON tool calls (`create_note`, `add_task`, `complete_task`, `set_reminder`, `search_notes`, `calculate`, `search_documents`, `save_memory`).
   - Displays interactive tool chips in chat with one-click **Undo** that reverts the exact IndexedDB mutation.
5. **PWA Service Worker (`vite-plugin-pwa`)**:
   - Precaches the app shell, fonts, and static assets, and caches model weights via Workbox `CacheFirst` rules. Includes `/offline.html` fallback and in-app install support (`PWAInstallButton`).

---

## 3. Changing Models & Swapping Providers

- **UI Model Switcher**: Visit **Onboarding (`/onboarding`)** or **Settings (`/settings`)** to switch between:
  - `Llama-3.2-1B-Instruct-q4f16_1-MLC` (Fast ~1B, Default)
  - `Llama-3.2-3B-Instruct-q4f16_1-MLC` (Balanced ~3B)
  - `SmolLM2-360M-Instruct-q4f16_1-MLC` (Ultra-Light ~360M)
- **Swapping WebLLM for Ollama**:
  - `src/lib/llm/types.ts` defines the `LLMProvider` interface (`checkWebGPU`, `initModel`, `generateStream`, `abort`, `getStatus`).
  - `src/lib/llm/ollamaProvider.ts` implements `OllamaProvider` (`http://localhost:11434`), streaming NDJSON tokens via `/api/chat`, listing models via `/api/tags`, and performing a 2-second health check.
  - `src/lib/llm/providerManager.ts` manages `"Auto"`, `"Ollama (Local server)"`, and `"Browser (WebLLM)"` modes, re-checking Ollama health every 15 seconds and on window focus, and automatically falling back to WebLLM if Ollama stops mid-session.

---

## 4. Ollama Setup (Local Server at `http://localhost:11434`)

Kavach can connect directly to a local Ollama instance running on your own computer. Everything stays strictly on your machine (`localhost` / `127.0.0.1` only).

### Step 1: Install Ollama
- **macOS / Windows**: Download the installer from [https://ollama.com](https://ollama.com).
- **Linux**:
  ```bash
  curl -fsSL https://ollama.com/install.sh | sh
  ```

### Step 2: Pull a Recommended Model
```bash
ollama pull qwen2.5:3b
```
*(You can also pull `llama3.2:1b` or `llama3.2:3b`—all installed models appear automatically in the Settings dropdown via `GET /api/tags`.)*

### Step 3: Set `OLLAMA_ORIGINS` (Required for Browser CORS)
Because Kavach runs in a browser tab, Ollama needs permission to accept requests from your browser origin:

- **macOS / Linux Terminal**:
  ```bash
  export OLLAMA_ORIGINS="*"
  ollama serve
  ```
- **macOS Menu Bar App**:
  ```bash
  launchctl setenv OLLAMA_ORIGINS "*"
  ```
  Then quit and restart the Ollama app from the menu bar.
- **Windows (Command Prompt / PowerShell)**:
  ```cmd
  setx OLLAMA_ORIGINS "*"
  ```
  Then fully quit Ollama from the system tray and restart it (`ollama serve`).

### Step 4: Troubleshooting
- **"Not running" status in Settings**: Verify `curl http://localhost:11434/api/tags` returns JSON in your terminal.
- **CORS / Network Error**: If `curl` works in terminal but the browser shows a CORS hint, make sure `OLLAMA_ORIGINS="*"` is set (`setx OLLAMA_ORIGINS "*"` on Windows or `export OLLAMA_ORIGINS="*"` on macOS/Linux) **before** starting `ollama serve`, and stop any background Ollama service that was launched without `OLLAMA_ORIGINS`.
- **HTTPS Mixed-Content / Localhost Block**: If the app is opened from an HTTPS URL, browsers may block requests to `http://localhost:11434`. Run the app locally with `npm run dev` for direct localhost access.
- **Auto Fallback**: In **Auto** mode, if you stop Ollama mid-session, Kavach automatically switches to **Browser (WebLLM)** and shows a notification toast so your chat continues uninterrupted.


---

## 5. Editorial Design System & GSAP Animation Guide

- **Palette**: Sage `#A5A79B` (light page bg), Cream `#E8D2B5` (matte 20px cards), Burgundy `#590907` (CTAs, user bubbles, `<DiagonalSlash />`), Burgundy Hover `#7A1012`, Ink `#1C0A0A`, Wine `#1F0504` (dark mode bg).
- **Typography**: `Bebas Neue` (uppercase display headings), `Cormorant Garamond` (editorial labels), `Inter` (body prose), `JetBrains Mono` (code & tabular metrics).
- **GSAP Helpers (`src/lib/animations/index.ts`)**:
  - `wipeIn`, `revealText`, `fadeUp`, `staggerIn`, `countUp`, `magneticHover`, `pageTransition`.
  - Respects `prefers-reduced-motion` via `gsap.matchMedia()` and cleans up `ScrollTrigger` instances on unmount.

---

## 6. Known Limitations

- **First-Run WebGPU Model Download**: Downloading `Llama-3.2-1B-Instruct` (~680 MB) requires network access once to populate the browser's persistent Cache Storage; subsequent runs work completely offline.
- **Browser WebGPU Support**: Full hardware-accelerated WebGPU requires Chromium 113+, Edge, or Safari 18+ with hardware acceleration enabled. On unsupported GPUs or sandboxed VMs, switch to **Ollama (Local server)** or **Instant On-Device Runtime** in Onboarding or Settings.

"# Kavach" 
"# Hacktoberfest--kavach" 
