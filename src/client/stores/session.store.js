/**
 * Session Store - manages session and connection state
 */
import { writable } from 'svelte/store';

export const sessionId = writable(null);
export const sessionToken = writable(null);
export const csrfToken = writable(null);
export const isConnected = writable(false);
export const connectionStatus = writable('disconnected'); // 'disconnected' | 'connecting' | 'connected' | 'error'
