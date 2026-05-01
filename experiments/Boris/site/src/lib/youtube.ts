import { getSubtitles } from 'youtube-captions-scraper';

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const ALLOWED_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be'
]);

export type YouTubeErrorCode = 'INVALID_URL' | 'NO_CAPTIONS' | 'FETCH_FAILED';

export class YouTubeError extends Error {
  code: YouTubeErrorCode;
  constructor(code: YouTubeErrorCode, message: string) {
    super(message);
    this.name = 'YouTubeError';
    this.code = code;
  }
}

export function extractVideoId(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new YouTubeError('INVALID_URL', 'URL 格式无效');
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new YouTubeError('INVALID_URL', `域名不在白名单：${parsed.hostname}`);
  }
  let id = '';
  if (parsed.hostname === 'youtu.be') {
    id = parsed.pathname.slice(1).split('/')[0];
  } else {
    id = parsed.searchParams.get('v') ?? '';
    if (!id && parsed.pathname.startsWith('/shorts/')) {
      id = parsed.pathname.split('/')[2] ?? '';
    }
    if (!id && parsed.pathname.startsWith('/embed/')) {
      id = parsed.pathname.split('/')[2] ?? '';
    }
    if (!id && parsed.pathname.startsWith('/live/')) {
      id = parsed.pathname.split('/')[2] ?? '';
    }
  }
  if (!VIDEO_ID_RE.test(id)) {
    throw new YouTubeError('INVALID_URL', '无法从 URL 提取 video_id');
  }
  return id;
}

type CaptionLine = { start: string; dur: string; text: string };

export async function fetchTranscript(videoId: string): Promise<string> {
  const langs = ['en', 'en-US', 'en-orig', 'zh-Hans', 'zh-CN', 'zh'];
  let lastErr: Error | null = null;
  for (const lang of langs) {
    try {
      const lines = (await getSubtitles({ videoID: videoId, lang })) as CaptionLine[];
      if (Array.isArray(lines) && lines.length > 0) {
        const cleaned = cleanTranscript(lines);
        if (cleaned.length > 0) return cleaned;
      }
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw new YouTubeError(
    'NO_CAPTIONS',
    `未找到可用字幕（最后错误：${lastErr?.message ?? '空'}）`
  );
}

function cleanTranscript(lines: CaptionLine[]): string {
  const out: string[] = [];
  let prev = '';
  for (const line of lines) {
    const t = (line.text ?? '')
      .replace(/<[^>]+>/g, '')
      .replace(/\[(?:Music|Applause|Laughter|Inaudible)\]/gi, '')
      .replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
    if (!t) continue;
    if (t === prev) continue;
    if (prev && prev.endsWith(t)) continue;
    if (prev && t.startsWith(prev)) {
      out[out.length - 1] = t;
      prev = t;
      continue;
    }
    out.push(t);
    prev = t;
  }
  return out.join(' ').replace(/\s+/g, ' ').trim();
}
