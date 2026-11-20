import {
  AFFECTIVE_AUDIO_TRACKS,
  DEFAULT_CCT_SETTINGS,
  DEFAULT_ENVIRONMENT_CONFIG,
} from './constants';
import type {
  CctSettings,
  EnvironmentConfig,
  SessionRecord,
  YouTubePreset,
} from './types';

const SETTINGS_KEY = 'acct-settings-v2';
const ENV_KEY = 'acct-env-v1';
const PRESETS_KEY = 'acct-presets-v1';
const SESSIONS_FALLBACK_KEY = 'acct-sessions-v1';
const DB_NAME = 'acct-local-db-v1';
const DB_VERSION = 1;
export const MAX_SAVED_SESSIONS = 100;

export const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

export function normalizeCctSettings(
  raw?: Partial<CctSettings> | null
): CctSettings {
  const m = { ...DEFAULT_CCT_SETTINGS, ...(raw || {}) };
  const minIntervalMs = clamp(Math.round(Number(m.minIntervalMs) || 250), 50, 5000);
  const maxIntervalMs = clamp(
    Math.max(minIntervalMs, Math.round(Number(m.maxIntervalMs) || 5000)),
    minIntervalMs,
    10000
  );
  return {
    sessionMode: m.sessionMode === 'correct' ? 'correct' : 'timer',
    durationMinutes: clamp(Math.round(Number(m.durationMinutes) || 5), 1, 120),
    correctTarget: clamp(Math.round(Number(m.correctTarget) || 25), 1, 500),
    nBack: clamp(Math.round(Number(m.nBack) || 1), 1, 8),
    startIntervalMs: clamp(
      Math.round(Number(m.startIntervalMs) || 2500),
      minIntervalMs,
      maxIntervalMs
    ),
    minIntervalMs,
    maxIntervalMs,
    stepDownMs: clamp(Math.round(Number(m.stepDownMs) || 100), 10, 1000),
    stepUpMs: clamp(Math.round(Number(m.stepUpMs) || 100), 10, 1000),
    correctThreshold: clamp(Math.round(Number(m.correctThreshold) || 4), 1, 20),
    wrongThreshold: clamp(Math.round(Number(m.wrongThreshold) || 4), 1, 20),
    showTimer: m.showTimer !== false,
    showIntervalStats: m.showIntervalStats !== false,
    showVisualDigit: Boolean(m.showVisualDigit),
    beepEnabled: m.beepEnabled !== false,
    beepVolume: clamp(Number(m.beepVolume ?? 0.2), 0, 1),
    buttonMode: Boolean(m.buttonMode),
  };
}

export function loadCctSettings(): CctSettings {
  if (typeof window === 'undefined') return DEFAULT_CCT_SETTINGS;
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    return normalizeCctSettings(raw);
  } catch {
    return DEFAULT_CCT_SETTINGS;
  }
}

export function saveCctSettings(settings: CctSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage errors
  }
}

export function loadEnvironmentConfig(): EnvironmentConfig {
  if (typeof window === 'undefined') return DEFAULT_ENVIRONMENT_CONFIG;
  try {
    const saved = JSON.parse(localStorage.getItem(ENV_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return DEFAULT_ENVIRONMENT_CONFIG;
    const validIds = new Set(AFFECTIVE_AUDIO_TRACKS.map((t) => t.id));
    const selected = Array.isArray(saved.affectiveSelectedTrackIds)
      ? saved.affectiveSelectedTrackIds.filter((id: string) => validIds.has(id))
      : DEFAULT_ENVIRONMENT_CONFIG.affectiveSelectedTrackIds;
    return {
      ...DEFAULT_ENVIRONMENT_CONFIG,
      ...saved,
      backgroundMode:
        saved.backgroundMode === 'youtube' ? 'youtube' : 'standard',
      youtubeVolume: clamp(Number(saved.youtubeVolume ?? 65), 0, 100),
      youtubeScrimOpacity: clamp(Number(saved.youtubeScrimOpacity ?? 0), 0, 60),
      affectiveVolume: clamp(Number(saved.affectiveVolume ?? 70), 0, 100),
      affectiveGapSeconds: clamp(Number(saved.affectiveGapSeconds ?? 0.3), 0, 5),
      affectiveSingleTrackId: validIds.has(saved.affectiveSingleTrackId)
        ? saved.affectiveSingleTrackId
        : DEFAULT_ENVIRONMENT_CONFIG.affectiveSingleTrackId,
      affectiveSelectedTrackIds: selected,
    };
  } catch {
    return DEFAULT_ENVIRONMENT_CONFIG;
  }
}

export function saveEnvironmentConfig(env: EnvironmentConfig) {
  try {
    localStorage.setItem(ENV_KEY, JSON.stringify(env));
  } catch {
    // ignore
  }
}

export function loadYouTubePresets(): YouTubePreset[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = JSON.parse(localStorage.getItem(PRESETS_KEY) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

export function saveYouTubePresets(presets: YouTubePreset[]) {
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  } catch {
    // ignore
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('sessions')) {
        db.createObjectStore('sessions', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('DB open error'));
  });
}

export async function loadSessions(): Promise<SessionRecord[]> {
  try {
    const db = await openDatabase();
    const list = await new Promise<SessionRecord[]>((resolve, reject) => {
      const tx = db.transaction('sessions', 'readonly');
      const r = tx.objectStore('sessions').getAll();
      r.onsuccess = () => resolve((r.result || []) as SessionRecord[]);
      r.onerror = () => reject(r.error);
    });
    db.close();
    return list.sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  } catch {
    try {
      const fallback = JSON.parse(
        localStorage.getItem(SESSIONS_FALLBACK_KEY) || '[]'
      );
      return Array.isArray(fallback) ? fallback : [];
    } catch {
      return [];
    }
  }
}

export async function persistSession(
  session: SessionRecord,
  droppedIds: string[]
): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('sessions', 'readwrite');
      const store = tx.objectStore('sessions');
      store.put(session);
      for (const id of droppedIds) store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    try {
      const current: SessionRecord[] = JSON.parse(
        localStorage.getItem(SESSIONS_FALLBACK_KEY) || '[]'
      );
      const next = [session, ...current].slice(0, MAX_SAVED_SESSIONS);
      localStorage.setItem(SESSIONS_FALLBACK_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
}

export async function clearAllSessions(): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('sessions', 'readwrite');
      tx.objectStore('sessions').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    localStorage.removeItem(SESSIONS_FALLBACK_KEY);
  }
}
