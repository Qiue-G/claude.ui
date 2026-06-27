/**
 * WebSocket Manager - handles real-time communication with server
 * Supports both WebSocket and SSE for streaming responses
 */
import { isConnected, connectionStatus, sessionId, sessionToken } from '$stores/session.store.js';
import { addMessage, appendToLastAssistant, isWaiting, isTyping } from '$stores/chat.store.js';
import { stripAnsi } from '$lib/utils.js';
import { get } from 'svelte/store';

let ws = null;
let eventSource = null;
let reconnectAttempts = 0;
let reconnectTimer = null;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000];
let autoReconnectEnabled = true;
let useSSEMode = false;

// Buffer for SSE streaming
let sseBuffer = '';
let sseFlushTimer = null;
const SSE_FLUSH_INTERVAL = 50; // ms

export function connectWebSocket(sid, token, autoReconnect = true, useSSE = false) {
  autoReconnectEnabled = autoReconnect;
  useSSEMode = useSSE;
  if (ws) {
    ws.onclose = null;
    ws.close();
  }
  if (eventSource) {
    eventSource.close();
  }

  connectionStatus.set('connecting');

  if (useSSE) {
    connectSSE(sid, token, autoReconnect);
  } else {
    connectWebSocketProtocol(sid, token, autoReconnect);
  }
}

function connectWebSocketProtocol(sid, token, autoReconnect) {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${protocol}//${location.host}/ws`;

  ws = new WebSocket(url);

  ws.onopen = () => {
    isConnected.set(true);
    connectionStatus.set('connected');
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    // Send init message to associate WebSocket with session
    ws.send(JSON.stringify({
      type: 'init',
      sessionId: sid,
      token: token
    }));
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

    // Auto reconnect using current session values from store
    if (autoReconnectEnabled && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      const currentSid = get(sessionId);
      const currentToken = get(sessionToken);
      if (!currentSid || !currentToken) return;

      const delay = RECONNECT_DELAYS[reconnectAttempts] || RECONNECT_DELAYS[RECONNECT_DELAYS.length - 1];
      reconnectAttempts++;
      connectionStatus.set('reconnecting');
      addMessage('system', `连接断开，${delay / 1000}秒后尝试重连 (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
      reconnectTimer = setTimeout(() => {
        connectWebSocket(currentSid, currentToken, autoReconnectEnabled, useSSEMode);
      }, delay);
    }
  };

  ws.onerror = () => {
    connectionStatus.set('error');
  };
}

function connectSSE(sid, token, autoReconnect) {
  const url = `/sse?sessionId=${sid}&token=${token}`;
  eventSource = new EventSource(url);

  eventSource.onopen = () => {
    isConnected.set(true);
    connectionStatus.set('connected');
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  eventSource.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleServerMessage(msg);
    } catch (e) {
      // Raw text message
      const text = stripAnsi(event.data);
      if (text.trim()) {
        bufferSSEContent(text);
      }
    }
  };

  eventSource.onerror = () => {
    isConnected.set(false);
    connectionStatus.set('error');
    isWaiting.set(false);
    isTyping.set(false);

    if (autoReconnectEnabled && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      const currentSid = get(sessionId);
      const currentToken = get(sessionToken);
      if (!currentSid || !currentToken) return;

      const delay = RECONNECT_DELAYS[reconnectAttempts] || RECONNECT_DELAYS[RECONNECT_DELAYS.length - 1];
      reconnectAttempts++;
      connectionStatus.set('reconnecting');
      reconnectTimer = setTimeout(() => {
        connectSSE(currentSid, currentToken, autoReconnectEnabled);
      }, delay);
    }
  };
}

function bufferSSEContent(text) {
  sseBuffer += text;
  
  if (!sseFlushTimer) {
    sseFlushTimer = setTimeout(() => {
      if (sseBuffer.trim()) {
        appendToLastAssistant(sseBuffer);
        sseBuffer = '';
      }
      sseFlushTimer = null;
    }, SSE_FLUSH_INTERVAL);
  }
}

let _sending = false;

export async function sendInput(data) {
  const text = typeof data === 'string' ? data : (data?.text || '');
  if (!text) return;

  if (_sending) {
    isWaiting.set(false);
    isTyping.set(false);
    addMessage('system', '请等待当前回复完成');
    return;
  }

  const sid = get(sessionId);
  const tok = get(sessionToken);

  if (!sid || !tok) {
    isWaiting.set(false);
    isTyping.set(false);
    addMessage('system', '会话未建立，请先连接模型');
    return;
  }

  _sending = true;

  try {
    const response = await fetch('/api/input', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sid, token: tok, data: { text } })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'HTTP ' + response.status);
    }

    // Read SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let eventType = 'message';
    let dataLines = [];
    let hasContent = false;

    function flushEvent() {
      const content = dataLines.join('\n');
      dataLines = [];
      switch (eventType) {
        case 'done':
          if (!hasContent) {
            addMessage('system', '模型未返回响应，请检查 API Key 和模型配置');
          }
          isWaiting.set(false);
          isTyping.set(false);
          break;
        case 'error':
          isWaiting.set(false);
          isTyping.set(false);
          if (content) addMessage('system', stripAnsi(content));
          break;
        case 'stderr':
          if (content) { appendToLastAssistant(stripAnsi(content)); hasContent = true; }
          break;
        default:
          if (content) { appendToLastAssistant(stripAnsi(content)); hasContent = true; }
      }
      eventType = 'message';
    }

    // Read with timeout: abort if no chunk arrives within 120s
    let lastChunkTime = Date.now();
    const READ_TIMEOUT = 120000; // 2 min

    while (true) {
      if (Date.now() - lastChunkTime > READ_TIMEOUT) {
        console.warn('SSE read timeout after ' + READ_TIMEOUT/1000 + 's');
        isWaiting.set(false);
        isTyping.set(false);
        addMessage('system', '连接超时，请重试');
        break;
      }

      const { done, value } = await reader.read();
      if (done) break;

      lastChunkTime = Date.now();
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line === '') {
          flushEvent();
        } else if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          dataLines.push(line.slice(6));
        } else if (line.startsWith(':')) {
          // SSE comment / heartbeat, ignore
        }
      }
    }
    // Flush any remaining event
    if (dataLines.length > 0 || eventType !== 'message') {
      flushEvent();
    }
  } catch (err) {
    console.error('sendInput error:', err);
    isWaiting.set(false);
    isTyping.set(false);
    addMessage('system', '发送失败: ' + (err.message || '未知错误'));
  } finally {
    _sending = false;
  }
}

export function disconnectWebSocket() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (sseFlushTimer) {
    clearTimeout(sseFlushTimer);
    sseFlushTimer = null;
  }
  sseBuffer = '';
  reconnectAttempts = MAX_RECONNECT_ATTEMPTS; // Prevent reconnect
  
  if (ws) {
    ws.onclose = null;
    ws.close();
    ws = null;
  }
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  
  isConnected.set(false);
  connectionStatus.set('disconnected');
}

function handleServerMessage(msg) {
  switch (msg.type) {
    case 'ready':
      // Server acknowledged init - reset reconnect counter
      reconnectAttempts = 0;
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      isConnected.set(true);
      connectionStatus.set('connected');
      break;
    case 'output':
      appendToLastAssistant(stripAnsi(msg.data || ''));
      break;
    case 'done':
    case 'exit':
      // Flush any buffered content
      if (sseBuffer.trim()) {
        appendToLastAssistant(sseBuffer);
        sseBuffer = '';
      }
      isWaiting.set(false);
      isTyping.set(false);
      break;
    case 'error':
      isWaiting.set(false);
      isTyping.set(false);
      addMessage('system', msg.message || 'Unknown error');
      // Stop reconnecting on auth/session errors
      if (msg.message && /invalid|expired/i.test(msg.message)) {
        autoReconnectEnabled = false;
        reconnectAttempts = MAX_RECONNECT_ATTEMPTS;
      }
      break;
    case 'stderr':
      // Server-side stderr - log but don't reset waiting
      if (msg.data) {
        appendToLastAssistant(stripAnsi(msg.data));
      }
      break;
    case 'model_update':
      // Update model health
      break;
    default:
      break;
  }
}
