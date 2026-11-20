export interface ParsedYouTubeLink {
  videoId: string | null;
  startSeconds: number;
  error?: string;
}

function parseTimestamp(raw: string | null): number {
  if (!raw) return 0;
  const cleaned = raw.trim().toLowerCase();
  if (/^\d+$/.test(cleaned)) {
    return Math.max(0, parseInt(cleaned, 10));
  }
  const match = cleaned.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
  if (!match) return 0;
  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const seconds = match[3] ? parseInt(match[3], 10) : 0;
  return Math.max(0, hours * 3600 + minutes * 60 + seconds);
}

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

export function parseYouTubeUrl(input: string): ParsedYouTubeLink {
  const trimmed = input.trim();
  if (!trimmed) {
    return { videoId: null, startSeconds: 0, error: 'Paste a YouTube video link or 11-character ID.' };
  }

  if (VALID_ID_REGEX.test(trimmed)) {
    return { videoId: trimmed, startSeconds: 0 };
  }

  let normalized = trimmed;
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  try {
    const url = new URL(normalized);
    const host = url.hostname.replace(/^www\./i, '').toLowerCase();
    const startSeconds = parseTimestamp(
      url.searchParams.get('t') || url.searchParams.get('start')
    );

    if (host === 'youtu.be') {
      const candidate = url.pathname.split('/').filter(Boolean)[0] || '';
      if (VALID_ID_REGEX.test(candidate)) {
        return { videoId: candidate, startSeconds };
      }
      return { videoId: null, startSeconds: 0, error: 'Could not find a valid video ID in that youtu.be link.' };
    }

    if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com' ||
      host === 'youtube-nocookie.com'
    ) {
      const vParam = url.searchParams.get('v');
      if (vParam && VALID_ID_REGEX.test(vParam)) {
        return { videoId: vParam, startSeconds };
      }

      const parts = url.pathname.split('/').filter(Boolean);
      const markerIndex = parts.findIndex((p) =>
        ['embed', 'shorts', 'live', 'v'].includes(p.toLowerCase())
      );
      if (markerIndex !== -1 && parts[markerIndex + 1]) {
        const candidate = parts[markerIndex + 1];
        if (VALID_ID_REGEX.test(candidate)) {
          return { videoId: candidate, startSeconds };
        }
      }
    }

    return {
      videoId: null,
      startSeconds: 0,
      error: 'Unrecognized YouTube URL format. Try a standard watch, youtu.be, shorts, or live link.',
    };
  } catch {
    return {
      videoId: null,
      startSeconds: 0,
      error: 'Invalid URL. Paste a complete YouTube link such as https://www.youtube.com/watch?v=...',
    };
  }
}
