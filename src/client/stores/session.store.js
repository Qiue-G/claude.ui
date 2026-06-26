/**
 * Session Store - manages session and connection state
 * Now persists sessionId/token/csrfToken to localStorage for auto-reconnect on page refresh.
 */
import { writable } from 'svelte/store';

const STORAGE_KEY = 'claude_ui_session';

function loadSession() {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (!val) return {};
    const parsed = JSON.parse(val);
    // Discard sessions older than 1 hour (server-side timeout)
    if (parsed._ts && Date.now() - parsed._ts > 3600000) {
      localStorage.removeItem(STORAGE_KEY);
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

function persistSession(sid, token, csrf) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      sessionId: sid,
      sessionToken: token,
      csrfToken: csrf || null,
      _ts: Date.now()
    }));
  } catch {}
}

const stored = loadSession();

export const sessionId = writable(stored.sessionId || null);
export const sessionToken = writable(stored.sessionToken || null);
export const csrfToken = writable(stored.csrfToken || null);
export const isConnected = writable(false);
export const connectionStatus = writable('disconnected'); // 'disconnected' | 'connecting' | 'connected' | 'error'

// Auto-persist to localStorage whenever session values change
let _sid = stored.sessionId || null;
let _token = stored.sessionToken || null;
let _csrf = stored.csrfToken || null;

sessionId.subscribe(v => { _sid = v; persistSession(v, _token, _csrf); });
sessionToken.subscribe(v => { _token = v; persistSession(_sid, v, _csrf); });
csrfToken.subscribe(v => { _csrf = v; persistSession(_sid, _token, v); });

/**
 * Clear the stored session (e.g. when server restarted and session is invalid).
 */
export function clearSession() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  sessionId.set(null);
  sessionToken.set(null);
  csrfToken.set(null);
}
