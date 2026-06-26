# Frontend Fix Design — 与 open-webui 对齐

**日期：** 2026-06-25
**状态：** 已批准
**范围：** 分两批修复，第一批 5 项（高优先级），第二批 14 项（中低优先级）

---

## 背景

项目从单文件 `index.html`（4450+ 行）重构为 Svelte + Vite 模块化架构，参考了 open-webui 仓库的组织方式。功能测试 9/9 通过，但对照 open-webui 发现 19 处差异，分为两批修复。

---

## 第一批：高优先级（5 项）

### 1.1 Markdown 渲染 — 引入 marked 库

**问题：** `ChatMessage.svelte` 的 `renderMarkdown()` 用 ~50 行手写正则解析 Markdown，不支持表格、引用块、图片、水平线，有序列表未包裹 `<ol>`，嵌套列表不支持。

**方案：**
- `npm install marked`
- 删除 `renderMarkdown()` 函数
- 用 `marked.parse(content, { breaks: true, gfm: true })` 替代
- 保留 `escapeHtml` 用于用户输入防护
- marked 默认不 sanitize，对 AI 生成的内容需要过滤 `<script>` 等危险标签
- 行内代码、代码块、标题、列表、链接全部由 marked 统一处理

**改动文件：** `src/client/components/chat/ChatMessage.svelte`

**验收标准：**
- 表格 `| col | col |` 正确渲染
- 引用块 `> text` 正确渲染
- 图片 `![alt](url)` 正确渲染
- 有序列表 `1. item` 包裹在 `<ol>` 中
- 嵌套列表正确渲染
- 代码块仍由 CodeBlock 组件处理（marked 提取后替换）

### 1.2 i18n 集成 — 完善自定义 t() 函数

**问题：** `i18n.js` 定义了 ~50 个翻译 key 和 `t()` 函数，但所有组件使用硬编码中文文本，语言切换完全无效。

**方案：**
- 将 `t()` 改为从 `currentLocale` store 派生的函数
- 组件中用 `$t('key')` 自动响应语言变化
- 补全缺失的翻译 key（从 ~50 扩展到 ~100+）
- 逐个组件替换硬编码文本

**改动文件：**
- `src/client/lib/i18n.js` — 改造 t() 为派生函数
- `src/client/components/chat/ChatPanel.svelte`
- `src/client/components/chat/ChatMessage.svelte`
- `src/client/components/chat/ChatInput.svelte`
- `src/client/components/chat/ChatSidebar.svelte`
- `src/client/components/common/Toolbar.svelte`
- `src/client/components/common/ThemeToggle.svelte`
- `src/client/components/common/LanguageSelector.svelte`
- `src/client/components/common/CommandPalette.svelte`
- `src/client/components/common/Modal.svelte`
- `src/client/components/common/ContextMenu.svelte`
- `src/client/components/files/FileTree.svelte`
- `src/client/components/editor/CodeEditor.svelte`
- `src/client/components/models/ModelSelector.svelte`
- `src/client/components/models/ConfigModal.svelte`
- `src/client/components/models/ModelList.svelte`
- `src/client/components/models/ModelParametersPanel.svelte`
- `src/client/App.svelte`

**验收标准：**
- 切换语言后所有界面文本立即变化
- 中文和英文翻译完整覆盖
- 新增文本自动回退到中文

### 1.3 ModelParametersPanel 接入

**问题：** `ModelParametersPanel.svelte` 已实现（temperature、topP、maxTokens、frequencyPenalty、presencePenalty），但未在 `App.svelte` 中使用，用户无法访问。

**方案：**
- 在 Toolbar 右侧或 ChatPanel 顶部添加 ModelParametersPanel 组件
- 发送消息时将参数通过 WebSocket 传递给后端
- 参数变更时持久化到 localStorage（已实现）

**改动文件：**
- `src/client/App.svelte` — 引入并使用 ModelParametersPanel
- `src/client/lib/websocket.js` — 发送消息时附带参数

**验收标准：**
- 用户可通过按钮打开参数面板
- 调整参数后发送消息，后端收到参数
- 参数刷新页面后保留

### 1.4 存储架构统一 — 参考 open-webui

**问题：**
- `chat.store.js` 的 `messages` writable store 和 `chatHistory.store.js` 的 `session.messages` 双重存储，`addMessage` 同时写入两个 store，可能不一致
- `chatHistory.store.js` 底部同步调用 `createSession()`，但 `initChatHistory()` 是异步的，可能竞争
- `syncSessions()` 有订阅泄漏：`sessions.subscribe(s => currentSessions.push(...s))()` 创建永不过期订阅

**方案（参考 open-webui）：**
- open-webui 的做法：消息历史作为组件本地 state（`history = { messages: {}, currentId: null }`），chats store 只管理会话列表
- 对应到本项目：
  - `messages` 改为 `derived([currentSession], ([$s]) => $s?.messages || [])`
  - `addMessage`、`appendToLastAssistant`、`clearMessages` 只操作 `sessions` store
  - 删除 `chatHistory.store.js` 底部的同步 `createSession()` 调用
  - `initChatHistory()` 作为唯一初始化入口
  - 修复 `syncSessions()`：直接读取 `get(sessions)` 而非 subscribe

**改动文件：**
- `src/client/stores/chat.store.js`
- `src/client/stores/chatHistory.store.js`

**验收标准：**
- 消息只存在于 `sessions` store 中，无双重写入
- `initChatHistory()` 异步加载后正确初始化默认会话
- `syncSessions()` 不泄漏订阅
- 所有现有功能（发送消息、切换会话、新建对话）正常工作

### 1.5 编辑器行号同步

**问题：**
- 行号和 textarea 是两个独立滚动容器，滚动不同步
- `{#each Array(lineCount) as _, i}` 每次输入全量重渲染行号，性能差
- Tab 键移出焦点而非插入制表符

**方案：**
- 行号和 textarea 放入同一个 `overflow: auto` 容器，用 `display: flex` 并排
- 行号用 `white-space: pre` + 固定 `line-height` 与文本对齐
- Tab 键拦截：`on:keydown` 中 `e.preventDefault()` + 插入 `\t`

**改动文件：** `src/client/components/editor/CodeEditor.svelte`

**验收标准：**
- 行号与文本行精确对齐
- 滚动时行号与文本同步
- Tab 键插入制表符而非移出焦点
- 大文件（1000+ 行）行号渲染无明显卡顿

---

## 第二批：中低优先级（14 项）

### 2.1 抽取 Navbar 组件

**问题：** 聊天标题和操作按钮散落在 Toolbar 和 ChatPanel 中，职责不清。

**方案：** 抽取 `Navbar.svelte`，显示当前聊天标题、新建对话按钮、设置按钮。

### 2.2 抽取 Placeholder 组件

**问题：** 欢迎页逻辑嵌在 ChatPanel 内部。

**方案：** 抽取 `Placeholder.svelte`，处理空状态（欢迎页 + 建议按钮），参考 open-webui 的 Placeholder。

### 2.3 引入 paneforge 分栏

**问题：** 手动 resize-handle 体验差，无法持久化面板大小。

**方案：** `npm install paneforge`，用 `PaneGroup` + `Pane` + `PaneResizer` 替代手动 resize。

### 2.4 添加 ChatControls 组件

**问题：** 缺少工具/技能/Web搜索开关面板。

**方案：** 添加 `ChatControls.svelte`，在消息输入上方显示可切换的功能开关。

### 2.5 增强 MessageInput

**问题：** 只有基础 textarea，缺少文件拖拽、图片粘贴。

**方案：** 增强 ChatInput，支持拖拽文件、粘贴图片、自动高度。

### 2.6 抽取 Messages 组件

**问题：** 消息列表直接在 ChatPanel 中渲染。

**方案：** 抽取 `Messages.svelte`，负责消息列表渲染和自动滚动。

### 2.7 修复 syncSessions 订阅泄漏

**问题：** `syncSessions()` 创建永不过期订阅。

**方案：** 改用 `get(sessions)` 直接读取。

### 2.8 修复同步/异步初始化冲突

**问题：** `chatHistory.store.js` 底部同步 `createSession()` 与异步 `initChatHistory()` 竞争。

**方案：** 删除底部同步调用，`initChatHistory()` 作为唯一入口。

### 2.9 删除 toggleTheme 死代码

**问题：** `theme.store.js` 的 `toggleTheme()` 未被使用。

**方案：** 删除或接入 ThemeToggle。

### 2.10 补全命令事件监听

**问题：** CommandPalette 通过 CustomEvent 分发命令，需确认 App.svelte 中 6 个事件都有监听器。

**方案：** 审查并补全缺失的事件监听。

### 2.11 Modal 焦点陷阱 + 滚动锁定

**问题：** Tab 键可跳出模态框，背景可滚动。

**方案：** 添加焦点陷阱（Tab 循环）和 `overflow: hidden` 滚动锁定。

### 2.12 ContextMenu 边界检测

**问题：** 右键菜单可能超出屏幕。

**方案：** 计算菜单尺寸，调整位置确保不超出视口。

### 2.13 Toast 图标修正 + 退出动画

**问题：** warning 用了 check 图标，无退出动画。

**方案：** warning 用专用图标，添加 `slideOut` 退出动画。

### 2.14 补全命令事件监听

**问题：** 同 2.10。

**方案：** 同 2.10。

---

## 依赖关系

```
第一批（可并行）:
  1.1 Markdown ── 独立
  1.2 i18n ────── 独立（但改动文件多）
  1.3 Parameters ─ 依赖 1.4（存储统一后参数传递更清晰）
  1.4 存储统一 ── 独立（但影响面广）
  1.5 编辑器 ──── 独立

第二批（有依赖）:
  2.7 + 2.8 + 2.9 + 2.10 + 2.13 + 2.14 ── 可并行（Store/交互修复）
  2.11 + 2.12 ──────────────────────────── 可并行（组件修复）
  2.1 + 2.2 + 2.6 ──────────────────────── 依赖第一批完成后重构
  2.3 paneforge ────────────────────────── 依赖 2.1 + 2.2
  2.4 + 2.5 ────────────────────────────── 依赖 2.6
```

## 风险

- **1.2 i18n 改动面广**：涉及 17+ 个文件，建议最后做，避免合并冲突
- **1.4 存储统一影响面广**：所有使用 `messages` store 的组件需要改为使用 `currentSession` 派生
- **2.3 paneforge**：引入新依赖，需要适配现有布局
