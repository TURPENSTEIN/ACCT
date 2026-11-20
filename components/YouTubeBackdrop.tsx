'use client';

import { useEffect, useRef } from 'react';

interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  mute: () => void;
  unMute: () => void;
  setVolume: (vol: number) => void;
  loadVideoById: (opts: { videoId: string; startSeconds?: number }) => void;
  cueVideoById: (opts: { videoId: string; startSeconds?: number }) => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  destroy: () => void;
  getPlayerState: () => number;
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement | string,
        options: {
          videoId?: string;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (event: { target: YTPlayer }) => void;
            onStateChange?: (event: { data: number; target: YTPlayer }) => void;
            onError?: (event: { data: number }) => void;
          };
        }
      ) => YTPlayer;
      PlayerState?: {
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YouTubeBackdropProps {
  enabled: boolean;
  videoId: string;
  startSeconds: number;
  shouldPlay: boolean;
  volume: number;
  muted: boolean;
  loop: boolean;
  scrimOpacity: number;
  onPlaybackStateChange?: (state: 'idle' | 'playing' | 'paused' | 'buffering' | 'ended') => void;
  onError?: (message: string | null) => void;
}

const YT_ERROR_MESSAGES: Record<number, string> = {
  2: 'Invalid YouTube video ID. Check the link and try again.',
  5: 'This video cannot be played in the embedded player.',
  100: 'Video not found or marked private on YouTube.',
  101: 'This video owner disabled playback inside embedded apps. Please paste a different YouTube link.',
  150: 'This video owner disabled playback inside embedded apps. Please paste a different YouTube link.',
};

let apiLoadPromise: Promise<void> | null = null;

function ensureYouTubeIframeAPI(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (apiLoadPromise) return apiLoadPromise;

  apiLoadPromise = new Promise((resolve) => {
    const existing = document.querySelector(
      'script[src="https://www.youtube.com/iframe_api"]'
    );
    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prevCallback?.();
      resolve();
    };
    if (!existing) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      document.head.appendChild(script);
    }
  });
  return apiLoadPromise;
}

export default function YouTubeBackdrop({
  enabled,
  videoId,
  startSeconds,
  shouldPlay,
  volume,
  muted,
  loop,
  scrimOpacity,
  onPlaybackStateChange,
  onError,
}: YouTubeBackdropProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const readyRef = useRef(false);
  const currentVideoRef = useRef<string>('');
  const latestPropsRef = useRef({
    shouldPlay,
    volume,
    muted,
    loop,
    startSeconds,
    onPlaybackStateChange,
    onError,
  });

  useEffect(() => {
    latestPropsRef.current = {
      shouldPlay,
      volume,
      muted,
      loop,
      startSeconds,
      onPlaybackStateChange,
      onError,
    };
  }, [
    shouldPlay,
    volume,
    muted,
    loop,
    startSeconds,
    onPlaybackStateChange,
    onError,
  ]);

  useEffect(() => {
    if (!enabled || !videoId) {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore
        }
        playerRef.current = null;
      }
      readyRef.current = false;
      currentVideoRef.current = '';
      latestPropsRef.current.onPlaybackStateChange?.('idle');
      return;
    }

    let cancelled = false;

    ensureYouTubeIframeAPI().then(() => {
      if (cancelled || !hostRef.current || !window.YT?.Player) return;

      // If player already exists for a different video, load the new video cleanly
      if (playerRef.current && readyRef.current) {
        if (currentVideoRef.current !== videoId) {
          currentVideoRef.current = videoId;
          latestPropsRef.current.onError?.(null);
          if (latestPropsRef.current.shouldPlay) {
            playerRef.current.loadVideoById({
              videoId,
              startSeconds: latestPropsRef.current.startSeconds || 0,
            });
          } else {
            playerRef.current.cueVideoById({
              videoId,
              startSeconds: latestPropsRef.current.startSeconds || 0,
            });
          }
        }
        return;
      }

      // Clear previous mount node and create a fresh container element for YT.Player
      hostRef.current.replaceChildren();
      const mountEl = document.createElement('div');
      mountEl.style.width = '100%';
      mountEl.style.height = '100%';
      hostRef.current.appendChild(mountEl);

      currentVideoRef.current = videoId;
      latestPropsRef.current.onError?.(null);

      playerRef.current = new window.YT.Player(mountEl, {
        videoId,
        playerVars: {
          autoplay: latestPropsRef.current.shouldPlay ? 1 : 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
          start: latestPropsRef.current.startSeconds || 0,
          ...(typeof window !== 'undefined'
            ? { origin: window.location.origin }
            : {}),
        },
        events: {
          onReady: ({ target }) => {
            if (cancelled) return;
            readyRef.current = true;
            const {
              volume: v,
              muted: m,
              shouldPlay: playNow,
            } = latestPropsRef.current;
            if (m) {
              target.mute();
            } else {
              target.unMute();
              target.setVolume(v);
            }
            if (playNow) {
              target.playVideo();
            }
          },
          onStateChange: ({ data, target }) => {
            if (cancelled) return;
            const PS = window.YT?.PlayerState;
            if (!PS) return;
            if (data === PS.PLAYING) {
              latestPropsRef.current.onError?.(null);
              latestPropsRef.current.onPlaybackStateChange?.('playing');
            } else if (data === PS.PAUSED) {
              latestPropsRef.current.onPlaybackStateChange?.('paused');
            } else if (data === PS.BUFFERING) {
              latestPropsRef.current.onPlaybackStateChange?.('buffering');
            } else if (data === PS.ENDED) {
              if (latestPropsRef.current.loop) {
                target.seekTo(latestPropsRef.current.startSeconds || 0, true);
                target.playVideo();
              } else {
                latestPropsRef.current.onPlaybackStateChange?.('ended');
              }
            }
          },
          onError: ({ data }) => {
            if (cancelled) return;
            latestPropsRef.current.onError?.(
              YT_ERROR_MESSAGES[data] ||
                'Could not play this YouTube video. Try pasting another link.'
            );
          },
        },
      });
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, videoId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore
        }
        playerRef.current = null;
      }
      readyRef.current = false;
    };
  }, []);

  // Sync play/pause
  useEffect(() => {
    if (!enabled || !videoId || !playerRef.current || !readyRef.current) return;
    try {
      if (shouldPlay) {
        playerRef.current.playVideo();
      } else {
        playerRef.current.pauseVideo();
      }
    } catch {
      // ignore
    }
  }, [enabled, videoId, shouldPlay]);

  // Sync volume & mute
  useEffect(() => {
    if (!enabled || !videoId || !playerRef.current || !readyRef.current) return;
    try {
      if (muted || volume === 0) {
        playerRef.current.mute();
      } else {
        playerRef.current.unMute();
        playerRef.current.setVolume(volume);
      }
    } catch {
      // ignore
    }
  }, [enabled, videoId, volume, muted]);

  if (!enabled || !videoId) return null;

  return (
    <div
      className="fixed inset-0 z-0 overflow-hidden bg-[#06080D] pointer-events-none select-none"
      aria-hidden="true"
    >
      <div
        ref={hostRef}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[max(100vw,177.78vh)] h-[max(100vh,56.25vw)] [&_iframe]:w-full [&_iframe]:h-full [&_iframe]:border-0"
      />
      {scrimOpacity > 0 && (
        <div
          className="absolute inset-0 transition-colors duration-200"
          style={{
            backgroundColor: `rgba(7, 10, 16, ${Math.max(0, Math.min(0.85, scrimOpacity / 100))})`,
          }}
        />
      )}
    </div>
  );
}
