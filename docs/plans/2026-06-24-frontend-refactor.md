# Frontend Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the monolithic `public/index.html` (4450 lines) into a modular Svelte + Vite SPA, referencing open-webui's architecture, while keeping the existing Express backend unchanged.

**Architecture:** Svelte + Vite as frontend SPA, built output served by existing Express server. Components organized by feature domain (chat/, editor/, files/, models/, common/), state managed via Svelte writable stores, API calls isolated in apis/ directory. Single-process deployment for Railway/Fly.io/Render compatibility.

**Tech Stack:** Svelte 4, Vite 5, svelte-routing, Express (existing backend unchanged)

---

## File Structure

```
g:\claude.free\
├── src/
│   ├── server/
│   │   └── index.js                    # [UNCHANGED] Express backend
│   └── client/
│       ├── App.svelte                   # Root component (layout + routing)
│       ├── main.js                      # Svelte entry point
│       ├── components/
│       │   ├── chat/
│       │   │   ├── ChatPanel.svelte     # Chat message list + welcome screen
│       │   │   ├── ChatMessage.svelte   # Single message (user/assistant/system)
│       │   │   ├── ChatInput.svelte     # Input bar with @ file refs + / commands
│       │   │   └── CodeBlock.svelte     # Code block with copy button
│       │   ├── editor/
│       │   │   ├── CodeEditor.svelte    # Textarea editor with gutter
│       │   │   └── EditorTabs.svelte    # Tab bar for open files
│       │   ├── files/
│       │   │   ├── FileTree.svelte      # File tree browser
│       │   │   └── FileItem.svelte      # Single tree item (file/folder)
│       │   ├── models/
│       │   │   ├── ModelSelector.svelte # Toolbar model button + dropdown
│       │   │   ├── ConfigModal.svelte   # Model config modal (provider/model/manage tabs)
│       │   │   └── ModelList.svelte     # Saved models list in manage tab
│       │   └── common/
│       │       ├── Toolbar.svelte       # Top toolbar bar
│       │       ├── Icon.svelte          # SVG icon component
│       │       ├── Modal.svelte         # Reusable modal overlay
│       │       └── ContextMenu.svelte   # Right-click context menu
│       ├── stores/
│       │   ├── chat.store.js            # Messages, typing state, token stats
│       │   ├── files.store.js           # File tree, current file, file contents
│       │   ├── session.store.js         # Session ID/token, WebSocket, connection state
│       │   └── models.store.js          # Saved models, active model, provider config
│       ├── apis/
│       │   ├── session.api.js           # POST/GET/DELETE /api/session
│       │   ├── files.api.js             # GET/POST /api/files/*
│       │   └── models.api.js            # GET /api/models, /api/config
│       ├── lib/
│       │   ├── websocket.js             # WebSocket connection manager
│       │   └── utils.js                 # escapeHtml, formatNumber, stripAnsi, etc.
│       └── styles/
│           └── global.css               # CSS variables + base styles (from existing)
├── old-public/
│   └── index.html                       # Backup of old frontend
├── public/                              # Vite build output (gitignored)
├── package.json                         # Updated with Svelte + Vite deps
├── vite.config.js                       # Vite config (outDir: public)
├── svelte.config.js                     # Svelte preprocessor config
├── Dockerfile                           # Updated: build frontend then start
└── .gitignore                           # Updated: ignore public/ build output
```

---

## Task 1: Project Setup - Install Dependencies and Configure Build Tools

**Files:**
- Modify: `package.json`
- Create: `vite.config.js`
- Create: `svelte.config.js`
- Modify: `.gitignore`

- [ ] **Step 1: Install Svelte + Vite dependencies**

Run:
```powershell
cd g:\claude.free
npm install --save-dev vite @sveltejs/vite-plugin-svelte svelte
```

- [ ] **Step 2: Create `vite.config.js`**

```javascript
// g:\claude.free\vite.config.js
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
  plugins: [svelte()],
  root: 'src/client',
  build: {
    outDir: '../../public',
    emptyOutDir: true
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/ws': { target: 'ws://localhost:3000', ws: true }
    }
  },
  resolve: {
    alias: {
      '$components': path.resolve('src/client/components'),
      '$stores': path.resolve('src/client/stores'),
      '$apis': path.resolve('src/client/apis'),
      '$lib': path.resolve('src/client/lib')
    }
  }
});
```

- [ ] **Step 3: Create `svelte.config.js`**

```javascript
// g:\claude.free\svelte.config.js
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess()
};
```

- [ ] **Step 4: Update `.gitignore` to exclude build output**

Add to `.gitignore`:
```
public/build/
public/*.js
public/*.css
public/favicon.ico
node_modules/
```

- [ ] **Step 5: Update `package.json` scripts**

Add these scripts to `package.json`:
```json
{
  "scripts": {
    "dev": "node src/server/index.js",
    "dev:client": "vite",
    "build": "vite build",
    "start": "NODE_ENV=production node src/server/index.js",
    "preview": "vite preview"
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add package.json vite.config.js svelte.config.js .gitignore
git commit -m "chore: add Svelte + Vite build tooling"
```

---

## Task 2: Create Entry Point and Global Styles

**Files:**
- Create: `src/client/index.html`
- Create: `src/client/main.js`
- Create: `src/client/styles/global.css`

- [ ] **Step 1: Create `src/client/index.html`**

```html
<!-- g:\claude.free\src\client\index.html -->
<!DOCTYPE html>
<html lang="zh-CN" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#0a0a0c">
  <title>Free Code</title>
  <link rel="stylesheet" href="/styles/global.css">
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `src/client/main.js`**

```javascript
// g:\claude.free\src\client\main.js
import App from './App.svelte';
import './styles/global.css';

const app = new App({
  target: document.getElementById('app')
});

export default app;
```

- [ ] **Step 3: Extract CSS variables and base styles to `src/client/styles/global.css`**

Extract from `old-public/index.html` lines 1-50 (the `:root` variables and base styles):

```css
/* g:\claude.free\src\client\styles\global.css */
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');

* { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --bg-base: #0a0a0c;
  --bg-raised: #111114;
  --bg-panel: #15151a;
  --bg-code: #1a1a20;
  --bg-toolbar: #0d0d10;
  --bg-input: rgba(255,255,255,0.08);
  --bg-hover: rgba(255,255,255,0.04);
  --bg-accent-dim: rgba(217,119,6,0.1);
  --bg-accent-dim2: rgba(217,119,6,0.15);
  --border: rgba(255,255,255,0.06);
  --border-hover: rgba(217,119,6,0.3);
  --text-primary: #e5e5e5;
  --text-secondary: #c4c4c4;
  --text-muted: #8b8b9e;
  --text-dim: #6b6b80;
  --amber: #d97706;
  --amber-bright: #f59e0b;
  --green: #22c55e;
  --red: #ef4444;
  --blue: #3b82f6;
  --cyan: #67e8f9;
  --font-sans: 'PingFang SC','Hiragino Sans GB','Microsoft YaHei',ui-sans-serif,system-ui,-apple-system,sans-serif;
  --font-mono: 'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,monospace;
}

html, body {
  height: 100%;
  font-family: var(--font-sans);
  background: var(--bg-base);
  color: var(--text-primary);
  overflow: hidden;
  font-size: 13px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Scrollbar styles */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
::-webkit-scrollbar-track { background: transparent; }

/* Animation keyframes */
@keyframes msgFadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes logoFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

@keyframes statusPulse {
  0%, 100% { transform: scale(1); opacity: 0.4; }
  50% { transform: scale(1.8); opacity: 0; }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/client/index.html src/client/main.js src/client/styles/global.css
git commit -m "feat: add Svelte entry point and global styles"
```

---

## Task 3: Create Utility Library

**Files:**
- Create: `src/client/lib/utils.js`

- [ ] **Step 1: Extract utility functions from old index.html**

```javascript
// g:\claude.free\src\client\lib\utils.js

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(str) {
  if (!str) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return str.replace(/[&<>"']/g, c => map[c]);
}

/**
 * Format large numbers with K/M suffixes
 */
export function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

/**
 * Strip ANSI escape codes from terminal output
 */
export function stripAnsi(str) {
  str = str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
  str = str.replace(/\x1b\][^\x07]*\x07/g, '');
  str = str.replace(/\x1b\[[?]\d+[hl]/g, '');
  str = str.replace(/\x1b\[\d+;\d+[A-H]/g, '');
  str = str.replace(/\x1b\[(\d+)C/g, (_, n) => ' '.repeat(parseInt(n)));
  return str;
}

/**
 * Encode file path for URL (handle special chars)
 */
export function encodeFilePath(filePath) {
  return filePath.split('/').map(encodeURIComponent).join('/');
}

/**
 * Get file extension for icon mapping
 */
export function getFileExtension(filename) {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

/**
 * Format file size to human readable
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Generate unique ID
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Debounce function
 */
export function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/client/lib/utils.js
git commit -m "feat: add utility library"
```

---

## Task 4: Create API Layer

**Files:**
- Create: `src/client/apis/session.api.js`
- Create: `src/client/apis/files.api.js`
- Create: `src/client/apis/models.api.js`

- [ ] **Step 1: Create session API**

```javascript
// g:\claude.free\src\client\apis\session.api.js

const BASE = '';

export async function createSession(apiKey, model, provider) {
  const res = await fetch(`${BASE}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, model, provider })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function getSession(sessionId, token) {
  const res = await fetch(`${BASE}/api/session/${sessionId}`, {
    headers: { 'x-session-token': token || '' }
  });
  if (!res.ok) throw new Error('Invalid session');
  return res.json();
}

export async function deleteSession(sessionId, token, csrfToken) {
  const res = await fetch(`${BASE}/api/session/${sessionId}`, {
    method: 'DELETE',
    headers: {
      'x-session-token': token || '',
      'x-csrf-token': csrfToken || ''
    }
  });
  return res.json();
}
```

- [ ] **Step 2: Create files API**

```javascript
// g:\claude.free\src\client\apis\files.api.js
import { encodeFilePath } from '$lib/utils.js';

const BASE = '';

export async function getFileTree(sessionId, token) {
  const res = await fetch(`${BASE}/api/files/${sessionId}`, {
    headers: { 'x-session-token': token || '' }
  });
  if (!res.ok) throw new Error('Failed to load file tree');
  return res.json();
}

export async function readFile(sessionId, filePath, token) {
  const res = await fetch(`${BASE}/api/files/${sessionId}/${encodeFilePath(filePath)}`, {
    headers: { 'x-session-token': token || '' }
  });
  if (!res.ok) throw new Error('Failed to read file');
  return res.json();
}

export async function writeFile(sessionId, filePath, content, token, csrfToken) {
  const res = await fetch(`${BASE}/api/files/${sessionId}/${encodeFilePath(filePath)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-session-token': token || '',
      'x-csrf-token': csrfToken || ''
    },
    body: JSON.stringify({ content })
  });
  if (!res.ok) throw new Error('Failed to write file');
  return res.json();
}

export async function deleteFile(sessionId, filePath, token, csrfToken) {
  const res = await fetch(`${BASE}/api/files/${sessionId}/${encodeFilePath(filePath)}`, {
    method: 'DELETE',
    headers: {
      'x-session-token': token || '',
      'x-csrf-token': csrfToken || ''
    }
  });
  if (!res.ok) throw new Error('Failed to delete file');
  return res.json();
}
```

- [ ] **Step 3: Create models API**

```javascript
// g:\claude.free\src\client\apis\models.api.js

const BASE = '';

export async function fetchModels(provider) {
  const url = provider
    ? `${BASE}/api/models?provider=${provider}`
    : `${BASE}/api/models`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch models');
  return res.json();
}

export async function fetchConfig() {
  const res = await fetch(`${BASE}/api/config`);
  if (!res.ok) throw new Error('Failed to fetch config');
  return res.json();
}

export async function fetchHealth() {
  const res = await fetch(`${BASE}/api/health`);
  if (!res.ok) throw new Error('Failed to fetch health');
  return res.json();
}
```

- [ ] **Step 4: Commit**

```bash
git add src/client/apis/
git commit -m "feat: add API layer (session, files, models)"
```

---

## Task 5: Create Svelte Stores

**Files:**
- Create: `src/client/stores/chat.store.js`
- Create: `src/client/stores/files.store.js`
- Create: `src/client/stores/session.store.js`
- Create: `src/client/stores/models.store.js`

- [ ] **Step 1: Create chat store**

```javascript
// g:\claude.free\src\client\stores\chat.store.js
import { writable, derived } from 'svelte/store';

export const messages = writable([]);
export const isWaiting = writable(false);
export const isTyping = writable(false);

export const tokenStats = writable({
  input: 0,
  inputMax: 200000,
  output: 0,
  outputMax: 16000
});

export const toolUsage = writable({});

export function addMessage(role, content, meta) {
  messages.update(msgs => [...msgs, {
    id: Date.now() + Math.random(),
    role,
    content,
    meta: meta || null,
    time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }]);
}

export function clearMessages() {
  messages.set([]);
  tokenStats.set({ input: 0, inputMax: 200000, output: 0, outputMax: 16000 });
  toolUsage.set({});
}

export function appendToLastAssistant(text) {
  messages.update(msgs => {
    const last = msgs[msgs.length - 1];
    if (last && last.role === 'assistant') {
      return [...msgs.slice(0, -1), { ...last, content: last.content + text }];
    }
    return msgs;
  });
}
```

- [ ] **Step 2: Create files store**

```javascript
// g:\claude.free\src\client\stores\files.store.js
import { writable, derived } from 'svelte/store';

export const fileTree = writable([]);
export const fileContents = writable({});
export const currentFile = writable(null);
export const currentFileContent = writable('');
export const openTabs = writable([]);
export const activeTab = writable(null);

export const allFilePaths = derived(fileTree, ($tree) => {
  const paths = [];
  function collect(items) {
    for (const item of items) {
      if (item.type === 'file') paths.push(item.path);
      if (item.children) collect(item.children);
    }
  }
  collect($tree);
  return paths;
});

export function openFile(path, content) {
  fileContents.update(fc => ({ ...fc, [path]: content }));
  currentFile.set(path);
  currentFileContent.set(content);

  openTabs.update(tabs => {
    if (!tabs.includes(path)) return [...tabs, path];
    return tabs;
  });
  activeTab.set(path);
}

export function closeTab(path) {
  openTabs.update(tabs => tabs.filter(t => t !== path));
  activeTab.update(current => {
    if (current === path) return null;
    return current;
  });
  fileContents.update(fc => {
    const copy = { ...fc };
    delete copy[path];
    return copy;
  });
}

export function updateFileContent(path, content) {
  fileContents.update(fc => ({ ...fc, [path]: content }));
  currentFile.update(cf => {
    if (cf === path) currentFileContent.set(content);
    return cf;
  });
}
```

- [ ] **Step 3: Create session store**

```javascript
// g:\claude.free\src\client\stores\session.store.js
import { writable, derived } from 'svelte/store';

export const sessionId = writable(null);
export const sessionToken = writable(null);
export const csrfToken = writable(null);
export const isConnected = writable(false);
export const connectionStatus = writable('disconnected'); // 'disconnected' | 'connecting' | 'connected' | 'error'

export const hasSession = derived(
  [sessionId, sessionToken],
  ([$sessionId, $sessionToken]) => !!$sessionId && !!$sessionToken
);

export function setSession(id, token, csrf) {
  sessionId.set(id);
  sessionToken.set(token);
  csrfToken.set(csrf);
}

export function clearSession() {
  sessionId.set(null);
  sessionToken.set(null);
  csrfToken.set(null);
  isConnected.set(false);
  connectionStatus.set('disconnected');
}
```

- [ ] **Step 4: Create models store**

```javascript
// g:\claude.free\src\client\stores\models.store.js
import { writable, derived } from 'svelte/store';

const STORAGE_KEY_MODELS = 'savedModels';
const STORAGE_KEY_ACTIVE = 'activeModelId';

function loadFromStorage(key, fallback) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch { return fallback; }
}

export const savedModels = writable(loadFromStorage(STORAGE_KEY_MODELS, []));
export const activeModelId = writable(loadFromStorage(STORAGE_KEY_ACTIVE, ''));
export const currentModelName = writable('');
export const modelHealth = writable('unknown'); // 'unknown' | 'ok' | 'retrying' | 'error'

savedModels.subscribe(val => {
  try { localStorage.setItem(STORAGE_KEY_MODELS, JSON.stringify(val)); } catch {}
});

activeModelId.subscribe(val => {
  try { localStorage.setItem(STORAGE_KEY_ACTIVE, JSON.stringify(val)); } catch {}
});

export const activeModel = derived(
  [savedModels, activeModelId],
  ([$savedModels, $activeModelId]) => $savedModels.find(m => m.id === $activeModelId) || null
);

export function addModel(model) {
  savedModels.update(models => [...models, { ...model, id: 'model_' + Date.now() }]);
}

export function removeModel(modelId) {
  savedModels.update(models => models.filter(m => m.id !== modelId));
  activeModelId.update(id => id === modelId ? '' : id);
}

export function switchModel(modelId) {
  activeModelId.set(modelId);
}
```

- [ ] **Step 5: Commit**

```bash
git add src/client/stores/
git commit -m "feat: add Svelte stores (chat, files, session, models)"
```

---

## Task 6: Create WebSocket Manager

**Files:**
- Create: `src/client/lib/websocket.js`

- [ ] **Step 1: Create WebSocket connection manager**

```javascript
// g:\claude.free\src\client\lib\websocket.js
import { isConnected, connectionStatus, sessionId, sessionToken } from '$stores/session.store.js';
import { addMessage, appendToLastAssistant, isWaiting, isTyping } from '$stores/chat.store.js';
import { stripAnsi } from '$lib/utils.js';

let ws = null;
let retryTimeoutId = null;

export function connectWebSocket(sid, token) {
  if (ws) {
    ws.onclose = null;
    ws.close();
  }

  connectionStatus.set('connecting');

  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${protocol}//${location.host}/ws?sessionId=${sid}&token=${token}`;

  ws = new WebSocket(url);

  ws.onopen = () => {
    isConnected.set(true);
    connectionStatus.set('connected');
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleServerMessage(msg);
    } catch (e) {
      // Non-JSON message (raw terminal output)
      const text = stripAnsi(event.data);
      if (text.trim()) {
        appendToLastAssistant(text);
      }
    }
  };

  ws.onclose = () => {
    isConnected.set(false);
    connectionStatus.set('disconnected');
    isWaiting.set(false);
    isTyping.set(false);
  };

  ws.onerror = () => {
    connectionStatus.set('error');
  };
}

export function sendInput(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'input', data }));
  }
}

export function disconnectWebSocket() {
  if (ws) {
    ws.onclose = null;
    ws.close();
    ws = null;
  }
  isConnected.set(false);
  connectionStatus.set('disconnected');
}

function handleServerMessage(msg) {
  switch (msg.type) {
    case 'output':
      appendToLastAssistant(stripAnsi(msg.data || ''));
      break;
    case 'done':
      isWaiting.set(false);
      isTyping.set(false);
      break;
    case 'error':
      isWaiting.set(false);
      isTyping.set(false);
      addMessage('system', msg.message || 'Unknown error');
      break;
    case 'model_update':
      // Update model health
      break;
    default:
      break;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/client/lib/websocket.js
git commit -m "feat: add WebSocket connection manager"
```

---

## Task 7: Create Common Components (Icon, Modal, Toolbar, ContextMenu)

**Files:**
- Create: `src/client/components/common/Icon.svelte`
- Create: `src/client/components/common/Modal.svelte`
- Create: `src/client/components/common/ContextMenu.svelte`

- [ ] **Step 1: Create Icon component**

```svelte
<!-- g:\claude.free\src\client\components\common\Icon.svelte -->
<script>
  export let name;
  export let size = 'md'; // sm, md, lg
  export let className = '';

  const sizeMap = { sm: 12, md: 16, lg: 20 };
  $: px = sizeMap[size] || 16;

  const icons = {
    folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
    file: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/>',
    send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68 1.65 1.65 0 0 0 10 3.17V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    chevronRight: '<polyline points="9 18 15 12 9 6"/>',
    chevronDown: '<polyline points="6 9 12 15 18 9"/>',
    menu: '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
    refresh: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>'
  };
</script>

<svg
  class="icon {className}"
  width="{px}"
  height="{px}"
  viewBox="0 0 24 24"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  fill="none"
  stroke="currentColor"
>
  {@html icons[name] || ''}
</svg>

<style>
  .icon {
    flex-shrink: 0;
  }
</style>
```

- [ ] **Step 2: Create Modal component**

```svelte
<!-- g:\claude.free\src\client\components\common\Modal.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';

  export let open = false;
  export let title = '';
  export let width = '500px';

  const dispatch = createEventDispatcher();

  function handleClose() {
    open = false;
    dispatch('close');
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') handleClose();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
  <div class="modal-overlay" on:click={handleClose} on:keydown>
    <div class="modal-content" style="max-width: {width}" on:click|stopPropagation on:keydown>
      <div class="modal-header">
        <h3 class="modal-title">{title}</h3>
        <button class="modal-close" on:click={handleClose}>&times;</button>
      </div>
      <div class="modal-body">
        <slot />
      </div>
      {#if $$slots.footer}
        <div class="modal-footer">
          <slot name="footer" />
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.15s ease;
  }

  .modal-content {
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 12px;
    width: 90%;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
    animation: slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
  }

  .modal-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .modal-close {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 20px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
  }

  .modal-close:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .modal-body {
    padding: 20px;
    overflow-y: auto;
    flex: 1;
  }

  .modal-footer {
    padding: 12px 20px;
    border-top: 1px solid var(--border);
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(12px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
</style>
```

- [ ] **Step 3: Create ContextMenu component**

```svelte
<!-- g:\claude.free\src\client\components\common\ContextMenu.svelte -->
<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';

  export let items = [];
  export let x = 0;
  export let y = 0;
  export let open = false;

  const dispatch = createEventDispatcher();

  function handleClick(item) {
    if (item.disabled) return;
    dispatch('select', item);
    open = false;
  }

  function handleOutsideClick(e) {
    if (open) {
      open = false;
    }
  }

  function handleKeydown(e) {
    if (e.key === 'Escape' && open) {
      open = false;
    }
  }
</script>

<svelte:window on:click={handleOutsideClick} on:keydown={handleKeydown} />

{#if open}
  <div
    class="context-menu"
    style="left: {x}px; top: {y}px;"
    on:click|stopPropagation
  >
    {#each items as item}
      {#if item.separator}
        <div class="context-sep"></div>
      {:else}
        <div
          class="context-item"
          class:disabled={item.disabled}
          on:click={() => handleClick(item)}
          on:keydown
        >
          <span class="ci-icon">{item.icon || ''}</span>
          <span class="ci-label">{item.label}</span>
          {#if item.shortcut}
            <span class="ci-shortcut">{item.shortcut}</span>
          {/if}
        </div>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .context-menu {
    position: fixed;
    min-width: 180px;
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 4px;
    z-index: 500;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    animation: ctxFadeIn 0.1s ease;
  }

  .context-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    color: var(--text-secondary);
    transition: background 0.15s ease;
  }

  .context-item:hover {
    background: var(--bg-accent-dim2);
    color: var(--text-primary);
  }

  .context-item.disabled {
    opacity: 0.4;
    pointer-events: none;
  }

  .ci-icon { width: 18px; text-align: center; font-size: 14px; }
  .ci-label { flex: 1; }
  .ci-shortcut { font-size: 11px; color: var(--text-dim); font-family: var(--font-mono); }

  .context-sep {
    height: 1px;
    background: var(--border);
    margin: 4px 8px;
  }

  @keyframes ctxFadeIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }
</style>
```

- [ ] **Step 4: Commit**

```bash
git add src/client/components/common/
git commit -m "feat: add common components (Icon, Modal, ContextMenu)"
```

---

## Task 8: Create Chat Components

**Files:**
- Create: `src/client/components/chat/CodeBlock.svelte`
- Create: `src/client/components/chat/ChatMessage.svelte`
- Create: `src/client/components/chat/ChatInput.svelte`
- Create: `src/client/components/chat/ChatPanel.svelte`

- [ ] **Step 1: Create CodeBlock component**

```svelte
<!-- g:\claude.free\src\client\components\chat\CodeBlock.svelte -->
<script>
  import Icon from '$components/common/Icon.svelte';

  export let code = '';
  export let language = '';

  let copied = false;

  async function copyCode() {
    await navigator.clipboard.writeText(code);
    copied = true;
    setTimeout(() => copied = false, 2000);
  }
</script>

<div class="code-block">
  <div class="code-block-hdr">
    <span>{language || 'code'}</span>
    <button class="copy-btn" class:copied on:click={copyCode}>
      <Icon name="copy" size="sm" />
      {copied ? 'Copied' : 'Copy'}
    </button>
  </div>
  <pre><code>{code}</code></pre>
</div>

<style>
  .code-block {
    margin: 10px 0;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--border);
    background: var(--bg-code);
  }

  .code-block-hdr {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid var(--border);
    font-size: 11px;
    color: var(--text-dim);
    font-family: var(--font-mono);
  }

  .copy-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 4px;
    transition: all 0.15s;
  }

  .copy-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
  .copy-btn.copied { color: var(--green); }

  pre {
    margin: 0;
    padding: 12px 16px;
    overflow-x: auto;
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.6;
  }
</style>
```

- [ ] **Step 2: Create ChatMessage component**

```svelte
<!-- g:\claude.free\src\client\components\chat\ChatMessage.svelte -->
<script>
  import CodeBlock from './CodeBlock.svelte';
  import { escapeHtml } from '$lib/utils.js';

  export let role = 'user';
  export let content = '';
  export let time = '';

  $: roleLabel = role === 'user' ? 'You' : role === 'assistant' ? 'Assistant' : 'System';

  // Parse content for code blocks
  $: parsedParts = parseContent(content);

  function parseContent(text) {
    const parts = [];
    const regex = /```(\w*)\n?([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
      }
      parts.push({ type: 'code', language: match[1], content: match[2].trim() });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push({ type: 'text', content: text.slice(lastIndex) });
    }

    return parts;
  }
</script>

<div class="chat-msg {role}">
  <div class="chat-msg-header">
    <span class="chat-msg-role">{roleLabel}</span>
    {#if time}
      <span class="chat-msg-time">{time}</span>
    {/if}
  </div>
  <div class="chat-msg-body">
    {#each parsedParts as part}
      {#if part.type === 'code'}
        <CodeBlock code={part.content} language={part.language} />
      {:else}
        <span class="text-content">{part.content}</span>
      {/if}
    {/each}
  </div>
</div>

<style>
  .chat-msg {
    padding: 12px 24px;
    animation: msgFadeUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .chat-msg-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .chat-msg-role {
    font-size: 12px;
    font-weight: 600;
  }

  .user .chat-msg-role { color: var(--text-primary); }
  .assistant .chat-msg-role { color: var(--amber); }
  .system .chat-msg-role { color: var(--text-dim); }

  .chat-msg-time {
    font-size: 11px;
    color: var(--text-dim);
  }

  .chat-msg-body {
    font-size: 14px;
    line-height: 1.7;
    color: var(--text-secondary);
  }

  .text-content {
    white-space: pre-wrap;
    word-break: break-word;
  }

  :global(code) {
    background: var(--bg-code);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: var(--font-mono);
    font-size: 12px;
  }
</style>
```

- [ ] **Step 3: Create ChatInput component**

```svelte
<!-- g:\claude.free\src\client\components\chat\ChatInput.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';
  import Icon from '$components/common/Icon.svelte';
  import { isWaiting } from '$stores/chat.store.js';

  const dispatch = createEventDispatcher();

  let inputText = '';
  let textarea;

  function handleSend() {
    const text = inputText.trim();
    if (!text || $isWaiting) return;
    dispatch('send', text);
    inputText = '';
    textarea.focus();
  }

  function handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }
</script>

<div class="chat-input-bar">
  <div class="input-wrapper">
    <textarea
      bind:this={textarea}
      bind:value={inputText}
      on:keydown={handleKeydown}
      placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
      rows="1"
      disabled={$isWaiting}
    ></textarea>
    <button
      class="send-btn"
      on:click={handleSend}
      disabled={$isWaiting || !inputText.trim()}
    >
      <Icon name="send" size="md" />
    </button>
  </div>
</div>

<style>
  .chat-input-bar {
    padding: 12px 24px;
    border-top: 1px solid var(--border);
    background: var(--bg-toolbar);
    flex-shrink: 0;
  }

  .input-wrapper {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 12px;
    transition: border-color 0.2s;
  }

  .input-wrapper:focus-within {
    border-color: var(--border-hover);
  }

  textarea {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    color: var(--text-primary);
    font-family: var(--font-sans);
    font-size: 14px;
    line-height: 1.5;
    resize: none;
    min-height: 24px;
    max-height: 120px;
  }

  textarea::placeholder {
    color: var(--text-dim);
  }

  textarea:disabled {
    opacity: 0.5;
  }

  .send-btn {
    background: var(--amber);
    border: none;
    color: var(--bg-base);
    width: 32px;
    height: 32px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.15s, opacity 0.15s;
  }

  .send-btn:hover:not(:disabled) {
    background: var(--amber-bright);
  }

  .send-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
</style>
```

- [ ] **Step 4: Create ChatPanel component**

```svelte
<!-- g:\claude.free\src\client\components\chat\ChatPanel.svelte -->
<script>
  import ChatMessage from './ChatMessage.svelte';
  import ChatInput from './ChatInput.svelte';
  import { messages, isWaiting } from '$stores/chat.store.js';
  import { afterUpdate } from 'svelte';

  let messagesContainer;

  afterUpdate(() => {
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  });

  function handleSend(e) {
    // Will be connected to sendCommand logic
    console.log('Send:', e.detail);
  }
</script>

<div class="chat-area">
  <div class="chat-messages" bind:this={messagesContainer}>
    {#if $messages.length === 0}
      <div class="chat-welcome">
        <div class="logo">&#9881;</div>
        <div class="title">Free Code</div>
        <div class="subtitle">AI-powered coding assistant</div>
        <div class="suggestions">
          <button class="suggestion" data-text="帮我创建一个 React 项目">创建一个 React 项目</button>
          <button class="suggestion" data-text="解释当前项目结构">解释项目结构</button>
          <button class="suggestion" data-text="帮我修复一个 bug">修复一个 bug</button>
          <button class="suggestion" data-text="/help">查看帮助</button>
        </div>
      </div>
    {:else}
      {#each $messages as msg (msg.id)}
        <ChatMessage role={msg.role} content={msg.content} time={msg.time} />
      {/each}
    {/if}

    {#if $isWaiting}
      <div class="typing-indicator">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      </div>
    {/if}
  </div>

  <ChatInput on:send={handleSend} />
</div>

<style>
  .chat-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  }

  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px 0;
  }

  .chat-welcome {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-dim);
    text-align: center;
    padding: 24px;
  }

  .chat-welcome .logo {
    font-size: 36px;
    margin-bottom: 12px;
    color: var(--amber);
    opacity: 0.6;
    animation: logoFloat 3s ease-in-out infinite;
  }

  .chat-welcome .title {
    font-size: 16px;
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: 6px;
  }

  .chat-welcome .subtitle {
    font-size: 13px;
    margin-bottom: 20px;
  }

  .suggestions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    width: 100%;
    max-width: 480px;
  }

  .suggestion {
    padding: 10px 16px;
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 13px;
    font-family: var(--font-sans);
    transition: all 0.15s;
    text-align: left;
  }

  .suggestion:hover {
    background: var(--bg-accent-dim);
    border-color: var(--border-hover);
    color: var(--text-primary);
  }

  .typing-indicator {
    display: flex;
    gap: 4px;
    padding: 12px 24px;
  }

  .typing-indicator .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--amber);
    animation: typingBounce 1.4s ease-in-out infinite;
  }

  .typing-indicator .dot:nth-child(2) { animation-delay: 0.2s; }
  .typing-indicator .dot:nth-child(3) { animation-delay: 0.4s; }

  @keyframes typingBounce {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
    30% { transform: translateY(-4px); opacity: 1; }
  }
</style>
```

- [ ] **Step 5: Commit**

```bash
git add src/client/components/chat/
git commit -m "feat: add chat components (ChatPanel, ChatMessage, ChatInput, CodeBlock)"
```

---

## Task 9: Create File Tree Components

**Files:**
- Create: `src/client/components/files/FileItem.svelte`
- Create: `src/client/components/files/FileTree.svelte`

- [ ] **Step 1: Create FileItem component**

```svelte
<!-- g:\claude.free\src\client\components\files\FileItem.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';
  import Icon from '$components/common/Icon.svelte';

  export let item;
  export let depth = 0;
  export let isActive = false;

  const dispatch = createEventDispatcher();

  let isOpen = false;

  function toggle() {
    if (item.type === 'directory') {
      isOpen = !isOpen;
    }
    dispatch('select', item);
  }
</script>

<div class="tree-item {item.type}" class:active={isActive} style="padding-left: {depth * 16 + 12}px">
  {#if item.type === 'directory'}
    <span class="arrow">
      <Icon name={isOpen ? 'chevronDown' : 'chevronRight'} size="sm" />
    </span>
  {:else}
    <span class="arrow"></span>
  {/if}

  <Icon name={item.type === 'directory' ? 'folder' : 'file'} size="md" />

  <span class="tree-label" on:click={toggle} on:keydown>
    {item.name}
  </span>
</div>

{#if item.type === 'directory' && isOpen && item.children}
  {#each item.children as child}
    <svelte:self item={child} depth={depth + 1} {isActive} on:select />
  {/each}
{/if}

<style>
  .tree-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    cursor: pointer;
    font-size: 13px;
    color: var(--text-secondary);
    transition: background 0.15s ease, color 0.15s ease;
    white-space: nowrap;
    border-radius: 4px;
    margin: 0 4px;
  }

  .tree-item:hover {
    background: var(--bg-hover);
  }

  .tree-item.active {
    background: var(--bg-accent-dim2);
    color: var(--amber-bright);
  }

  .tree-item.folder {
    font-weight: 500;
  }

  .arrow {
    width: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .tree-label {
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
```

- [ ] **Step 2: Create FileTree component**

```svelte
<!-- g:\claude.free\src\client\components\files\FileTree.svelte -->
<script>
  import FileItem from './FileItem.svelte';
  import { fileTree, currentFile } from '$stores/files.store.js';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  function handleSelect(e) {
    const item = e.detail;
    if (item.type === 'file') {
      dispatch('fileSelect', item);
    }
  }
</script>

<div class="file-tree-panel">
  <div class="panel-header">
    Explorer
  </div>
  <div class="file-tree">
    {#if $fileTree.length === 0}
      <div class="empty-state">
        No files
      </div>
    {:else}
      {#each $fileTree as item}
        <FileItem
          {item}
          depth={0}
          isActive={$currentFile === item.path}
          on:select={handleSelect}
        />
      {/each}
    {/if}
  </div>
</div>

<style>
  .file-tree-panel {
    width: 240px;
    background: var(--bg-raised);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    overflow: hidden;
  }

  .panel-header {
    padding: 10px 14px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .file-tree {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
  }

  .empty-state {
    padding: 20px;
    text-align: center;
    color: var(--text-dim);
    font-size: 13px;
  }
</style>
```

- [ ] **Step 3: Commit**

```bash
git add src/client/components/files/
git commit -m "feat: add file tree components (FileTree, FileItem)"
```

---

## Task 10: Create Editor Components

**Files:**
- Create: `src/client/components/editor/EditorTabs.svelte`
- Create: `src/client/components/editor/CodeEditor.svelte`

- [ ] **Step 1: Create EditorTabs component**

```svelte
<!-- g:\claude.free\src\client\components\editor\EditorTabs.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';
  import Icon from '$components/common/Icon.svelte';
  import { openTabs, activeTab } from '$stores/files.store.js';

  const dispatch = createEventDispatcher();

  function selectTab(path) {
    activeTab.set(path);
    dispatch('tabSelect', path);
  }

  function closeTab(e, path) {
    e.stopPropagation();
    dispatch('tabClose', path);
  }
</script>

<div class="editor-tabs">
  {#each $openTabs as path}
    <div
      class="editor-tab"
      class:active={$activeTab === path}
      on:click={() => selectTab(path)}
      on:keydown
    >
      <span class="tab-name">{path.split('/').pop()}</span>
      <button class="tab-close" on:click={(e) => closeTab(e, path)}>
        <Icon name="close" size="sm" />
      </button>
    </div>
  {/each}
</div>

<style>
  .editor-tabs {
    display: flex;
    align-items: center;
    background: var(--bg-toolbar);
    border-bottom: 1px solid var(--border);
    overflow-x: auto;
    overflow-y: hidden;
    flex-shrink: 0;
    min-height: 32px;
  }

  .editor-tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    font-size: 12px;
    font-family: var(--font-mono);
    color: var(--text-muted);
    cursor: pointer;
    border-right: 1px solid var(--border);
    white-space: nowrap;
    transition: background 0.15s ease, color 0.15s ease;
    flex-shrink: 0;
  }

  .editor-tab:hover {
    background: var(--bg-hover);
    color: var(--text-secondary);
  }

  .editor-tab.active {
    background: var(--bg-base);
    color: var(--amber-bright);
    border-bottom: 2px solid var(--amber);
  }

  .tab-close {
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 3px;
    background: none;
    border: none;
    color: inherit;
    opacity: 0.6;
    cursor: pointer;
    transition: opacity 0.15s, background 0.15s;
  }

  .tab-close:hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.1);
  }
</style>
```

- [ ] **Step 2: Create CodeEditor component**

```svelte
<!-- g:\claude.free\src\client\components\editor\CodeEditor.svelte -->
<script>
  import EditorTabs from './EditorTabs.svelte';
  import { fileContents, activeTab, currentFile, currentFileContent } from '$stores/files.store.js';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  let textarea;

  $: content = $activeTab ? ($fileContents[$activeTab] || '') : '';
  $: lineCount = content.split('\n').length;

  function handleInput() {
    if ($activeTab) {
      dispatch('change', { path: $activeTab, content });
    }
  }
</script>

<div class="editor-panel">
  <EditorTabs
    on:tabSelect={(e) => dispatch('tabSelect', e.detail)}
    on:tabClose={(e) => dispatch('tabClose', e.detail)}
  />

  {#if $activeTab}
    <div class="editor-toolbar">
      <span class="et-info">{$activeTab}</span>
      <div class="et-actions">
        <button class="et-btn" on:click={() => dispatch('save', $activeTab)}>Save</button>
      </div>
    </div>
    <div class="editor-body">
      <div class="editor-gutter">
        {#each Array(lineCount) as _, i}
          {i + 1}{'\n'}
        {/each}
      </div>
      <div class="editor-content">
        <textarea
          bind:this={textarea}
          class="editor-textarea"
          value={content}
          on:input={handleInput}
          spellcheck="false"
        ></textarea>
      </div>
    </div>
  {:else}
    <div class="editor-empty">
      <span class="ee-icon">&#128196;</span>
      <span class="ee-text">No file open</span>
    </div>
  {/if}
</div>

<style>
  .editor-panel {
    display: flex;
    flex-direction: column;
    background: var(--bg-base);
    overflow: hidden;
    flex: 1;
  }

  .editor-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 12px;
    background: var(--bg-toolbar);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    min-height: 28px;
  }

  .et-info {
    font-size: 11px;
    color: var(--text-dim);
    font-family: var(--font-mono);
  }

  .et-actions {
    margin-left: auto;
    display: flex;
    gap: 4px;
  }

  .et-btn {
    padding: 3px 10px;
    font-size: 11px;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--bg-hover);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: var(--font-sans);
  }

  .et-btn:hover {
    background: var(--bg-accent-dim);
    color: var(--amber-bright);
    border-color: var(--border-hover);
  }

  .editor-body {
    flex: 1;
    display: flex;
    overflow: hidden;
    position: relative;
  }

  .editor-gutter {
    padding: 8px 8px 8px 12px;
    text-align: right;
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-dim);
    user-select: none;
    background: var(--bg-base);
    overflow: hidden;
    flex-shrink: 0;
    min-width: 40px;
    white-space: pre;
  }

  .editor-content {
    flex: 1;
    overflow: auto;
    position: relative;
  }

  .editor-textarea {
    width: 100%;
    min-height: 100%;
    padding: 8px 12px;
    background: transparent;
    border: none;
    outline: none;
    resize: none;
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-primary);
    white-space: pre;
    overflow: visible;
    tab-size: 2;
    caret-color: var(--amber);
  }

  .editor-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-dim);
    gap: 8px;
    flex: 1;
  }

  .ee-icon { opacity: 0.3; font-size: 24px; }
  .ee-text { font-size: 13px; }
</style>
```

- [ ] **Step 3: Commit**

```bash
git add src/client/components/editor/
git commit -m "feat: add editor components (CodeEditor, EditorTabs)"
```

---

## Task 11: Create Model Components

**Files:**
- Create: `src/client/components/models/ModelSelector.svelte`
- Create: `src/client/components/models/ConfigModal.svelte`
- Create: `src/client/components/models/ModelList.svelte`

- [ ] **Step 1: Create ModelSelector component**

```svelte
<!-- g:\claude.free\src\client\components\models\ModelSelector.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';
  import Icon from '$components/common/Icon.svelte';
  import { activeModel, modelHealth } from '$stores/models.store.js';
  import { isConnected } from '$stores/session.store.js';

  const dispatch = createEventDispatcher();

  let dropdownOpen = false;

  function toggleDropdown() {
    dropdownOpen = !dropdownOpen;
  }

  function openConfig() {
    dropdownOpen = false;
    dispatch('openConfig');
  }

  $: displayName = $activeModel
    ? $activeModel.model.split('/').pop()
    : '未配置模型';
</script>

<div class="model-selector">
  <button class="toolbar-model" on:click={toggleDropdown}>
    <span class="model-name">{displayName}</span>
    <span class="arrow" class:open={dropdownOpen}>&#9662;</span>
  </button>

  {#if dropdownOpen}
    <div class="dropdown">
      <div class="dropdown-item" on:click={openConfig} on:keydown>
        <Icon name="settings" size="sm" />
        <span>配置模型</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .model-selector {
    position: relative;
  }

  .toolbar-model {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 6px;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 12px;
    font-family: var(--font-mono);
    transition: color 0.2s, background 0.2s;
  }

  .toolbar-model:hover {
    color: var(--amber);
    background: var(--bg-accent-dim);
  }

  .arrow {
    font-size: 10px;
    transition: transform 0.2s ease;
  }

  .arrow.open {
    transform: rotate(180deg);
  }

  .dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    min-width: 160px;
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 4px;
    z-index: 200;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    color: var(--text-secondary);
    transition: background 0.15s;
  }

  .dropdown-item:hover {
    background: var(--bg-accent-dim2);
    color: var(--text-primary);
  }
</style>
```

- [ ] **Step 2: Create ModelList component**

```svelte
<!-- g:\claude.free\src\client\components\models\ModelList.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';
  import { savedModels, activeModelId, isConnected } from '$stores/models.store.js';

  const dispatch = createEventDispatcher();

  function handleSwitch(idx) {
    dispatch('switch', idx);
  }

  function handleDelete(idx) {
    if (confirm(`确定删除模型 "${savedModels[idx].model}" 吗？`)) {
      dispatch('delete', idx);
    }
  }

  $: providerLabels = {
    openrouter: 'OpenRouter',
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    deepseek: 'DeepSeek'
  };
</script>

<div class="model-list">
  {#if $savedModels.length === 0}
    <div class="empty">
      <div class="empty-icon">&#128268;</div>
      <div>暂无已添加的模型</div>
    </div>
  {:else}
    {#each $savedModels as model, i}
      <div class="model-item" class:active={model.id === $activeModelId}>
        <div class="model-info">
          <div class="model-name">{model.model.split('/').pop()}</div>
          <div class="model-detail">
            {providerLabels[model.provider] || '自定义'} · {model.model}
          </div>
        </div>
        {#if model.id === $activeModelId && $isConnected}
          <span class="active-badge">使用中</span>
        {/if}
        <div class="model-actions">
          {#if model.id !== $activeModelId}
            <button class="action-btn" on:click={() => handleSwitch(i)} title="切换">
              &#8644;
            </button>
          {/if}
          <button class="action-btn delete" on:click={() => handleDelete(i)} title="删除">
            &#10005;
          </button>
        </div>
      </div>
    {/each}
  {/if}
</div>

<style>
  .model-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .empty {
    text-align: center;
    padding: 24px;
    color: var(--text-dim);
  }

  .empty-icon {
    font-size: 24px;
    margin-bottom: 8px;
    opacity: 0.5;
  }

  .model-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: 8px;
    transition: border-color 0.15s;
  }

  .model-item.active {
    border-color: var(--border-hover);
    background: var(--bg-accent-dim);
  }

  .model-info {
    flex: 1;
    min-width: 0;
  }

  .model-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
    font-family: var(--font-mono);
  }

  .model-detail {
    font-size: 11px;
    color: var(--text-dim);
    margin-top: 2px;
  }

  .active-badge {
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 10px;
    background: rgba(34, 197, 94, 0.15);
    color: var(--green);
    white-space: nowrap;
  }

  .model-actions {
    display: flex;
    gap: 4px;
  }

  .action-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 14px;
    transition: all 0.15s;
  }

  .action-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
    border-color: var(--border-hover);
  }

  .action-btn.delete:hover {
    background: rgba(239, 68, 68, 0.1);
    color: var(--red);
    border-color: var(--red);
  }
</style>
```

- [ ] **Step 3: Create ConfigModal component**

```svelte
<!-- g:\claude.free\src\client\components\models\ConfigModal.svelte -->
<script>
  import Modal from '$components/common/Modal.svelte';
  import ModelList from './ModelList.svelte';
  import { savedModels, activeModelId, addModel, removeModel, switchModel } from '$stores/models.store.js';
  import { createEventDispatcher } from 'svelte';

  export let open = false;

  const dispatch = createEventDispatcher();

  let activeTab = 'provider';
  let provider = '';
  let model = '';
  let apiKey = '';

  const providers = [
    { value: 'openrouter', label: 'OpenRouter' },
    { value: 'anthropic', label: 'Anthropic' },
    { value: 'openai', label: 'OpenAI' },
    { value: 'deepseek', label: 'DeepSeek' }
  ];

  function handleSubmit() {
    if (!apiKey.trim()) return;

    addModel({
      model: model.trim(),
      provider,
      apiKey: apiKey.trim()
    });

    // Reset form
    provider = '';
    model = '';
    apiKey = '';
    activeTab = 'manage';
  }

  function handleSwitch(e) {
    const idx = e.detail;
    switchModel($savedModels[idx].id);
    dispatch('connect', $savedModels[idx]);
  }

  function handleDelete(e) {
    const idx = e.detail;
    removeModel($savedModels[idx].id);
  }
</script>

<Modal {open} title="模型配置" width="550px" on:close={() => dispatch('close')}>
  <div class="config-tabs">
    <button class:active={activeTab === 'provider'} on:click={() => activeTab = 'provider'}>
      模型服务商
    </button>
    <button class:active={activeTab === 'manage'} on:click={() => activeTab = 'manage'}>
      管理模型
    </button>
  </div>

  {#if activeTab === 'provider'}
    <form class="config-form" on:submit|preventDefault={handleSubmit}>
      <div class="form-group">
        <label>服务商</label>
        <select bind:value={provider}>
          <option value="">选择服务商</option>
          {#each providers as p}
            <option value={p.value}>{p.label}</option>
          {/each}
        </select>
      </div>

      <div class="form-group">
        <label>模型</label>
        <input type="text" bind:value={model} placeholder="模型 ID (如 claude-sonnet-4)" />
      </div>

      <div class="form-group">
        <label>API Key</label>
        <input type="password" bind:value={apiKey} placeholder="输入 API Key" />
      </div>

      <button type="submit" class="submit-btn" disabled={!apiKey.trim()}>
        添加模型
      </button>
    </form>
  {:else}
    <ModelList on:switch={handleSwitch} on:delete={handleDelete} />
  {/if}
</Modal>

<style>
  .config-tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 16px;
    border-bottom: 1px solid var(--border);
    padding-bottom: 8px;
  }

  .config-tabs button {
    padding: 6px 14px;
    border-radius: 6px;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 13px;
    font-family: var(--font-sans);
    transition: all 0.15s;
  }

  .config-tabs button.active {
    background: var(--bg-accent-dim);
    color: var(--amber-bright);
  }

  .config-tabs button:hover:not(.active) {
    color: var(--text-secondary);
  }

  .config-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-group label {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .form-group input,
  .form-group select {
    padding: 8px 12px;
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 13px;
    font-family: var(--font-sans);
    outline: none;
    transition: border-color 0.2s;
  }

  .form-group input:focus,
  .form-group select:focus {
    border-color: var(--border-hover);
  }

  .form-group select {
    cursor: pointer;
  }

  .form-group select option {
    background: var(--bg-panel);
    color: var(--text-primary);
  }

  .submit-btn {
    padding: 10px 20px;
    background: var(--amber);
    color: var(--bg-base);
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
    font-family: var(--font-sans);
  }

  .submit-btn:hover:not(:disabled) {
    background: var(--amber-bright);
  }

  .submit-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
```

- [ ] **Step 4: Commit**

```bash
git add src/client/components/models/
git commit -m "feat: add model components (ModelSelector, ConfigModal, ModelList)"
```

---

## Task 12: Create Toolbar Component

**Files:**
- Create: `src/client/components/common/Toolbar.svelte`

- [ ] **Step 1: Create Toolbar component**

```svelte
<!-- g:\claude.free\src\client\components\common\Toolbar.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';
  import Icon from './Icon.svelte';
  import ModelSelector from '$components/models/ModelSelector.svelte';
  import { connectionStatus } from '$stores/session.store.js';

  const dispatch = createEventDispatcher();

  let leftPanelVisible = true;

  function toggleLeftPanel() {
    leftPanelVisible = !leftPanelVisible;
    dispatch('toggleLeftPanel', leftPanelVisible);
  }
</script>

<div class="toolbar">
  <button class="toolbar-btn" on:click={toggleLeftPanel} title="Toggle file tree">
    <Icon name="menu" size="md" />
  </button>

  <div class="toolbar-sep"></div>

  <div class="toolbar-project">
    <span class="name">Free Code</span>
  </div>

  <div class="toolbar-sep"></div>

  <div class="toolbar-status">
    <span class="dot" class:disconnected={$connectionStatus !== 'connected'}></span>
    <span class="status-text">
      {$connectionStatus === 'connected' ? '已连接' : '未连接'}
    </span>
  </div>

  <div class="toolbar-spacer"></div>

  <ModelSelector
    on:openConfig={() => dispatch('openConfig')}
  />
</div>

<style>
  .toolbar {
    height: 40px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    background: var(--bg-toolbar);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    user-select: none;
  }

  .toolbar-btn {
    padding: 4px;
    border-radius: 4px;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s, background 0.2s;
  }

  .toolbar-btn:hover {
    color: var(--amber);
    background: var(--bg-accent-dim);
  }

  .toolbar-sep {
    width: 1px;
    height: 16px;
    background: var(--border);
    margin: 0 4px;
  }

  .toolbar-project {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .toolbar-project .name {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .toolbar-status {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--text-dim);
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--green);
    position: relative;
  }

  .dot::after {
    content: '';
    position: absolute;
    inset: -3px;
    border-radius: 50%;
    background: var(--green);
    opacity: 0;
    animation: statusPulse 2s ease-in-out infinite;
  }

  .dot.disconnected {
    background: var(--red);
  }

  .dot.disconnected::after {
    background: var(--red);
  }

  .toolbar-spacer {
    flex: 1;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/client/components/common/Toolbar.svelte
git commit -m "feat: add Toolbar component"
```

---

## Task 13: Create Root App Component

**Files:**
- Create: `src/client/App.svelte`

- [ ] **Step 1: Create App.svelte (root layout)**

```svelte
<!-- g:\claude.free\src\client\App.svelte -->
<script>
  import Toolbar from '$components/common/Toolbar.svelte';
  import ChatPanel from '$components/chat/ChatPanel.svelte';
  import FileTree from '$components/files/FileTree.svelte';
  import CodeEditor from '$components/editor/CodeEditor.svelte';
  import ConfigModal from '$components/models/ConfigModal.svelte';

  let showLeftPanel = true;
  let showConfigModal = false;
  let editorHeight = 300;

  function handleToggleLeftPanel(e) {
    showLeftPanel = e.detail;
  }

  function handleOpenConfig() {
    showConfigModal = true;
  }

  function handleCloseConfig() {
    showConfigModal = false;
  }
</script>

<div class="app">
  <Toolbar
    on:toggleLeftPanel={handleToggleLeftPanel}
    on:openConfig={handleOpenConfig}
  />

  <div class="main-layout">
    {#if showLeftPanel}
      <FileTree on:fileSelect />
    {/if}

    <div class="center-area">
      <ChatPanel />

      <div class="editor-resize-area" style="height: {editorHeight}px">
        <CodeEditor />
      </div>
    </div>
  </div>
</div>

<ConfigModal
  open={showConfigModal}
  on:close={handleCloseConfig}
  on:connect
/>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    height: 100dvh;
  }

  .main-layout {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .center-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  }

  .editor-resize-area {
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/client/App.svelte
git commit -m "feat: add root App component with layout"
```

---

## Task 14: Update Express Server to Serve Built Frontend

**Files:**
- Modify: `src/server/index.js` (static file serving section only)

- [ ] **Step 1: Verify Express serves `public/` directory**

The existing Express server already has this line (around line 230):
```javascript
app.use(express.static(join(__dirname, '../../public'), { ... }));
```

No changes needed - Vite builds to `public/` and Express serves it.

- [ ] **Step 2: Backup old frontend**

```powershell
cd g:\claude.free
mkdir old-public
Copy-Item public\index.html old-public\index.html
```

- [ ] **Step 3: Commit**

```bash
git add old-public/
git commit -m "chore: backup old frontend to old-public/"
```

---

## Task 15: Update Dockerfile for Multi-Stage Build

**Files:**
- Modify: `Dockerfile`

- [ ] **Step 1: Update Dockerfile**

```dockerfile
# g:\claude.free\Dockerfile
FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --production=false

# Copy source
COPY . .

# Build frontend
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# Expose port
EXPOSE 3000

# Start server (serves API + built frontend)
CMD ["npm", "start"]
```

- [ ] **Step 2: Commit**

```bash
git add Dockerfile
git commit -m "chore: update Dockerfile for frontend build step"
```

---

## Task 16: Test Build and Verify

- [ ] **Step 1: Build the frontend**

Run:
```powershell
cd g:\claude.free
npm run build
```

Expected: Vite compiles Svelte files, outputs to `public/` directory.

- [ ] **Step 2: Start the server**

Run:
```powershell
cd g:\claude.free
npm run dev
```

Expected: Server starts on port 3000, serves the new Svelte frontend.

- [ ] **Step 3: Verify in browser**

Open `http://localhost:3000` and verify:
- Toolbar renders with model selector
- Chat panel shows welcome screen
- File tree panel is visible
- Editor area shows "No file open"

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete frontend refactor to Svelte + Vite"
```

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| 1 | Project setup (Vite + Svelte config) | Pending |
| 2 | Entry point + global styles | Pending |
| 3 | Utility library | Pending |
| 4 | API layer | Pending |
| 5 | Svelte stores | Pending |
| 6 | WebSocket manager | Pending |
| 7 | Common components | Pending |
| 8 | Chat components | Pending |
| 9 | File tree components | Pending |
| 10 | Editor components | Pending |
| 11 | Model components | Pending |
| 12 | Toolbar component | Pending |
| 13 | Root App component | Pending |
| 14 | Express server update | Pending |
| 15 | Dockerfile update | Pending |
| 16 | Test and verify | Pending |
