# Frontend Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 claude.free 前端与 open-webui 的 19 处差异，分两批执行

**Architecture:** 第一批聚焦功能正确性（Markdown 渲染、i18n、存储统一、编辑器），第二批聚焦体验改进（组件抽取、交互修复）。所有改动遵循 TDD，每个任务独立可测试。

**Tech Stack:** Svelte 5, Vite, marked, paneforge, highlight.js, JavaScript

---

## File Structure

### 第一批改动文件

| 文件 | 操作 | 责任 |
|------|------|------|
| `src/client/components/chat/ChatMessage.svelte` | 修改 | Markdown 渲染改用 marked |
| `src/client/lib/i18n.js` | 修改 | t() 改为派生函数 + 补全翻译 key |
| `src/client/components/chat/ChatPanel.svelte` | 修改 | 接入 i18n |
| `src/client/components/chat/ChatInput.svelte` | 修改 | 接入 i18n |
| `src/client/components/chat/ChatSidebar.svelte` | 修改 | 接入 i18n |
| `src/client/components/common/Toolbar.svelte` | 修改 | 接入 i18n + ModelParametersPanel |
| `src/client/components/common/ThemeToggle.svelte` | 修改 | 接入 i18n |
| `src/client/components/common/LanguageSelector.svelte` | 修改 | 接入 i18n |
| `src/client/components/common/CommandPalette.svelte` | 修改 | 接入 i18n |
| `src/client/components/common/Modal.svelte` | 修改 | 接入 i18n |
| `src/client/components/common/ContextMenu.svelte` | 修改 | 接入 i18n |
| `src/client/components/files/FileTree.svelte` | 修改 | 接入 i18n |
| `src/client/components/editor/CodeEditor.svelte` | 修改 | 接入 i18n + 行号同步 + Tab 键 |
| `src/client/components/editor/EditorTabs.svelte` | 修改 | 接入 i18n |
| `src/client/components/models/ModelSelector.svelte` | 修改 | 接入 i18n |
| `src/client/components/models/ConfigModal.svelte` | 修改 | 接入 i18n |
| `src/client/components/models/ModelList.svelte` | 修改 | 接入 i18n |
| `src/client/components/models/ModelParametersPanel.svelte` | 修改 | 接入 i18n |
| `src/client/App.svelte` | 修改 | 接入 ModelParametersPanel + 命令监听 |
| `src/client/stores/chat.store.js` | 修改 | messages 改为 derived |
| `src/client/stores/chatHistory.store.js` | 修改 | 修复初始化冲突 + syncSessions |
| `src/client/lib/websocket.js` | 修改 | 发送消息附带参数 |
| `package.json` | 修改 | 添加 marked 依赖 |

### 第二批改动文件

| 文件 | 操作 | 责任 |
|------|------|------|
| `src/client/components/chat/Navbar.svelte` | 创建 | 聊天导航栏 |
| `src/client/components/chat/Placeholder.svelte` | 创建 | 空状态欢迎页 |
| `src/client/components/chat/Messages.svelte` | 创建 | 消息列表组件 |
| `src/client/components/chat/ChatControls.svelte` | 创建 | 聊天控制面板 |
| `src/client/stores/ui.store.js` | 创建 | UI 状态管理 |
| `package.json` | 修改 | 添加 paneforge 依赖 |

---

## 第一批任务

### Task 1: 安装 marked 依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装 marked**

```bash
cd g:\claude.free && npm install marked
```

Expected: `added 1 package`

- [ ] **Step 2: 验证安装**

```bash
node -e "const {marked} = require('marked'); console.log(marked.parse('# Hello'))"
```

Expected: `<h1>Hello</h1>\n`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add marked dependency for Markdown rendering"
```

---

### Task 2: Markdown 渲染改用 marked

**Files:**
- Modify: `src/client/components/chat/ChatMessage.svelte`

**当前代码分析：**
- `parseContent(text)` 用正则 `/```(\w*)\n?([\s\S]*?)```/g` 提取代码块，返回 `[{type:'markdown',content}, {type:'code',language,content}]`
- `renderMarkdown(text)` 用 ~50 行手写正则解析：标题、粗体/斜体、链接（含 XSS 过滤）、行内代码、无序列表、有序列表（未包裹 `<ol>`）、段落
- 缺失：表格、引用块、图片、水平线、嵌套列表

- [ ] **Step 1: 读取当前 ChatMessage.svelte 完整代码**

确认 `renderMarkdown()` 函数位置和 `parsedParts` 逻辑

- [ ] **Step 2: 修改 script 部分**

删除 `renderMarkdown()` 函数（~50 行），添加 marked 导入：

```javascript
import { marked } from 'marked';

// 配置 marked
marked.setOptions({
  breaks: true,
  gfm: true
});

// renderMarkdown 改用 marked
function renderMarkdown(text) {
  let safeText = escapeHtml(text);
  return marked.parse(safeText);
}
```

`parseContent()` 函数保持不变（它只负责分离代码块和 markdown 文本）。

- [ ] **Step 3: 验证构建**

```bash
cd g:\claude.free && npx vite build
```

Expected: Build succeeds with no errors

- [ ] **Step 4: 启动服务器并手动测试**

```bash
node src/server/index.js
```

在浏览器中发送包含表格 `| col | col |`、引用 `> text`、图片 `![alt](url)` 的消息，验证渲染效果

- [ ] **Step 5: Commit**

```bash
git add src/client/components/chat/ChatMessage.svelte
git commit -m "feat: use marked library for Markdown rendering"
```

---

### Task 3: i18n 改造 — t() 派生函数 + 补全翻译

**Files:**
- Modify: `src/client/lib/i18n.js`

**当前代码分析：**
- `t(key, locale)` 是普通函数，接受 key 和可选 locale 参数
- `getLocale()` 用 `subscribe` + 立即 `unsubscribe` 获取当前值
- `currentLocale` 是 writable store
- 翻译 key 约 50 个，缺少：命令面板、编辑器、模型参数、确认对话框等

- [ ] **Step 1: 读取当前 i18n.js 完整代码**

- [ ] **Step 2: 修改 t() 为派生函数**

```javascript
// 删除原来的 t() 函数和 getLocale() 函数
// 添加派生 t 函数
export const t = derived(currentLocale, ($locale) => {
  return (key) => {
    return translations[$locale]?.[key] || translations.zh[key] || key;
  };
});
```

注意：组件中用 `$t('key')` 调用，因为 `t` 是 store，`$t` 自动解包为函数。

- [ ] **Step 3: 补全翻译 key**

在 `translations.zh` 和 `translations.en` 中添加以下缺失的 key：

```javascript
// 通用（新增）
'common.add': '添加',
'common.remove': '删除',
'common.reset': '重置',
'common.search': '搜索',
'common.copy': '复制',
'common.copied': '已复制',
'common.retry': '重试',
'common.new': '新建',
'common.noResults': '无结果',

// 聊天（新增）
'chat.noMessages': '暂无对话历史',
'chat.startHint': '点击"新对话"开始',

// 文件（新增）
'files.noFiles': 'No files',

// 编辑器（新增）
'editor.noFile': 'No file open',
'editor.save': '保存',

// 模型（新增）
'model.manage': '管理模型',
'model.provider': '服务商',
'model.modelId': '模型 ID',
'model.available': '可用模型',
'model.noModels': '暂无模型',
'model.addModel': '添加模型',
'model.switch': '切换',
'model.edit': '编辑',
'model.delete': '删除',
'model.using': '使用中',
'model.connecting': '连接中',
'model.confirmDelete': '确定要删除模型',
'model.parameters': '参数',
'model.resetParams': '重置为默认值',

// 主题（新增）
'theme.toggle': '切换主题',

// 语言（已有，确认完整）

// 命令（新增）
'command.newChat': '新建对话',
'command.toggleSidebar': '切换侧边栏',
'command.toggleChatSidebar': '切换对话侧边栏',
'command.clearChat': '清空对话',
'command.focusInput': '聚焦输入框',
'command.toggleTheme': '切换主题',
'command.search': '输入命令名称或描述...',
'command.noResults': '未找到匹配的命令',

// 提示（新增）
'toast.connected': '已连接到',
'toast.connectionFailed': '连接失败',
'toast.newChatCreated': '新对话已创建',
'toast.themeSwitched': '主题已切换',

// 确认（新增）
'confirm.deleteSession': '确定要删除',
'confirm.deleteModel': '确定要删除模型',
```

英文翻译对应添加。

- [ ] **Step 4: 验证构建**

```bash
cd g:\claude.free && npx vite build
```

Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/client/lib/i18n.js
git commit -m "feat: enhance i18n with derived t() function and complete translations"
```

---

### Task 4: i18n 集成到组件（批量）

**Files:** 所有组件文件（17+ 个）

**当前状态：** 所有组件使用硬编码中文文本，`i18n.js` 的 `t()` 函数未被任何组件使用。

- [ ] **Step 1: 修改 ChatPanel.svelte**

```javascript
// 在 script 中添加
import { t } from '$lib/i18n.js';

// 替换硬编码文本（在 template 中用 {$t('key')}）
// 欢迎页标题、建议按钮文本等
```

- [ ] **Step 2: 修改 ChatInput.svelte**

```javascript
import { t } from '$lib/i18n.js';

// placeholder 文本
// 按钮文本
```

- [ ] **Step 3: 修改 ChatSidebar.svelte**

```javascript
import { t } from '$lib/i18n.js';

// '新对话' 按钮
// '暂无对话历史'
// 时间格式化（'刚刚'、'分钟前'）保留动态逻辑
```

- [ ] **Step 4: 修改 Toolbar.svelte**

```javascript
import { t } from '$lib/i18n.js';

// 连接状态文本
// 按钮 title 属性
```

- [ ] **Step 5: 修改 ThemeToggle.svelte**

```javascript
import { t } from '$lib/i18n.js';

// 主题名称显示
```

- [ ] **Step 6: 修改 LanguageSelector.svelte**

```javascript
import { t } from '$lib/i18n.js';

// 语言选项文本
```

- [ ] **Step 7: 修改 CommandPalette.svelte**

```javascript
import { t } from '$lib/i18n.js';

// 搜索框 placeholder
// 命令名称和描述
```

- [ ] **Step 8: 修改 Modal.svelte**

```javascript
import { t } from '$lib/i18n.js';

// title prop 保持不变（由调用方传入已翻译的文本）
// 组件本身无需修改
```

- [ ] **Step 9: 修改 ContextMenu.svelte**

```javascript
import { t } from '$lib/i18n.js';

// label 由调用方传入，组件本身无需修改
```

- [ ] **Step 10: 修改 FileTree.svelte**

```javascript
import { t } from '$lib/i18n.js';

// 'Explorer' 标题
// 'No files' 空状态
```

- [ ] **Step 11: 修改 CodeEditor.svelte**

```javascript
import { t } from '$lib/i18n.js';

// 'No file open'
// 'Save' 按钮
```

- [ ] **Step 12: 修改 EditorTabs.svelte**

```javascript
import { t } from '$lib/i18n.js';

// 标签页名称是文件名，无需翻译
```

- [ ] **Step 13: 修改 ModelSelector.svelte**

```javascript
import { t } from '$lib/i18n.js';

// 按钮文本、标题等
```

- [ ] **Step 14: 修改 ConfigModal.svelte**

```javascript
import { t } from '$lib/i18n.js';

// 表单标签、按钮文本、确认对话框等
```

- [ ] **Step 15: 修改 ModelList.svelte**

```javascript
import { t } from '$lib/i18n.js';

// 状态文本、操作按钮等
```

- [ ] **Step 16: 修改 ModelParametersPanel.svelte**

```javascript
import { t } from '$lib/i18n.js';

// 标题、按钮文本
// 技术术语（Temperature, Top P 等）保留英文
```

- [ ] **Step 17: 修改 App.svelte**

```javascript
import { t } from '$lib/i18n.js';

// Toast 消息文本
```

- [ ] **Step 18: 验证构建**

```bash
cd g:\claude.free && npx vite build
```

Expected: Build succeeds with no errors

- [ ] **Step 19: 启动服务器并测试语言切换**

```bash
node src/server/index.js
```

在浏览器中切换语言，验证所有文本变化

- [ ] **Step 20: Commit**

```bash
git add src/client/components/ src/client/App.svelte
git commit -m "feat: integrate i18n into all components"
```

---

### Task 5: ModelParametersPanel 接入

**Files:**
- Modify: `src/client/App.svelte`
- Modify: `src/client/lib/websocket.js`

**当前状态：** `ModelParametersPanel.svelte` 已实现但未在 `App.svelte` 中使用。

- [ ] **Step 1: 读取 App.svelte 和 websocket.js 完整代码**

确认当前结构和消息发送逻辑

- [ ] **Step 2: 在 App.svelte 中引入 ModelParametersPanel**

```javascript
import ModelParametersPanel from '$components/models/ModelParametersPanel.svelte';
```

- [ ] **Step 3: 在 Toolbar 右侧或 ChatPanel 上方添加参数面板**

添加一个按钮触发参数面板显示，或将其集成到现有 UI 中

- [ ] **Step 4: 修改 websocket.js 发送消息时附带参数**

```javascript
// 在 sendInput 函数中添加参数
export function sendInput(sessionId, token, message, parameters) {
  // 在消息对象中添加 parameters
  const payload = {
    message,
    parameters: parameters || {}
  };
  // ... 发送逻辑
}
```

- [ ] **Step 5: 修改 App.svelte 的 handleChatSend**

```javascript
function handleChatSend(e) {
  const message = e.detail;
  const parameters = getParameters(); // 从参数 store 获取
  sendInput($sessionId, $sessionToken, message, parameters);
}
```

- [ ] **Step 6: 验证构建**

```bash
cd g:\claude.free && npx vite build
```

- [ ] **Step 7: 启动服务器并测试**

```bash
node src/server/index.js
```

打开参数面板，调整参数，发送消息，验证后端收到参数

- [ ] **Step 8: Commit**

```bash
git add src/client/App.svelte src/client/lib/websocket.js
git commit -m "feat: integrate ModelParametersPanel and pass parameters to backend"
```

---

### Task 6: 存储架构统一

**Files:**
- Modify: `src/client/stores/chat.store.js`
- Modify: `src/client/stores/chatHistory.store.js`

**当前代码分析：**

**chat.store.js:**
- `messages` 是 writable store
- `currentSession.subscribe()` 同步消息到 `messages` store
- `addMessage()` 同时写入 `messages` 和 `sessions` store（双重写入）
- `appendToLastAssistant()` 也双重写入
- `clearMessages()` 也双重写入
- `MAX_STORED_MESSAGES = 100` 定义了但未使用

**chatHistory.store.js:**
- `syncSessions()` 有订阅泄漏：`sessions.subscribe(s => currentSessions.push(...s))()` 创建永不过期订阅
- 底部有同步初始化：`if (loadSessions().length === 0) { createSession('新对话'); }`
- `initChatHistory()` 是异步的，与底部同步初始化可能竞争

- [ ] **Step 1: 修改 chat.store.js — messages 改为 derived**

```javascript
import { writable, derived, get } from 'svelte/store';
import { currentSessionId, sessions, currentSession } from './chatHistory.store.js';

// messages 改为 derived，从 currentSession 派生
export const messages = derived(
  currentSession,
  ($session) => $session?.messages || []
);

export const isWaiting = writable(false);
export const isTyping = writable(false);

export const tokenStats = writable({
  input: 0,
  inputMax: 200000,
  output: 0,
  outputMax: 16000
});

export const toolUsage = writable({});

// addMessage 只操作 sessions store
export function addMessage(role, content, meta) {
  const msg = {
    id: Date.now() + Math.random(),
    role,
    content,
    meta: meta || null,
    time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  };

  const sessionId = get(currentSessionId);
  if (sessionId) {
    sessions.update(s => s.map(session =>
      session.id === sessionId
        ? { ...session, messages: [...(session.messages || []), msg], updatedAt: Date.now() }
        : session
    ));
  }

  return msg;
}

// clearMessages 只操作 sessions store
export function clearMessages() {
  tokenStats.set({ input: 0, inputMax: 200000, output: 0, outputMax: 16000 });
  toolUsage.set({});

  const sessionId = get(currentSessionId);
  if (sessionId) {
    sessions.update(s => s.map(session =>
      session.id === sessionId
        ? { ...session, messages: [], updatedAt: Date.now() }
        : session
    ));
  }
}

// appendToLastAssistant 只操作 sessions store
export function appendToLastAssistant(text) {
  const sessionId = get(currentSessionId);
  if (!sessionId) return;

  sessions.update(s => s.map(session => {
    if (session.id === sessionId) {
      const msgs = session.messages || [];
      const last = msgs[msgs.length - 1];
      if (last && last.role === 'assistant') {
        const updated = { ...last, content: last.content + text };
        return {
          ...session,
          messages: [...msgs.slice(0, -1), updated],
          updatedAt: Date.now()
        };
      }
    }
    return session;
  }));
}
```

**关键变化：**
- 删除 `messages` writable store 和 `currentSession.subscribe()` 同步逻辑
- `messages` 改为 `derived([currentSession], ...)`
- `addMessage`、`clearMessages`、`appendToLastAssistant` 只操作 `sessions` store
- 删除 `MAX_STORED_MESSAGES` 未使用常量

- [ ] **Step 2: 修改 chatHistory.store.js — 修复初始化冲突和 syncSessions**

```javascript
// 删除底部的同步初始化代码
// if (loadSessions().length === 0) {
//   createSession('新对话');
// }

// 修改 initChatHistory 为唯一入口
export async function initChatHistory() {
  const loadedSessions = await loadSessionsAsync();
  if (loadedSessions.length > 0) {
    sessions.set(loadedSessions);
  } else {
    // 只有在没有任何会话时才创建默认会话
    const currentSessions = get(sessions);
    if (currentSessions.length === 0) {
      createSession('新对话');
    }
  }
}

// 修复 syncSessions — 用 get() 替代 subscribe
export function syncSessions() {
  const currentSessions = get(sessions);
  saveSessionsAsync(currentSessions);
}
```

**关键变化：**
- 删除底部 `if (loadSessions().length === 0) { createSession('新对话'); }`
- `initChatHistory()` 作为唯一初始化入口，内部检查是否需要创建默认会话
- `syncSessions()` 用 `get(sessions)` 直接读取，不再创建订阅

- [ ] **Step 3: 验证构建**

```bash
cd g:\claude.free && npx vite build
```

- [ ] **Step 4: 启动服务器并测试**

```bash
node src/server/index.js
```

测试：发送消息、切换会话、新建对话、删除会话、刷新页面

- [ ] **Step 5: Commit**

```bash
git add src/client/stores/chat.store.js src/client/stores/chatHistory.store.js
git commit -m "refactor: unify message storage to chatHistory store, fix init conflict"
```

---

### Task 7: 编辑器行号同步 + Tab 键

**Files:**
- Modify: `src/client/components/editor/CodeEditor.svelte`

**当前代码分析：**
- `.editor-body` 是 flex 容器，包含 `.editor-gutter` 和 `.editor-content`
- `.editor-content` 有 `overflow: auto`，是独立滚动容器
- `.editor-gutter` 有 `overflow: hidden`，不滚动
- 行号用 `{#each Array(lineCount) as _, i}{i + 1}{'\n'}{/each}` 生成，用 `\n` 换行
- textarea 在 `.editor-content` 内，有独立滚动
- 无 Tab 键处理

- [ ] **Step 1: 重构编辑器布局**

将行号和 textarea 放入同一个滚动容器：

```svelte
<div class="editor-body">
  <div class="editor-scroll">
    <div class="editor-gutter">
      {#each Array(lineCount) as _, i}
        <div class="line-number">{i + 1}</div>
      {/each}
    </div>
    <textarea
      bind:this={textarea}
      class="editor-textarea"
      value={content}
      on:input={handleInput}
      on:keydown={handleKeydown}
      spellcheck="false"
    ></textarea>
  </div>
</div>

<style>
  .editor-body {
    flex: 1;
    overflow: hidden;
    position: relative;
  }

  .editor-scroll {
    display: flex;
    overflow: auto;
    height: 100%;
  }

  .editor-gutter {
    padding: 8px 8px 8px 12px;
    background: var(--bg-base);
    user-select: none;
    flex-shrink: 0;
    min-width: 40px;
  }

  .line-number {
    text-align: right;
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-dim);
    height: 20.8px; /* 13px * 1.6 */
  }

  .editor-textarea {
    flex: 1;
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
    min-height: 100%;
  }
</style>
```

- [ ] **Step 2: 添加 Tab 键处理**

```javascript
function handleKeydown(e) {
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent = content.substring(0, start) + '\t' + content.substring(end);
    content = newContent;
    // 设置光标位置
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + 1;
    }, 0);
    handleInput();
  }
}
```

- [ ] **Step 3: 验证构建**

```bash
cd g:\claude.free && npx vite build
```

- [ ] **Step 4: 启动服务器并测试**

```bash
node src/server/index.js
```

打开文件，验证行号对齐、滚动同步、Tab 键插入

- [ ] **Step 5: Commit**

```bash
git add src/client/components/editor/CodeEditor.svelte
git commit -m "feat: sync editor line numbers with text, add Tab key support"
```

---

## 第一批完成检查点

完成以上 7 个任务后，执行以下验证：

```bash
cd g:\claude.free && npx vite build && node src/server/index.js
```

在浏览器中测试：
1. 发送包含表格、引用、图片的消息 → 验证 Markdown 渲染
2. 切换语言 → 验证所有文本变化
3. 打开参数面板 → 验证参数可调整
4. 发送消息 → 验证存储正常
5. 打开文件 → 验证行号同步和 Tab 键

---

## 第二批任务

### Task 8: 修复 syncSessions 订阅泄漏 + 初始化冲突 + toggleTheme 死代码

**Files:**
- Modify: `src/client/stores/chatHistory.store.js`
- Modify: `src/client/stores/theme.store.js`

- [ ] **Step 1: 修复 syncSessions**

已在 Task 6 中完成

- [ ] **Step 2: 修复初始化冲突**

已在 Task 6 中完成

- [ ] **Step 3: 删除或接入 toggleTheme**

选项 A：删除 `toggleTheme()` 函数
选项 B：在 ThemeToggle 中使用 `toggleTheme()` 替代 `cycleTheme()`

推荐选项 B，让 ThemeToggle 使用 store 的 `toggleTheme()`

- [ ] **Step 4: Commit**

```bash
git add src/client/stores/
git commit -m "fix: remove dead code and fix store issues"
```

---

### Task 9: 补全命令事件监听

**Files:**
- Modify: `src/client/App.svelte`

- [ ] **Step 1: 检查当前命令监听**

确认 App.svelte 中监听了哪些 CustomEvent

- [ ] **Step 2: 补全缺失的监听器**

```javascript
// 确保以下 6 个事件都有监听
onMount(() => {
  window.addEventListener('command:new-chat', handleNewChatCommand);
  window.addEventListener('command:toggle-sidebar', handleToggleSidebarCommand);
  window.addEventListener('command:toggle-chat-sidebar', handleToggleChatSidebarCommand);
  window.addEventListener('command:clear-chat', handleClearChatCommand);
  window.addEventListener('command:focus-input', handleFocusInputCommand);
  window.addEventListener('command:toggle-theme', handleToggleThemeCommand);
});

onDestroy(() => {
  window.removeEventListener('command:new-chat', handleNewChatCommand);
  window.removeEventListener('command:toggle-sidebar', handleToggleSidebarCommand);
  window.removeEventListener('command:toggle-chat-sidebar', handleToggleChatSidebarCommand);
  window.removeEventListener('command:clear-chat', handleClearChatCommand);
  window.removeEventListener('command:focus-input', handleFocusInputCommand);
  window.removeEventListener('command:toggle-theme', handleToggleThemeCommand);
});
```

- [ ] **Step 3: Commit**

```bash
git add src/client/App.svelte
git commit -m "fix: complete command event listeners in App.svelte"
```

---

### Task 10: Modal 焦点陷阱 + 滚动锁定

**Files:**
- Modify: `src/client/components/common/Modal.svelte`

**当前代码分析：**
- Modal 用 `svelte:window on:keydown` 监听 Escape 关闭
- 无焦点陷阱（Tab 键可跳出模态框）
- 无滚动锁定（背景可滚动）

- [ ] **Step 1: 添加焦点陷阱和滚动锁定**

```javascript
import { onMount, onDestroy } from 'svelte';

let modalContent;
let previousFocus;

$: if (open) {
  previousFocus = document.activeElement;
  setTimeout(() => {
    const focusable = modalContent?.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    focusable?.focus();
  }, 50);
}

function handleTabKey(e) {
  if (!open) return;
  const focusable = modalContent?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (!focusable || focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

$: if (open) {
  document.body.style.overflow = 'hidden';
} else {
  document.body.style.overflow = '';
  previousFocus?.focus();
}
```

- [ ] **Step 2: 在模板中添加 ref 和 keydown 监听**

```svelte
<div class="modal-content" bind:this={modalContent} on:keydown={handleTabKey}>
```

- [ ] **Step 3: Commit**

```bash
git add src/client/components/common/Modal.svelte
git commit -m "feat: add focus trap and scroll lock to Modal"
```

---

### Task 11: ContextMenu 边界检测

**Files:**
- Modify: `src/client/components/common/ContextMenu.svelte`

**当前代码分析：**
- ContextMenu 用固定位置 `style="left: {x}px; top: {y}px;"`
- 无边界检测，可能超出屏幕

- [ ] **Step 1: 添加边界检测逻辑**

```javascript
$: if (open) {
  // 在下一个 tick 计算菜单位置
  setTimeout(() => {
    const menu = document.querySelector('.context-menu');
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    if (rect.right > viewportWidth) {
      menu.style.left = (viewportWidth - rect.width - 8) + 'px';
    }
    if (rect.bottom > viewportHeight) {
      menu.style.top = (viewportHeight - rect.height - 8) + 'px';
    }
  }, 0);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/client/components/common/ContextMenu.svelte
git commit -m "feat: add viewport boundary detection to ContextMenu"
```

---

### Task 12: Toast 图标修正 + 退出动画

**Files:**
- Modify: `src/client/components/common/Toast.svelte`
- Modify: `src/client/components/common/Icon.svelte`

**当前代码分析：**
- `icons` 对象中 `warning` 和 `info` 都映射到 `'check'`（错误）
- 只有 `slideIn` 进入动画，无退出动画

- [ ] **Step 1: 修正 warning 和 info 图标**

```javascript
const icons = {
  success: 'check',
  error: 'close',
  warning: 'alert',  // 需要添加 alert 图标到 Icon.svelte
  info: 'info'       // 需要添加 info 图标到 Icon.svelte
};
```

- [ ] **Step 2: 在 Icon.svelte 中添加 alert 和 info 图标**

```javascript
alert: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
  <line x1="12" y1="9" x2="12" y2="13"></line>
  <line x1="12" y1="17" x2="12.01" y2="17"></line>
</svg>`,
info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <circle cx="12" cy="12" r="10"></circle>
  <line x1="12" y1="16" x2="12" y2="12"></line>
  <line x1="12" y1="8" x2="12.01" y2="8"></line>
</svg>`
```

- [ ] **Step 3: 添加退出动画**

```css
.toast-exit {
  animation: slideOut 0.3s ease-in forwards;
}

@keyframes slideOut {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
}
```

- [ ] **Step 4: 在 Toast 组件中添加退出逻辑**

```javascript
function removeToastWithAnimation(id) {
  const toast = document.querySelector(`[data-toast-id="${id}"]`);
  if (toast) {
    toast.classList.add('toast-exit');
    setTimeout(() => removeToast(id), 300);
  } else {
    removeToast(id);
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/client/components/common/Toast.svelte src/client/components/common/Icon.svelte
git commit -m "feat: fix Toast warning icon and add exit animation"
```

---

### Task 13: 抽取 Navbar 组件

**Files:**
- Create: `src/client/components/chat/Navbar.svelte`
- Modify: `src/client/App.svelte`
- Modify: `src/client/components/common/Toolbar.svelte`

- [ ] **Step 1: 创建 Navbar.svelte**

```svelte
<script>
  import { createEventDispatcher } from 'svelte';
  import Icon from '$components/common/Icon.svelte';
  import { t } from '$lib/i18n.js';

  const dispatch = createEventDispatcher();

  export let title = '';

  function handleNewChat() {
    dispatch('newchat');
  }

  function handleOpenConfig() {
    dispatch('openConfig');
  }
</script>

<div class="navbar">
  <div class="navbar-title">{title}</div>
  <div class="navbar-actions">
    <button on:click={handleNewChat} title={$t('chat.new')}>
      <Icon name="edit" size="md" />
    </button>
    <button on:click={handleOpenConfig} title={$t('model.configure')}>
      <Icon name="settings" size="md" />
    </button>
  </div>
</div>

<style>
  .navbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    background: var(--bg-raised);
    border-bottom: 1px solid var(--border);
  }

  .navbar-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .navbar-actions {
    display: flex;
    gap: 8px;
  }

  .navbar-actions button {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.15s;
  }

  .navbar-actions button:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
</style>
```

- [ ] **Step 2: 修改 Toolbar.svelte — 移除聊天相关按钮**

将新建对话和配置按钮从 Toolbar 移到 Navbar

- [ ] **Step 3: 修改 App.svelte — 添加 Navbar**

在 ChatPanel 上方添加 Navbar 组件

- [ ] **Step 4: Commit**

```bash
git add src/client/components/chat/Navbar.svelte src/client/App.svelte src/client/components/common/Toolbar.svelte
git commit -m "feat: extract Navbar component from Toolbar"
```

---

### Task 14: 抽取 Placeholder 组件

**Files:**
- Create: `src/client/components/chat/Placeholder.svelte`
- Modify: `src/client/components/chat/ChatPanel.svelte`

- [ ] **Step 1: 创建 Placeholder.svelte**

将 ChatPanel 中的欢迎页逻辑抽取到独立组件

- [ ] **Step 2: 修改 ChatPanel.svelte**

用 Placeholder 组件替代内联欢迎页

- [ ] **Step 3: Commit**

```bash
git add src/client/components/chat/Placeholder.svelte src/client/components/chat/ChatPanel.svelte
git commit -m "feat: extract Placeholder component for empty state"
```

---

### Task 15: 抽取 Messages 组件

**Files:**
- Create: `src/client/components/chat/Messages.svelte`
- Modify: `src/client/components/chat/ChatPanel.svelte`

- [ ] **Step 1: 创建 Messages.svelte**

将 ChatPanel 中的消息列表渲染逻辑抽取到独立组件，包含自动滚动

- [ ] **Step 2: 修改 ChatPanel.svelte**

用 Messages 组件替代内联消息列表

- [ ] **Step 3: Commit**

```bash
git add src/client/components/chat/Messages.svelte src/client/components/chat/ChatPanel.svelte
git commit -m "feat: extract Messages component for message list"
```

---

### Task 16: 引入 paneforge 分栏

**Files:**
- Modify: `package.json`
- Modify: `src/client/App.svelte`

- [ ] **Step 1: 安装 paneforge**

```bash
cd g:\claude.free && npm install paneforge
```

- [ ] **Step 2: 修改 App.svelte — 用 PaneGroup 替代手动 resize**

```svelte
<script>
  import { PaneGroup, Pane, PaneResizer } from 'paneforge';
</script>

<PaneGroup direction="horizontal">
  <Pane minSize={200} maxSize={400} defaultSize={280}>
    <ChatSidebar />
  </Pane>
  <PaneResizer />
  <Pane minSize={200} maxSize={400} defaultSize={240}>
    <FileTree />
  </Pane>
  <PaneResizer />
  <Pane>
    <div class="content">
      <ChatPanel />
      <PaneResizer direction="vertical" />
      <CodeEditor />
    </div>
  </Pane>
</PaneGroup>
```

- [ ] **Step 3: 删除手动 resize 逻辑**

移除 `resizeHandle`、`resizing`、`resizeStartY` 等变量和函数

- [ ] **Step 4: Commit**

```bash
git add package.json src/client/App.svelte
git commit -m "feat: use paneforge for resizable panes"
```

---

### Task 17: 添加 ChatControls 组件

**Files:**
- Create: `src/client/components/chat/ChatControls.svelte`

- [ ] **Step 1: 创建 ChatControls.svelte**

参考 open-webui 的 ChatControls，添加工具/技能/Web搜索开关

- [ ] **Step 2: 集成到 ChatPanel**

在 MessageInput 上方添加 ChatControls

- [ ] **Step 3: Commit**

```bash
git add src/client/components/chat/ChatControls.svelte
git commit -m "feat: add ChatControls component for feature toggles"
```

---

### Task 18: 增强 MessageInput

**Files:**
- Modify: `src/client/components/chat/ChatInput.svelte`

- [ ] **Step 1: 添加文件拖拽支持**

```javascript
function handleDrop(e) {
  e.preventDefault();
  const files = Array.from(e.dataTransfer.files);
  // 处理文件
}

function handlePaste(e) {
  const items = Array.from(e.clipboardData.items);
  const imageItem = items.find(item => item.type.startsWith('image/'));
  if (imageItem) {
    const file = imageItem.getAsFile();
    // 处理图片
  }
}
```

- [ ] **Step 2: 添加自动高度**

```javascript
function autoResize() {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
}
```

- [ ] **Step 3: Commit**

```bash
git add src/client/components/chat/ChatInput.svelte
git commit -m "feat: enhance ChatInput with file drop and auto-resize"
```

---

## 第二批完成检查点

完成以上 11 个任务后，执行以下验证：

```bash
cd g:\claude.free && npx vite build && node src/server/index.js
```

在浏览器中测试：
1. 拖拽分栏 → 验证 paneforge 工作
2. 打开模态框 → 验证焦点陷阱和滚动锁定
3. 右键菜单 → 验证边界检测
4. Toast 通知 → 验证退出动画和图标
5. 命令面板 → 验证所有快捷键
6. 文件拖拽 → 验证 ChatInput 增强

---

## 依赖关系图

```
Task 1 (marked) ──────────────────────────────────────────┐
Task 2 (Markdown) ── 依赖 Task 1 ─────────────────────────┤
Task 3 (i18n 基础) ───────────────────────────────────────┤
Task 4 (i18n 集成) ── 依赖 Task 3 ────────────────────────┤
Task 5 (Parameters) ── 依赖 Task 6 ───────────────────────
Task 6 (存储统一) ────────────────────────────────────────┤
Task 7 (编辑器) ──────────────────────────────────────────
                                                          │
Task 8 (Store 修复) ─ 依赖 Task 6 ───────────────────────┤
Task 9 (命令监听) ───────────────────────────────────────┤
Task 10 (Modal) ──────────────────────────────────────────┤
Task 11 (ContextMenu) ────────────────────────────────────┤
Task 12 (Toast) ──────────────────────────────────────────┤
Task 13 (Navbar) ─────────────────────────────────────────
Task 14 (Placeholder) ────────────────────────────────────┤
Task 15 (Messages) ── 依赖 Task 14 ───────────────────────┤
Task 16 (paneforge) ── 依赖 Task 13 ─────────────────────┤
Task 17 (ChatControls) ── 依赖 Task 15 ───────────────────┤
Task 18 (MessageInput) ───────────────────────────────────┘
```

## 风险缓解

1. **Task 4 i18n 改动面广**：最后执行，避免合并冲突
2. **Task 6 存储统一**：影响所有消息相关组件，需充分测试
3. **Task 16 paneforge**：引入新依赖，需适配现有布局
4. **Task 17-18 功能增强**：依赖前面任务完成，放在最后
