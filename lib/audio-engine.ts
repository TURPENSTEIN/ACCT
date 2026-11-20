import { AFFECTIVE_AUDIO_TRACKS } from './constants';
import { clamp } from './storage';
import type {
  AffectiveAudioMode,
  AffectiveAudioTrack,
  AffectivePlaybackStyle,
} from './types';

let sharedAudioCtx: AudioContext | null = null;

export function prepareAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return null;
  sharedAudioCtx = sharedAudioCtx || new AudioCtx();
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

export function playErrorBeep(volume = 0.2) {
  try {
    const ctx = prepareAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 1200;
    gain.gain.value = clamp(volume, 0, 1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    osc.start(now);
    osc.stop(now + 0.08);
  } catch {
    // ignore if browser audio blocked
  }
}

// Speech queue for crisp spoken digits scaled to current interval (matching PASAT/CCT reference)
let speechQueue: { text: string; rate: number }[] = [];
let speechActive = false;

function getAutoVoiceRate(intervalMs: number): number {
  const intervalValue = clamp(Number(intervalMs) || 1000, 200, 1000);
  const normalized = (1000 - intervalValue) / 800;
  return clamp(2.4 + normalized * 4.2, 2.4, 6.6);
}

function processSpeechQueue() {
  if (speechActive || typeof window === 'undefined') return;
  if (
    !('speechSynthesis' in window) ||
    typeof SpeechSynthesisUtterance === 'undefined'
  ) {
    return;
  }
  if (!speechQueue.length) return;

  const nextItem = speechQueue.shift()!;
  speechActive = true;
  const utterance = new SpeechSynthesisUtterance(nextItem.text);
  utterance.lang = 'en-US';
  utterance.rate = nextItem.rate;
  utterance.pitch = 1;
  utterance.volume = 1;
  utterance.onerror = () => {
    speechActive = false;
    setTimeout(processSpeechQueue, 0);
  };
  utterance.onend = () => {
    speechActive = false;
    setTimeout(processSpeechQueue, 0);
  };
  try {
    window.speechSynthesis.speak(utterance);
  } catch {
    speechActive = false;
  }
}

export function speakDigit(digit: number, intervalMs: number) {
  if (typeof window === 'undefined') return;
  if (
    !('speechSynthesis' in window) ||
    typeof SpeechSynthesisUtterance === 'undefined'
  ) {
    return;
  }
  // Keep queue tight so fast intervals don't pile up behind slow speech
  if (speechQueue.length > 1) {
    speechQueue = speechQueue.slice(-1);
  }
  speechQueue.push({
    text: String(digit),
    rate: getAutoVoiceRate(intervalMs),
  });
  processSpeechQueue();
}

export function clearSpeechQueue() {
  speechQueue = [];
  speechActive = false;
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}

export interface AffectiveEngineOptions {
  mode: AffectiveAudioMode;
  playbackStyle: AffectivePlaybackStyle;
  singleTrackId: string;
  selectedTrackIds: string[];
  volume: number; // 0-100
  gapSeconds: number;
}

export class AffectiveAudioEngine {
  private activeElements: HTMLAudioElement[] = [];
  private gapTimer: ReturnType<typeof setTimeout> | null = null;
  private isPlaying = false;
  private lastTrackId: string | null = null;
  private currentOptions: AffectiveEngineOptions;
  private onNowPlayingChange?: (tracks: AffectiveAudioTrack[]) => void;

  constructor(
    initialOptions: AffectiveEngineOptions,
    onNowPlayingChange?: (tracks: AffectiveAudioTrack[]) => void
  ) {
    this.currentOptions = initialOptions;
    this.onNowPlayingChange = onNowPlayingChange;
  }

  private getPool(opts: AffectiveEngineOptions): AffectiveAudioTrack[] {
    if (opts.mode === 'single') {
      const found = AFFECTIVE_AUDIO_TRACKS.find(
        (t) => t.id === opts.singleTrackId
      );
      return found ? [found] : [AFFECTIVE_AUDIO_TRACKS[0]];
    }
    if (opts.mode === 'mix') {
      return AFFECTIVE_AUDIO_TRACKS;
    }
    const chosen = AFFECTIVE_AUDIO_TRACKS.filter((t) =>
      opts.selectedTrackIds.includes(t.id)
    );
    return chosen.length ? chosen : [];
  }

  private pickRandomTrack(pool: AffectiveAudioTrack[]): AffectiveAudioTrack {
    if (pool.length === 1) return pool[0];
    const filtered = this.lastTrackId
      ? pool.filter((t) => t.id !== this.lastTrackId)
      : pool;
    const candidates = filtered.length ? filtered : pool;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  private clearActive() {
    if (this.gapTimer) {
      clearTimeout(this.gapTimer);
      this.gapTimer = null;
    }
    for (const el of this.activeElements) {
      try {
        el.pause();
        el.currentTime = 0;
        el.onended = null;
      } catch {
        // ignore
      }
    }
    this.activeElements = [];
  }

  public updateOptions(opts: AffectiveEngineOptions) {
    const prev = this.currentOptions;
    this.currentOptions = opts;

    const gain = clamp(opts.volume / 100, 0, 1);
    const layerAttenuation =
      opts.mode === 'custom' &&
      opts.playbackStyle === 'layered' &&
      this.activeElements.length > 1
        ? 1 / Math.sqrt(this.activeElements.length)
        : 1;
    for (const el of this.activeElements) {
      el.volume = clamp(gain * layerAttenuation, 0, 1);
    }

    if (!this.isPlaying) return;

    const modeChanged =
      prev.mode !== opts.mode ||
      prev.playbackStyle !== opts.playbackStyle ||
      prev.singleTrackId !== opts.singleTrackId ||
      JSON.stringify(prev.selectedTrackIds) !==
        JSON.stringify(opts.selectedTrackIds);

    if (modeChanged) {
      this.stop();
      this.start();
    }
  }

  public start() {
    this.clearActive();
    const pool = this.getPool(this.currentOptions);
    if (!pool.length) {
      this.isPlaying = false;
      this.onNowPlayingChange?.([]);
      return;
    }
    this.isPlaying = true;
    const { mode, playbackStyle } = this.currentOptions;

    if (mode === 'single') {
      this.playSingleLoop(pool[0]);
      return;
    }
    if (mode === 'custom' && playbackStyle === 'layered') {
      this.playLayered(pool);
      return;
    }
    this.playNextRandomFromPool();
  }

  private playSingleLoop(track: AffectiveAudioTrack) {
    if (!this.isPlaying) return;
    const audio = new Audio(track.src);
    audio.loop = true;
    audio.volume = clamp(this.currentOptions.volume / 100, 0, 1);
    this.activeElements = [audio];
    this.lastTrackId = track.id;
    this.onNowPlayingChange?.([track]);
    audio.play().catch(() => {});
  }

  private playLayered(pool: AffectiveAudioTrack[]) {
    if (!this.isPlaying) return;
    const attenuation = pool.length > 1 ? 1 / Math.sqrt(pool.length) : 1;
    const vol = clamp((this.currentOptions.volume / 100) * attenuation, 0, 1);
    const elements: HTMLAudioElement[] = [];
    for (const track of pool) {
      const audio = new Audio(track.src);
      audio.loop = true;
      audio.volume = vol;
      audio.play().catch(() => {});
      elements.push(audio);
    }
    this.activeElements = elements;
    this.onNowPlayingChange?.(pool);
  }

  private playNextRandomFromPool() {
    if (!this.isPlaying) return;
    const pool = this.getPool(this.currentOptions);
    if (!pool.length) {
      this.stop();
      return;
    }

    const track = this.pickRandomTrack(pool);
    this.lastTrackId = track.id;

    const audio = new Audio(track.src);
    audio.loop = false;
    audio.volume = clamp(this.currentOptions.volume / 100, 0, 1);
    this.activeElements = [audio];
    this.onNowPlayingChange?.([track]);

    const scheduleNext = () => {
      if (!this.isPlaying) return;
      const delayMs = Math.max(
        50,
        Math.round(this.currentOptions.gapSeconds * 1000)
      );
      this.gapTimer = setTimeout(() => {
        this.gapTimer = null;
        this.playNextRandomFromPool();
      }, delayMs);
    };

    audio.onended = scheduleNext;
    audio.onerror = scheduleNext;
    audio.play().catch(() => {
      this.isPlaying = false;
      this.onNowPlayingChange?.([]);
    });
  }

  public stop() {
    this.isPlaying = false;
    this.clearActive();
    this.onNowPlayingChange?.([]);
  }

  public getIsPlaying() {
    return this.isPlaying;
  }
}
