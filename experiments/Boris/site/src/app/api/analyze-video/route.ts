import { NextRequest, NextResponse } from 'next/server';
import { extractVideoId, fetchTranscript, YouTubeError } from '@/lib/youtube';
import { analyzeTranscript } from '@/lib/claude';
import {
  checkPerIp,
  tryAcquireGlobal,
  releaseGlobal
} from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const URL_MAX_LEN = 200;

function clientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (!origin) return true; // some clients omit it on same-origin
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: 'cross-origin not allowed' }, { status: 403 });
  }

  const ip = clientIp(req);
  const ipCheck = checkPerIp(ip);
  if (!ipCheck.ok) {
    return NextResponse.json({ error: ipCheck.reason }, { status: ipCheck.status });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const url = (body as { url?: unknown })?.url;
  if (typeof url !== 'string' || url.length === 0) {
    return NextResponse.json({ error: '缺少 url 字段' }, { status: 400 });
  }
  if (url.length > URL_MAX_LEN) {
    return NextResponse.json({ error: `URL 过长（>${URL_MAX_LEN} chars）` }, { status: 400 });
  }

  let videoId: string;
  try {
    videoId = extractVideoId(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'URL 校验失败';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const slot = tryAcquireGlobal();
  if (!slot.ok) {
    return NextResponse.json({ error: slot.reason }, { status: slot.status });
  }

  try {
    let transcript: string;
    try {
      transcript = await fetchTranscript(videoId);
    } catch (err) {
      const isYt = err instanceof YouTubeError;
      const code = isYt ? err.code : 'FETCH_FAILED';
      const status = code === 'NO_CAPTIONS' ? 422 : 502;
      const msg = err instanceof Error ? err.message : '字幕抓取失败';
      return NextResponse.json({ error: msg, code }, { status });
    }

    try {
      const result = await analyzeTranscript({ videoUrl: url, videoId, transcript });
      console.log(
        '[analyze]',
        JSON.stringify({
          videoId,
          ip,
          model: result.model,
          inTok: result.inputTokens,
          outTok: result.outputTokens,
          ms: result.ms,
          truncated: result.truncated
        })
      );
      return NextResponse.json({
        videoId,
        markdown: result.markdown,
        model: result.model,
        usage: { input: result.inputTokens, output: result.outputTokens },
        ms: result.ms,
        truncated: result.truncated
      });
    } catch (err) {
      console.error('[analyze] LLM error', err);
      return NextResponse.json(
        { error: '模型调用失败，请稍后重试' },
        { status: 502 }
      );
    }
  } finally {
    releaseGlobal();
  }
}
