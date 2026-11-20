'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BookmarkPlus,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Film,
  Layers,
  Pause,
  Play,
  RotateCw,
  Settings,
  Shuffle,
  Square,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  AFFECTIVE_AUDIO_TRACKS,
  DEFAULT_CCT_SETTINGS,
  DEFAULT_ENVIRONMENT_CONFIG,
} from '@/lib/constants';
import {
  AffectiveAudioEngine,
  clearSpeechQueue,
  playErrorBeep,
  prepareAudioContext,
  speakDigit,
} from '@/lib/audio-engine';
import {
  MAX_SAVED_SESSIONS,
  clamp,
  clearAllSessions,
  loadCctSettings,
  loadEnvironmentConfig,
  loadSessions,
  loadYouTubePresets,
  normalizeCctSettings,
  persistSession,
  saveCctSettings,
  saveEnvironmentConfig,
  saveYouTubePresets,
} from '@/lib/storage';
import { parseYouTubeUrl } from '@/lib/youtube';
import type {
  AffectiveAudioMode,
  AffectiveAudioTrack,
  AffectivePlaybackStyle,
  CctSettings,
  EnvironmentConfig,
  SessionRecord,
  TrialRecord,
  YouTubePreset,
} from '@/lib/types';
import YouTubeBackdrop from './YouTubeBackdrop';
import RecentSessionsTable from './RecentSessionsTable';
import SettingsPage from './SettingsPage';
import ProgressPage from './ProgressPage';

function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

export default function AcctApp() {
  const [page, setPage] = useState<'train' | 'progress' | 'settings'>('train');
  const [settings, setSettings] = useState<CctSettings>(DEFAULT_CCT_SETTINGS);
  const [env, setEnv] = useState<EnvironmentConfig>(DEFAULT_ENVIRONMENT_CONFIG);
  const [presets, setPresets] = useState<YouTubePreset[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);

  // YouTube input & status
  const [ytDraft, setYtDraft] = useState('');
  const [ytUrlError, setYtUrlError] = useState<string | null>(null);
  const [ytManualPlay, setYtManualPlay] = useState(false);
  const [ytPlaybackState, setYtPlaybackState] = useState<
    'idle' | 'playing' | 'paused' | 'buffering' | 'ended'
  >('idle');
  const [ytError, setYtError] = useState<string | null>(null);
  const [presetName, setPresetName] = useState('');

  // Affective audio UI state
  const [audioDrawerOpen, setAudioDrawerOpen] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [nowPlayingTracks, setNowPlayingTracks] = useState<
    AffectiveAudioTrack[]
  >([]);
  const [auditioningId, setAuditioningId] = useState<string | null>(null);
  const auditionAudioRef = useRef<HTMLAudioElement | null>(null);
  const affectiveEngineRef = useRef<AffectiveAudioEngine | null>(null);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live CCT session state
  const [running, setRunning] = useState(false);
  const [currentIntervalMs, setCurrentIntervalMs] = useState(
    DEFAULT_CCT_SETTINGS.startIntervalMs
  );
  const [remainingDisplay, setRemainingDisplay] = useState('5:00');
  const [feedbackDots, setFeedbackDots] = useState<boolean[]>([]);
  const [spokenDigit, setSpokenDigit] = useState<number | null>(null);
  const [answerInput, setAnswerInput] = useState('');
  const [lastResultSummary, setLastResultSummary] = useState<string | null>(
    null
  );

  const answerRef = useRef<HTMLInputElement | null>(null);
  const settingsRef = useRef(settings);
  const envRef = useRef(env);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    envRef.current = env;
  }, [env]);

  const gameRef = useRef({
    running: false,
    intervalMs: DEFAULT_CCT_SETTINGS.startIntervalMs,
    lowestIsiMs: DEFAULT_CCT_SETTINGS.startIntervalMs,
    numbers: [] as number[],
    awaitingAnswer: false,
    questionShownAt: 0,
    correctStreak: 0,
    wrongStreak: 0,
    correctCount: 0,
    questionsCount: 0,
    correctRemaining: 0,
    endTimeMs: 0,
    startedAtIso: '',
    startedPerf: 0,
    graceUntilMs: 0,
    trials: [] as TrialRecord[],
    loopTimer: null as ReturnType<typeof setTimeout> | null,
    clockTimer: null as ReturnType<typeof setInterval> | null,
  });

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2400);
  }, []);

  // Load persisted data on mount asynchronously
  useEffect(() => {
    let active = true;
    loadSessions().then((list) => {
      if (!active) return;
      const loadedSettings = loadCctSettings();
      const loadedEnv = loadEnvironmentConfig();
      const loadedPresets = loadYouTubePresets();

      setSessions(list);
      setSettings(loadedSettings);
      setEnv(loadedEnv);
      setYtDraft(loadedEnv.youtubeUrl || '');
      setPresets(loadedPresets);
      setCurrentIntervalMs(loadedSettings.startIntervalMs);
      setRemainingDisplay(
        loadedSettings.sessionMode === 'timer'
          ? formatCountdown(loadedSettings.durationMinutes * 60000)
          : String(loadedSettings.correctTarget)
      );
    });
    return () => {
      active = false;
    };
  }, []);

  // Initialize affective audio engine
  useEffect(() => {
    const engine = new AffectiveAudioEngine(
      {
        mode: envRef.current.affectiveAudioMode,
        playbackStyle: envRef.current.affectivePlaybackStyle,
        singleTrackId: envRef.current.affectiveSingleTrackId,
        selectedTrackIds: envRef.current.affectiveSelectedTrackIds,
        volume: envRef.current.affectiveVolume,
        gapSeconds: envRef.current.affectiveGapSeconds,
      },
      (tracks) => {
        setNowPlayingTracks(tracks);
        setAudioPlaying(tracks.length > 0);
      }
    );
    affectiveEngineRef.current = engine;
    return () => {
      engine.stop();
      if (auditionAudioRef.current) {
        auditionAudioRef.current.pause();
        auditionAudioRef.current = null;
      }
      clearSpeechQueue();
    };
  }, []);

  // Keep engine options updated
  useEffect(() => {
    affectiveEngineRef.current?.updateOptions({
      mode: env.affectiveAudioMode,
      playbackStyle: env.affectivePlaybackStyle,
      singleTrackId: env.affectiveSingleTrackId,
      selectedTrackIds: env.affectiveSelectedTrackIds,
      volume: env.affectiveVolume,
      gapSeconds: env.affectiveGapSeconds,
    });
  }, [
    env.affectiveAudioMode,
    env.affectivePlaybackStyle,
    env.affectiveSingleTrackId,
    env.affectiveSelectedTrackIds,
    env.affectiveVolume,
    env.affectiveGapSeconds,
  ]);

  const stopAudition = useCallback(() => {
    if (auditionAudioRef.current) {
      auditionAudioRef.current.pause();
      auditionAudioRef.current.currentTime = 0;
      auditionAudioRef.current = null;
    }
    setAuditioningId(null);
  }, []);

  const handleAuditionTrack = useCallback(
    (track: AffectiveAudioTrack) => {
      if (auditioningId === track.id) {
        stopAudition();
        return;
      }
      stopAudition();
      if (affectiveEngineRef.current?.getIsPlaying()) {
        affectiveEngineRef.current.stop();
      }
      const audio = new Audio(track.src);
      audio.volume = clamp(envRef.current.affectiveVolume / 100, 0, 1);
      audio.onended = () => {
        setAuditioningId(null);
        auditionAudioRef.current = null;
      };
      audio.onerror = () => {
        setAuditioningId(null);
        auditionAudioRef.current = null;
      };
      auditionAudioRef.current = audio;
      setAuditioningId(track.id);
      audio.play().catch(() => setAuditioningId(null));
    },
    [auditioningId, stopAudition]
  );

  const updateSettings = useCallback((patch: Partial<CctSettings>) => {
    setSettings((prev) => {
      const next = normalizeCctSettings({ ...prev, ...patch });
      saveCctSettings(next);
      if (!gameRef.current.running) {
        setCurrentIntervalMs(next.startIntervalMs);
        setRemainingDisplay(
          next.sessionMode === 'timer'
            ? formatCountdown(next.durationMinutes * 60000)
            : String(next.correctTarget)
        );
      }
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    saveCctSettings(DEFAULT_CCT_SETTINGS);
    setSettings(DEFAULT_CCT_SETTINGS);
    if (!gameRef.current.running) {
      setCurrentIntervalMs(DEFAULT_CCT_SETTINGS.startIntervalMs);
      setRemainingDisplay(
        formatCountdown(DEFAULT_CCT_SETTINGS.durationMinutes * 60000)
      );
    }
    showToast('Settings reset to defaults');
  }, [showToast]);

  const updateEnv = useCallback(
    (patch: Partial<EnvironmentConfig>) => {
      setEnv((prev) => {
        const next = { ...prev, ...patch };
        saveEnvironmentConfig(next);

        if (
          patch.youtubeVideoId &&
          patch.youtubeVideoId !== prev.youtubeVideoId
        ) {
          setYtManualPlay(true);
          setYtError(null);
        }
        if (patch.backgroundMode === 'standard') {
          setYtManualPlay(false);
        }
        if (patch.affectiveAudioEnabled === false) {
          affectiveEngineRef.current?.stop();
        }
        return next;
      });
    },
    []
  );

  const handleLoadYouTube = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      const parsed = parseYouTubeUrl(ytDraft);
      if (!parsed.videoId) {
        setYtUrlError(parsed.error || 'Paste a valid YouTube link.');
        return;
      }
      setYtUrlError(null);
      updateEnv({
        backgroundMode: 'youtube',
        youtubeUrl: ytDraft.trim(),
        youtubeVideoId: parsed.videoId,
        youtubeStartSeconds: parsed.startSeconds,
      });
      showToast('YouTube background loaded');
    },
    [ytDraft, updateEnv, showToast]
  );

  const handleSavePreset = useCallback(() => {
    const parsed = parseYouTubeUrl(ytDraft || env.youtubeUrl);
    if (!parsed.videoId) {
      setYtUrlError('Paste and load a valid YouTube link first.');
      return;
    }
    const label = presetName.trim() || `Video (${parsed.videoId})`;
    const nextPreset: YouTubePreset = {
      id: `yt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      label,
      url: (ytDraft || env.youtubeUrl).trim(),
      videoId: parsed.videoId,
      startSeconds: parsed.startSeconds,
    };
    setPresets((prev) => {
      const next = [nextPreset, ...prev];
      saveYouTubePresets(next);
      return next;
    });
    setPresetName('');
    showToast(`Saved preset: ${label}`);
  }, [ytDraft, env.youtubeUrl, presetName, showToast]);

  const handleDeletePreset = useCallback(
    (id: string) => {
      setPresets((prev) => {
        const next = prev.filter((p) => p.id !== id);
        saveYouTubePresets(next);
        return next;
      });
    },
    []
  );

  // =========================================================================
  // PASAT / CCT ENGINE (Auditory Spoken Digits + N-Back Summation)
  // =========================================================================

  const stopSession = useCallback(async () => {
    const g = gameRef.current;
    if (!g.running) return;
    g.running = false;
    if (g.loopTimer) clearTimeout(g.loopTimer);
    if (g.clockTimer) clearInterval(g.clockTimer);
    g.loopTimer = null;
    g.clockTimer = null;
    g.awaitingAnswer = false;

    clearSpeechQueue();
    affectiveEngineRef.current?.stop();
    setYtManualPlay(false);

    setRunning(false);
    setSpokenDigit(null);
    setAnswerInput('');

    const cfg = settingsRef.current;
    const currentEnv = envRef.current;

    setRemainingDisplay(
      cfg.sessionMode === 'timer'
        ? formatCountdown(cfg.durationMinutes * 60000)
        : String(cfg.correctTarget)
    );
    setCurrentIntervalMs(cfg.startIntervalMs);

    if (g.questionsCount > 0) {
      const accuracy = Math.round((g.correctCount / g.questionsCount) * 100);
      const validRts = g.trials
        .filter((t) => !t.missed && t.responseTimeMs != null)
        .map((t) => t.responseTimeMs as number);
      const avgResponseMs = validRts.length
        ? Math.round(validRts.reduce((a, b) => a + b, 0) / validRts.length)
        : null;

      const hasYt =
        currentEnv.backgroundMode === 'youtube' &&
        Boolean(currentEnv.youtubeVideoId);
      const hasAudio = currentEnv.affectiveAudioEnabled;
      const modeLabel =
        hasYt && hasAudio
          ? 'YT + Audio'
          : hasYt
            ? 'YouTube'
            : hasAudio
              ? 'Affective'
              : 'Standard';

      const affectiveAudioSummary = !hasAudio
        ? 'Off'
        : currentEnv.affectiveAudioMode === 'mix'
          ? 'Mix All (Random)'
          : currentEnv.affectiveAudioMode === 'single'
            ? AFFECTIVE_AUDIO_TRACKS.find(
                (t) => t.id === currentEnv.affectiveSingleTrackId
              )?.title || 'Single'
            : `${currentEnv.affectiveSelectedTrackIds.length} Selected`;

      const record: SessionRecord = {
        id: `acct-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        startedAt: g.startedAtIso,
        durationSeconds: Math.max(
          1,
          Math.round((performance.now() - g.startedPerf) / 1000)
        ),
        modeLabel,
        backgroundMode: hasYt ? 'youtube' : 'standard',
        youtubeVideoId: hasYt ? currentEnv.youtubeVideoId : undefined,
        affectiveAudioSummary,
        nBack: cfg.nBack,
        accuracy,
        questions: g.questionsCount,
        correctCount: g.correctCount,
        lowestIsiMs: g.lowestIsiMs,
        avgResponseMs,
        trials: g.trials.slice(),
      };

      setLastResultSummary(
        `Session saved · ${accuracy}% accuracy (${g.correctCount}/${g.questionsCount}) · Lowest ISI ${g.lowestIsiMs} ms`
      );

      setSessions((prev) => {
        const next = [record, ...prev];
        const dropped = next.slice(MAX_SAVED_SESSIONS).map((s) => s.id);
        const trimmed = next.slice(0, MAX_SAVED_SESSIONS);
        persistSession(record, dropped);
        return trimmed;
      });
    } else {
      setLastResultSummary('Session stopped before any scored questions.');
    }
  }, []);

  const registerOutcome = useCallback(
    (isCorrect: boolean, responseValue: number | null, isMissed: boolean) => {
      const g = gameRef.current;
      const cfg = settingsRef.current;
      const len = g.numbers.length;
      if (len < cfg.nBack + 1) return;

      const currentDigit = g.numbers[len - 1];
      const nBackDigit = g.numbers[len - 1 - cfg.nBack];
      const expectedSum = currentDigit + nBackDigit;
      const responseTimeMs = isMissed
        ? null
        : Math.max(0, Math.round(performance.now() - g.questionShownAt));

      g.questionsCount += 1;
      g.trials.push({
        trialNo: g.questionsCount,
        currentDigit,
        nBackDigit,
        expectedSum,
        response: responseValue,
        correct: isCorrect,
        missed: isMissed,
        responseTimeMs,
        intervalMs: g.intervalMs,
      });

      const maxDots = Math.max(cfg.correctThreshold, cfg.wrongThreshold, 8);
      setFeedbackDots((prev) => [...prev, isCorrect].slice(-maxDots));

      if (isCorrect) {
        g.correctCount += 1;
        g.correctStreak += 1;
        g.wrongStreak = 0;
        if (cfg.sessionMode === 'correct' && g.correctRemaining > 0) {
          g.correctRemaining -= 1;
          setRemainingDisplay(String(g.correctRemaining));
        }
      } else {
        g.wrongStreak += 1;
        g.correctStreak = 0;
        setAnswerInput('');
        if (cfg.beepEnabled) {
          playErrorBeep(cfg.beepVolume);
        }
      }

      // Adaptive ISI adjustment
      if (g.correctStreak >= cfg.correctThreshold) {
        g.correctStreak = 0;
        const nextIsi = clamp(
          g.intervalMs - cfg.stepDownMs,
          cfg.minIntervalMs,
          cfg.maxIntervalMs
        );
        if (nextIsi !== g.intervalMs) {
          g.intervalMs = nextIsi;
          g.lowestIsiMs = Math.min(g.lowestIsiMs, nextIsi);
          setCurrentIntervalMs(nextIsi);
        }
      }

      if (g.wrongStreak >= cfg.wrongThreshold) {
        g.wrongStreak = 0;
        const nextIsi = clamp(
          g.intervalMs + cfg.stepUpMs,
          cfg.minIntervalMs,
          cfg.maxIntervalMs
        );
        if (nextIsi !== g.intervalMs) {
          g.intervalMs = nextIsi;
          setCurrentIntervalMs(nextIsi);
        }
      }

      if (cfg.sessionMode === 'correct' && isCorrect && g.correctRemaining <= 0) {
        stopSession();
      }
    },
    [stopSession]
  );

  const gameLoopRef = useRef<() => void>(() => {});

  useEffect(() => {
    gameLoopRef.current = () => {
      const g = gameRef.current;
      const cfg = settingsRef.current;
      if (!g.running) return;

      const now = Date.now();
      if (g.awaitingAnswer && g.numbers.length >= cfg.nBack + 1) {
        if (now >= g.graceUntilMs) {
          registerOutcome(false, null, true);
        } else {
          setAnswerInput('');
        }
        g.awaitingAnswer = false;
      }

      if (!g.running) return;

      const digit = Math.floor(Math.random() * 9) + 1;
      g.numbers.push(digit);
      setSpokenDigit(digit);
      speakDigit(digit, g.intervalMs);

      if (g.numbers.length >= cfg.nBack + 1) {
        g.awaitingAnswer = true;
        g.questionShownAt = performance.now();
      }

      g.loopTimer = setTimeout(gameLoopRef.current, g.intervalMs);
    };
  }, [registerOutcome]);

  const startSession = useCallback(() => {
    const g = gameRef.current;
    const cfg = settingsRef.current;
    const currentEnv = envRef.current;

    if (g.running) return;
    prepareAudioContext();
    clearSpeechQueue();
    stopAudition();

    if (g.loopTimer) clearTimeout(g.loopTimer);
    if (g.clockTimer) clearInterval(g.clockTimer);

    g.running = true;
    g.intervalMs = cfg.startIntervalMs;
    g.lowestIsiMs = cfg.startIntervalMs;
    g.numbers = [];
    g.awaitingAnswer = false;
    g.questionShownAt = 0;
    g.correctStreak = 0;
    g.wrongStreak = 0;
    g.correctCount = 0;
    g.questionsCount = 0;
    g.trials = [];
    g.startedAtIso = new Date().toISOString();
    g.startedPerf = performance.now();
    g.graceUntilMs = Date.now() + 2500;

    if (cfg.sessionMode === 'timer') {
      g.endTimeMs = Date.now() + cfg.durationMinutes * 60000;
      setRemainingDisplay(formatCountdown(cfg.durationMinutes * 60000));
    } else {
      g.correctRemaining = cfg.correctTarget;
      g.endTimeMs = 0;
      setRemainingDisplay(String(cfg.correctTarget));
    }

    setRunning(true);
    setCurrentIntervalMs(cfg.startIntervalMs);
    setFeedbackDots([]);
    setSpokenDigit(null);
    setAnswerInput('');
    setLastResultSummary(null);

    if (currentEnv.affectiveAudioEnabled) {
      affectiveEngineRef.current?.start();
    }
    if (currentEnv.backgroundMode === 'youtube' && currentEnv.youtubeVideoId) {
      setYtManualPlay(true);
    }

    g.loopTimer = setTimeout(gameLoopRef.current, 150);

    if (cfg.sessionMode === 'timer') {
      g.clockTimer = setInterval(() => {
        if (!gameRef.current.running) return;
        const left = Math.max(0, gameRef.current.endTimeMs - Date.now());
        setRemainingDisplay(formatCountdown(left));
        if (left <= 0) {
          stopSession();
        }
      }, 200);
    }

    if (!cfg.buttonMode) {
      requestAnimationFrame(() => {
        answerRef.current?.focus({ preventScroll: true });
      });
    }
  }, [stopAudition, stopSession]);

  const submitAnswerValue = useCallback(
    (numVal: number) => {
      const g = gameRef.current;
      const cfg = settingsRef.current;
      if (!g.running || !g.awaitingAnswer || g.numbers.length < cfg.nBack + 1) {
        return;
      }
      if (Date.now() < g.graceUntilMs) {
        setAnswerInput('');
        return;
      }
      const len = g.numbers.length;
      const correctSum = g.numbers[len - 1] + g.numbers[len - 1 - cfg.nBack];
      g.awaitingAnswer = false;
      setAnswerInput('');
      registerOutcome(numVal === correctSum, numVal, false);
    },
    [registerOutcome]
  );

  const handleAnswerInputChange = useCallback(
    (rawValue: string) => {
      setAnswerInput(rawValue);
      const g = gameRef.current;
      const cfg = settingsRef.current;
      if (
        !g.running ||
        cfg.buttonMode ||
        !g.awaitingAnswer ||
        g.numbers.length < cfg.nBack + 1
      ) {
        return;
      }
      if (Date.now() < g.graceUntilMs) {
        setAnswerInput('');
        return;
      }
      const trimmed = rawValue.trim();
      if (!trimmed) return;
      const len = g.numbers.length;
      const correctSum = g.numbers[len - 1] + g.numbers[len - 1 - cfg.nBack];
      if (trimmed === String(correctSum)) {
        submitAnswerValue(Number(trimmed));
      }
    },
    [submitAnswerValue]
  );

  const handleManualAnswerSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = answerInput.trim();
      if (!trimmed) return;
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed)) return;
      submitAnswerValue(parsed);
    },
    [answerInput, submitAnswerValue]
  );

  const handleToggleAudioPreview = useCallback(() => {
    stopAudition();
    if (affectiveEngineRef.current?.getIsPlaying()) {
      affectiveEngineRef.current.stop();
      return;
    }
    if (!envRef.current.affectiveAudioEnabled) {
      updateEnv({ affectiveAudioEnabled: true });
    }
    affectiveEngineRef.current?.start();
  }, [stopAudition, updateEnv]);

  const handleClearLogs = useCallback(async () => {
    await clearAllSessions();
    setSessions([]);
    showToast('Session history cleared');
  }, [showToast]);

  // Cleanup timers on unmount & Escape key to stop active session
  useEffect(() => {
    const g = gameRef.current;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && g.running) {
        stopSession();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (g.loopTimer) clearTimeout(g.loopTimer);
      if (g.clockTimer) clearInterval(g.clockTimer);
    };
  }, [stopSession]);

  const isYouTube = env.backgroundMode === 'youtube';
  const ytVisibleAndActive = isYouTube && page === 'train';
  const ytShouldPlay =
    ytVisibleAndActive &&
    Boolean(env.youtubeVideoId) &&
    (running || ytManualPlay);

  // During an active YouTube session, remove all obstructing layers & headers
  const isUnobstructedYouTubeSession = running && ytVisibleAndActive;

  const youtubeSearchIdeas = [
    { label: 'Heights', query: 'skyscraper rooftop edge POV 4K' },
    { label: 'Horror', query: 'walking dark haunted hallway POV' },
    { label: 'Angry Dogs', query: 'aggressive barking dog POV' },
    { label: 'Night Street', query: 'walking bad neighborhood at night POV' },
    { label: 'Exams', query: 'exam hall ticking clock ambience' },
    { label: 'Crowds', query: 'crowded subway train POV' },
  ];

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Unobstructed Full-Viewport YouTube Background */}
      <YouTubeBackdrop
        enabled={ytVisibleAndActive}
        videoId={env.youtubeVideoId}
        startSeconds={env.youtubeStartSeconds}
        shouldPlay={ytShouldPlay}
        volume={env.youtubeVolume}
        muted={env.youtubeMuted}
        loop={env.youtubeLoop}
        scrimOpacity={
          isUnobstructedYouTubeSession ? 0 : env.youtubeScrimOpacity
        }
        onPlaybackStateChange={setYtPlaybackState}
        onError={setYtError}
      />

      {/* Active Unobstructed YouTube Session: ONLY the floating number input (plus discreet inline Stop & Esc) */}
      {isUnobstructedYouTubeSession ? (
        <div className="fixed inset-x-0 bottom-8 z-30 flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-2">
            {settings.buttonMode ? (
              <div className="flex flex-wrap justify-center gap-1.5 max-w-2xl">
                {Array.from({ length: 17 }, (_, i) => i + 2).map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => submitAnswerValue(val)}
                    className="min-w-[44px] h-10 px-2.5 rounded-lg border border-white/30 bg-black/35 text-sm font-mono font-bold text-white hover:bg-black/55"
                  >
                    {val}
                  </button>
                ))}
              </div>
            ) : (
              <form onSubmit={handleManualAnswerSubmit}>
                <input
                  ref={answerRef}
                  type="number"
                  inputMode="numeric"
                  autoComplete="off"
                  autoFocus
                  value={answerInput}
                  onChange={(e) => handleAnswerInputChange(e.target.value)}
                  placeholder="Enter sum"
                  aria-label="Enter sum"
                  className="w-52 h-12 px-4 rounded-xl border border-white/40 bg-black/30 text-center text-lg font-mono font-bold text-white placeholder:text-white/65 focus:outline-none focus:border-emerald-300"
                />
              </form>
            )}

            <button
              type="button"
              onClick={stopSession}
              title="Stop session (Esc)"
              aria-label="Stop session"
              className="h-12 px-3.5 rounded-xl border border-white/25 bg-black/30 text-xs font-semibold text-white/80 hover:text-white hover:bg-rose-500/50 transition-colors"
            >
              <Square className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Top Navigation Header */}
          <header
            className={`relative z-20 transition-colors ${
              ytVisibleAndActive
                ? 'bg-[#090D16]/60 backdrop-blur-sm border-b border-white/10'
                : 'bg-[#0B1018] border-b border-slate-800/80'
            }`}
          >
            <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
              {/* Brand */}
              <button
                type="button"
                onClick={() => {
                  if (!running) setPage('train');
                }}
                className="flex items-baseline gap-2 text-left whitespace-nowrap shrink-0"
              >
                <span className="text-xl font-extrabold tracking-tight text-white">
                  ACCT
                </span>
                <span className="hidden md:inline text-xs font-medium text-slate-400">
                  Affective Cognitive Control Training
                </span>
              </button>

              {/* Navigation Links */}
              <nav
                aria-label="Primary navigation"
                className="flex items-center gap-5 sm:gap-7 text-sm font-medium"
              >
                <button
                  type="button"
                  disabled={running}
                  onClick={() => setPage('train')}
                  className={`whitespace-nowrap shrink-0 transition-colors disabled:opacity-50 ${
                    page === 'train'
                      ? 'text-emerald-300 font-semibold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Train
                </button>
                <button
                  type="button"
                  disabled={running}
                  onClick={() => setPage('progress')}
                  className={`whitespace-nowrap shrink-0 transition-colors disabled:opacity-50 ${
                    page === 'progress'
                      ? 'text-emerald-300 font-semibold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Progress
                </button>
                <a
                  href="https://discord.gg/brain"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-slate-300 hover:text-emerald-300 transition-colors whitespace-nowrap shrink-0"
                >
                  <span>MINDBUILDING</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-75" />
                </a>
              </nav>

              {/* Salient Settings Button */}
              <button
                type="button"
                disabled={running}
                onClick={() => setPage('settings')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold tracking-wide shadow-lg whitespace-nowrap shrink-0 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  page === 'settings'
                    ? 'bg-white text-slate-950 ring-2 ring-emerald-400'
                    : 'bg-emerald-400 text-[#051810] hover:bg-emerald-300 shadow-emerald-500/20'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </button>
            </div>
          </header>

          {/* Main Content */}
          <main className="relative z-10 flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
            {page === 'settings' ? (
              <SettingsPage
                settings={settings}
                env={env}
                onUpdateSettings={updateSettings}
                onResetSettings={resetSettings}
                onUpdateEnv={updateEnv}
                onBack={() => setPage('train')}
              />
            ) : page === 'progress' ? (
              <ProgressPage
                sessions={sessions}
                onClearLogs={handleClearLogs}
                onToast={showToast}
              />
            ) : (
              <div className="space-y-6">
                {/* Setup Controls */}
                <div
                  className={`rounded-2xl border p-4 space-y-4 transition-colors ${
                    ytVisibleAndActive
                      ? 'border-white/15 bg-[#090D16]/65 backdrop-blur-md'
                      : 'border-slate-800 bg-[#0F1522]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Background Mode Switch */}
                    <div className="inline-flex rounded-xl bg-[#070A11] p-1 border border-slate-800">
                      <button
                        type="button"
                        disabled={running}
                        onClick={() =>
                          updateEnv({ backgroundMode: 'standard' })
                        }
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                          env.backgroundMode === 'standard'
                            ? 'bg-emerald-400 text-[#051810]'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Standard CCT
                      </button>
                      <button
                        type="button"
                        disabled={running}
                        onClick={() => updateEnv({ backgroundMode: 'youtube' })}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                          env.backgroundMode === 'youtube'
                            ? 'bg-emerald-400 text-[#051810]'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Film className="w-3.5 h-3.5" />
                        <span>YouTube Background</span>
                      </button>
                    </div>

                    {/* Affective Audio Toggle & Drawer */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="inline-flex items-center rounded-xl border border-slate-700/80 bg-[#070A11] overflow-hidden">
                        <button
                          type="button"
                          onClick={() =>
                            updateEnv({
                              affectiveAudioEnabled:
                                !env.affectiveAudioEnabled,
                            })
                          }
                          className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold whitespace-nowrap ${
                            env.affectiveAudioEnabled
                              ? 'bg-emerald-400/15 text-emerald-300'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {env.affectiveAudioEnabled ? (
                            <Volume2 className="w-3.5 h-3.5" />
                          ) : (
                            <VolumeX className="w-3.5 h-3.5" />
                          )}
                          <span>
                            Affective Audio:{' '}
                            {env.affectiveAudioEnabled ? 'ON' : 'OFF'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setAudioDrawerOpen((o) => !o)}
                          className="inline-flex items-center gap-1 px-3 py-2 border-l border-slate-800 text-xs text-slate-300 hover:text-white whitespace-nowrap"
                        >
                          <span>
                            {env.affectiveAudioMode === 'mix'
                              ? 'Mix All'
                              : env.affectiveAudioMode === 'single'
                                ? 'Single'
                                : `${env.affectiveSelectedTrackIds.length} Picked`}
                          </span>
                          {audioDrawerOpen ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* YouTube Link Paste Bar & Short Search Guide */}
                  {env.backgroundMode === 'youtube' && (
                    <div className="pt-3 border-t border-white/10 space-y-3">
                      <div className="flex flex-col md:flex-row gap-2.5">
                        <form
                          onSubmit={handleLoadYouTube}
                          className="flex-1 flex gap-2"
                        >
                          <input
                            type="text"
                            value={ytDraft}
                            onChange={(e) => {
                              setYtDraft(e.target.value);
                              if (ytUrlError) setYtUrlError(null);
                            }}
                            placeholder="Paste any YouTube video link here..."
                            aria-label="YouTube video link"
                            className="flex-1 h-10 px-3.5 rounded-xl border border-slate-700 bg-[#070A11]/90 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400"
                          />
                          <button
                            type="submit"
                            className="h-10 px-4 rounded-xl bg-emerald-400 text-[#051810] text-xs font-bold hover:bg-emerald-300 whitespace-nowrap shrink-0"
                          >
                            Load Video
                          </button>
                        </form>

                        {env.youtubeVideoId && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setYtManualPlay((p) => !p)}
                              className="h-10 px-3 rounded-xl border border-slate-700 bg-[#070A11]/90 text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5"
                            >
                              {ytPlaybackState === 'playing' ? (
                                <Pause className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Play className="w-3.5 h-3.5 text-emerald-400" />
                              )}
                              <span>
                                {ytPlaybackState === 'playing'
                                  ? 'Pause'
                                  : 'Preview'}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                updateEnv({ youtubeMuted: !env.youtubeMuted })
                              }
                              aria-label="Mute or unmute video"
                              className="h-10 w-10 rounded-xl border border-slate-700 bg-[#070A11]/90 flex items-center justify-center text-slate-200"
                            >
                              {env.youtubeMuted || env.youtubeVolume === 0 ? (
                                <VolumeX className="w-4 h-4 text-slate-400" />
                              ) : (
                                <Volume2 className="w-4 h-4 text-emerald-400" />
                              )}
                            </button>

                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={presetName}
                                onChange={(e) => setPresetName(e.target.value)}
                                placeholder="Save name"
                                aria-label="Preset name"
                                className="h-10 w-28 px-2.5 rounded-xl border border-slate-700 bg-[#070A11]/90 text-xs text-white placeholder:text-slate-500"
                              />
                              <button
                                type="button"
                                onClick={handleSavePreset}
                                title="Save link as preset"
                                className="h-10 px-3 rounded-xl border border-slate-700 bg-[#070A11]/90 text-xs font-semibold text-slate-200 inline-flex items-center gap-1 hover:border-emerald-400/50"
                              >
                                <BookmarkPlus className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Save</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {ytUrlError && (
                        <p className="text-xs text-rose-400">{ytUrlError}</p>
                      )}
                      {ytError && (
                        <p className="text-xs text-rose-400">{ytError}</p>
                      )}

                      {/* Short Guide: What to search on YouTube */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span className="font-medium text-slate-300">
                          Try searching YouTube for:
                        </span>
                        {youtubeSearchIdeas.map((idea) => (
                          <button
                            key={idea.label}
                            type="button"
                            onClick={() => {
                              navigator.clipboard
                                ?.writeText(idea.query)
                                .catch(() => {});
                              showToast(`Copied search: "${idea.query}"`);
                            }}
                            className="px-2.5 py-1 rounded-lg border border-slate-700/80 bg-[#070A11]/80 hover:border-emerald-400/50 text-slate-300 transition-colors"
                          >
                            {idea.label}
                          </button>
                        ))}
                        <span className="text-[11px] text-slate-500">
                          (click to copy query, then paste the YouTube link above)
                        </span>
                      </div>

                      {presets.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] text-slate-400">
                            Saved:
                          </span>
                          {presets.map((p) => (
                            <div
                              key={p.id}
                              className={`inline-flex items-center rounded-lg border text-xs overflow-hidden ${
                                env.youtubeVideoId === p.videoId
                                  ? 'border-emerald-400/60 bg-emerald-400/15 text-emerald-300'
                                  : 'border-slate-700 bg-[#070A11] text-slate-300'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setYtDraft(p.url);
                                  updateEnv({
                                    backgroundMode: 'youtube',
                                    youtubeUrl: p.url,
                                    youtubeVideoId: p.videoId,
                                    youtubeStartSeconds: p.startSeconds || 0,
                                  });
                                }}
                                className="px-2.5 py-1 hover:bg-white/5"
                              >
                                {p.label}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePreset(p.id)}
                                aria-label={`Remove ${p.label}`}
                                className="px-1.5 py-1 border-l border-slate-800 text-slate-400 hover:text-rose-400"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Affective Audio Selector Drawer */}
                  {audioDrawerOpen && (
                    <div className="pt-3 border-t border-white/10 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {(
                            [
                              {
                                id: 'mix',
                                label: 'Mix All (Random Loop)',
                                icon: Shuffle,
                              },
                              {
                                id: 'single',
                                label: 'Single Track',
                                icon: RotateCw,
                              },
                              {
                                id: 'custom',
                                label: 'Custom Select',
                                icon: Layers,
                              },
                            ] as {
                              id: AffectiveAudioMode;
                              label: string;
                              icon: typeof Shuffle;
                            }[]
                          ).map(({ id, label, icon: Icon }) => (
                            <button
                              key={id}
                              type="button"
                              onClick={() =>
                                updateEnv({
                                  affectiveAudioEnabled: true,
                                  affectiveAudioMode: id,
                                })
                              }
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                env.affectiveAudioMode === id
                                  ? 'bg-emerald-400 text-[#051810] border-emerald-400'
                                  : 'bg-[#070A11] text-slate-300 border-slate-700 hover:border-slate-500'
                              }`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              <span>{label}</span>
                            </button>
                          ))}
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 text-xs text-slate-300">
                            <span>Vol</span>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={5}
                              value={env.affectiveVolume}
                              onChange={(e) =>
                                updateEnv({
                                  affectiveVolume: Number(e.target.value),
                                })
                              }
                              aria-label="Affective audio volume"
                              className="w-24 accent-emerald-400"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={handleToggleAudioPreview}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                              audioPlaying
                                ? 'border-amber-400/50 bg-amber-400/15 text-amber-300'
                                : 'border-slate-700 bg-[#070A11] text-slate-200 hover:border-slate-500'
                            }`}
                          >
                            {audioPlaying ? 'Stop Test' : 'Test Audio'}
                          </button>
                        </div>
                      </div>

                      {env.affectiveAudioMode === 'custom' && (
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400">Play style:</span>
                            {(
                              [
                                { id: 'random_loop', label: 'Random Loop' },
                                { id: 'layered', label: 'Layer Together' },
                              ] as {
                                id: AffectivePlaybackStyle;
                                label: string;
                              }[]
                            ).map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() =>
                                  updateEnv({ affectivePlaybackStyle: opt.id })
                                }
                                className={`px-2.5 py-1 rounded-md font-medium ${
                                  env.affectivePlaybackStyle === opt.id
                                    ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40'
                                    : 'bg-[#070A11] text-slate-400 border border-slate-800'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                updateEnv({
                                  affectiveSelectedTrackIds:
                                    AFFECTIVE_AUDIO_TRACKS.map((t) => t.id),
                                })
                              }
                              className="text-emerald-400 hover:underline"
                            >
                              Select all
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateEnv({ affectiveSelectedTrackIds: [] })
                              }
                              className="text-slate-400 hover:text-white"
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 12 Track Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {AFFECTIVE_AUDIO_TRACKS.map((track) => {
                          const selected =
                            env.affectiveAudioMode === 'mix' ||
                            (env.affectiveAudioMode === 'single' &&
                              env.affectiveSingleTrackId === track.id) ||
                            (env.affectiveAudioMode === 'custom' &&
                              env.affectiveSelectedTrackIds.includes(track.id));
                          const isPlayingNow = nowPlayingTracks.some(
                            (t) => t.id === track.id
                          );
                          const isAudition = auditioningId === track.id;

                          return (
                            <div
                              key={track.id}
                              className={`flex items-center justify-between gap-2 p-2 rounded-xl border text-xs ${
                                isPlayingNow
                                  ? 'border-emerald-400/60 bg-emerald-400/10'
                                  : selected
                                    ? 'border-slate-700 bg-white/[0.04]'
                                    : 'border-slate-800/80 bg-[#070A11]/70 opacity-70'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  if (env.affectiveAudioMode === 'single') {
                                    updateEnv({
                                      affectiveAudioEnabled: true,
                                      affectiveSingleTrackId: track.id,
                                    });
                                  } else if (
                                    env.affectiveAudioMode === 'custom'
                                  ) {
                                    const exists =
                                      env.affectiveSelectedTrackIds.includes(
                                        track.id
                                      );
                                    updateEnv({
                                      affectiveSelectedTrackIds: exists
                                        ? env.affectiveSelectedTrackIds.filter(
                                            (id) => id !== track.id
                                          )
                                        : [
                                            ...env.affectiveSelectedTrackIds,
                                            track.id,
                                          ],
                                    });
                                  } else {
                                    updateEnv({
                                      affectiveAudioEnabled: true,
                                      affectiveAudioMode: 'single',
                                      affectiveSingleTrackId: track.id,
                                    });
                                  }
                                }}
                                className="flex-1 flex items-center gap-2 text-left min-w-0"
                              >
                                <span
                                  className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                                    selected
                                      ? 'bg-emerald-400 border-emerald-400 text-[#051810]'
                                      : 'border-slate-600 text-transparent'
                                  }`}
                                >
                                  <Check className="w-3 h-3 stroke-[3]" />
                                </span>
                                <div className="min-w-0">
                                  <div className="font-semibold text-slate-100 truncate">
                                    {track.title}
                                  </div>
                                  <div className="text-[11px] text-slate-400 truncate">
                                    {track.category}
                                  </div>
                                </div>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleAuditionTrack(track)}
                                aria-label={`Preview ${track.title}`}
                                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                                  isAudition
                                    ? 'border-amber-400/50 bg-amber-400/15 text-amber-300'
                                    : 'border-slate-700 bg-[#070A11] text-slate-300 hover:text-white'
                                }`}
                              >
                                {isAudition ? (
                                  <Pause className="w-3 h-3" />
                                ) : (
                                  <Play className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Main CCT Training Arena (Standard CCT or Idle YouTube Preview) */}
                <section
                  aria-label="CCT Training Arena"
                  className={`text-center transition-all rounded-2xl border py-10 px-6 ${
                    ytVisibleAndActive
                      ? 'border-white/15 bg-[#090D16]/45 backdrop-blur-sm'
                      : 'border-slate-800 bg-[#0F1522]'
                  }`}
                >
                  {!running && (
                    <div className="mb-6">
                      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                        Cognitive Control Training
                      </h1>
                      <p className="mt-2 text-xs sm:text-sm text-slate-300 max-w-lg mx-auto">
                        Spoken digits (1–9) play automatically. Add the{' '}
                        <strong className="text-emerald-300">
                          latest digit
                        </strong>{' '}
                        + the digit{' '}
                        <strong className="text-emerald-300">
                          {settings.nBack}{' '}
                          {settings.nBack === 1 ? 'step' : 'steps'} back
                        </strong>
                        .
                      </p>
                    </div>
                  )}

                  {/* Readouts */}
                  <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-sm font-mono tabular-nums">
                    {settings.showIntervalStats && (
                      <div className="px-3.5 py-1.5 rounded-full bg-black/25 border border-white/15 text-slate-100">
                        Interval:{' '}
                        <span className="font-bold text-emerald-300">
                          {currentIntervalMs} ms
                        </span>
                      </div>
                    )}

                    {settings.showTimer && (
                      <div className="px-3.5 py-1.5 rounded-full bg-black/25 border border-white/15 text-slate-100">
                        {settings.sessionMode === 'timer'
                          ? 'Time Left: '
                          : 'Left: '}
                        <span className="font-bold text-white">
                          {remainingDisplay}
                        </span>
                      </div>
                    )}

                    <div className="px-3.5 py-1.5 rounded-full bg-black/25 border border-white/15 text-slate-200">
                      N-Back:{' '}
                      <span className="font-bold text-cyan-300">
                        {settings.nBack}
                      </span>
                    </div>
                  </div>

                  {running &&
                    settings.showVisualDigit &&
                    spokenDigit !== null && (
                      <div className="mt-5 text-5xl font-mono font-extrabold text-white">
                        {spokenDigit}
                      </div>
                    )}

                  {/* Feedback Dots */}
                  <div
                    className="mt-5 min-h-[20px] flex items-center justify-center gap-2 flex-wrap"
                    aria-label="Recent answer feedback"
                  >
                    {feedbackDots.map((ok, idx) => (
                      <span
                        key={idx}
                        className={`w-3 h-3 rounded-full ${
                          ok ? 'bg-emerald-400' : 'bg-rose-500'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Answer Input or 2-18 Buttons */}
                  <div className="mt-5">
                    {settings.buttonMode ? (
                      <div className="flex flex-wrap justify-center gap-2 max-w-xl mx-auto">
                        {Array.from({ length: 17 }, (_, i) => i + 2).map(
                          (val) => (
                            <button
                              key={val}
                              type="button"
                              disabled={!running}
                              onClick={() => submitAnswerValue(val)}
                              className="min-w-[52px] h-11 px-3 rounded-xl border border-slate-700 bg-[#090D16] text-sm font-mono font-bold text-slate-100 hover:border-emerald-400 disabled:opacity-35"
                            >
                              {val}
                            </button>
                          )
                        )}
                      </div>
                    ) : (
                      <form
                        onSubmit={handleManualAnswerSubmit}
                        className="flex justify-center"
                      >
                        <input
                          ref={answerRef}
                          type="number"
                          inputMode="numeric"
                          autoComplete="off"
                          disabled={!running}
                          value={answerInput}
                          onChange={(e) =>
                            handleAnswerInputChange(e.target.value)
                          }
                          placeholder={running ? 'Enter sum' : 'Press Start'}
                          aria-label="Enter sum"
                          className="w-56 h-12 px-4 rounded-xl border border-slate-700 bg-[#090D16] text-center text-lg font-mono font-bold text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400 disabled:opacity-45"
                        />
                      </form>
                    )}
                  </div>

                  {/* Start / Stop Button */}
                  <div className="mt-6 flex items-center justify-center gap-3">
                    {running ? (
                      <button
                        type="button"
                        onClick={stopSession}
                        className="h-11 px-7 rounded-full border border-rose-400/40 bg-rose-500/15 text-rose-200 text-sm font-bold inline-flex items-center gap-2 hover:bg-rose-500/25 transition-colors"
                      >
                        <Square className="w-4 h-4" />
                        <span>Stop Session</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={startSession}
                        className="h-12 px-8 rounded-full bg-emerald-400 text-[#051810] text-sm font-extrabold inline-flex items-center gap-2 hover:bg-emerald-300 shadow-lg shadow-emerald-500/20 transition-colors"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>Start Session</span>
                      </button>
                    )}
                  </div>

                  {!running && lastResultSummary && (
                    <p className="mt-4 text-xs font-medium text-emerald-300">
                      {lastResultSummary}
                    </p>
                  )}
                </section>

                {/* Session History */}
                <RecentSessionsTable sessions={sessions} />
              </div>
            )}
          </main>

          {/* Discreet Footer Credit */}
          <footer className="relative z-10 py-6 text-center text-[11px] tracking-[0.18em] uppercase text-slate-500">
            ENGINEERED by TURPENSTEIN
          </footer>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-emerald-400 text-[#051810] text-xs font-bold shadow-xl"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
