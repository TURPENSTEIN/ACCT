export type BackgroundMode = 'standard' | 'youtube';
export type SessionMode = 'timer' | 'correct';
export type AffectiveAudioMode = 'single' | 'mix' | 'custom';
export type AffectivePlaybackStyle = 'random_loop' | 'layered';

export interface CctSettings {
  sessionMode: SessionMode;
  durationMinutes: number;
  correctTarget: number;
  nBack: number;
  startIntervalMs: number;
  minIntervalMs: number;
  maxIntervalMs: number;
  stepDownMs: number;
  stepUpMs: number;
  correctThreshold: number;
  wrongThreshold: number;
  showTimer: boolean;
  showIntervalStats: boolean;
  showVisualDigit: boolean;
  beepEnabled: boolean;
  beepVolume: number; // 0 to 1
  buttonMode: boolean;
}

export interface YouTubePreset {
  id: string;
  label: string;
  url: string;
  videoId: string;
  startSeconds?: number;
}

export interface EnvironmentConfig {
  backgroundMode: BackgroundMode;
  youtubeUrl: string;
  youtubeVideoId: string;
  youtubeStartSeconds: number;
  youtubeVolume: number; // 0 to 100
  youtubeMuted: boolean;
  youtubeLoop: boolean;
  youtubeScrimOpacity: number; // 0 to 60 (default 0 for crystal-clear view)
  affectiveAudioEnabled: boolean;
  affectiveAudioMode: AffectiveAudioMode;
  affectivePlaybackStyle: AffectivePlaybackStyle;
  affectiveSingleTrackId: string;
  affectiveSelectedTrackIds: string[];
  affectiveVolume: number; // 0 to 100
  affectiveGapSeconds: number; // 0 to 5
}

export interface AffectiveAudioTrack {
  id: string;
  title: string;
  category: string;
  src: string;
}

export interface TrialRecord {
  trialNo: number;
  currentDigit: number;
  nBackDigit: number;
  expectedSum: number;
  response: number | null;
  correct: boolean;
  missed: boolean;
  responseTimeMs: number | null;
  intervalMs: number;
}

export interface SessionRecord {
  id: string;
  startedAt: string;
  durationSeconds: number;
  modeLabel: string; // e.g., 'Standard', 'YouTube', 'YT + Audio', 'Affective'
  backgroundMode: BackgroundMode;
  youtubeVideoId?: string;
  affectiveAudioSummary: string;
  nBack: number;
  accuracy: number;
  questions: number;
  correctCount: number;
  lowestIsiMs: number;
  avgResponseMs: number | null;
  trials: TrialRecord[];
}
