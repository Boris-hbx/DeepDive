'use client';

import { useState, FormEvent } from 'react';
import { renderMarkdown } from '@/lib/markdown';

type ApiOk = {
  videoId: string;
  markdown: string;
  model: string;
  usage: { input: number; output: number };
  ms: number;
  truncated: boolean;
};
type ApiErr = { error: string; code?: string };

type Submission = {
  url: string;
  startedAt: number;
};

type State =
  | { kind: 'idle' }
  | { kind: 'loading'; submission: Submission }
  | { kind: 'ok'; submission: Submission; data: ApiOk }
  | { kind: 'err'; submission: Submission; error: string };

export default function AnalyzePage() {
  const [url, setUrl] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    const submission: Submission = { url: trimmed, startedAt: Date.now() };
    setState({ kind: 'loading', submission });
    try {
      const resp = await fetch('/api/analyze-video', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: trimmed })
      });
      if (!resp.ok) {
        const err = (await resp.json().catch(() => ({}))) as ApiErr;
        setState({
          kind: 'err',
          submission,
          error: err.error ?? `HTTP ${resp.status}`
        });
        return;
      }
      const data = (await resp.json()) as ApiOk;
      setState({ kind: 'ok', submission, data });
    } catch (err) {
      setState({
        kind: 'err',
        submission,
        error: err instanceof Error ? err.message : '网络错误'
      });
    }
  }

  return (
    <article>
      <header className="article-head">
        <div className="ah-eyebrow">analyze · single video session</div>
        <h1>视频解析</h1>
        <p className="ah-summary">
          这是一次性会话：粘贴 YouTube 链接，30-90 秒后返回 talk-style 报告（含蓝军视角）。
          字幕从 YouTube 公开 caption 轨道抓取，结果不入 daily-report 归档；
          想保留请把生成的 markdown 复制到 <code>experiments/Boris/daily-report/</code>。
        </p>
      </header>

      <form onSubmit={onSubmit} className="analyze-form">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=… 或 https://youtu.be/…"
          maxLength={200}
          disabled={state.kind === 'loading'}
        />
        <button type="submit" disabled={state.kind === 'loading' || !url.trim()}>
          {state.kind === 'loading' ? 'analyzing…' : 'analyze'}
        </button>
      </form>

      {state.kind === 'loading' && (
        <div className="status status-loading">
          <span className="spinner" />
          <div>
            <div>正在抓字幕 + 调 Claude…</div>
            <div className="status-sub">源：{state.submission.url}</div>
          </div>
        </div>
      )}

      {state.kind === 'err' && (
        <div className="status status-err">
          <strong>失败：</strong>
          <div>
            {state.error}
            <div className="status-sub">源：{state.submission.url}</div>
          </div>
        </div>
      )}

      {state.kind === 'ok' && (
        <ResultView submission={state.submission} data={state.data} />
      )}
    </article>
  );
}

function ResultView({
  submission,
  data
}: {
  submission: Submission;
  data: ApiOk;
}) {
  const html = renderMarkdown(data.markdown);
  return (
    <section className="analyze-result">
      <div className="source-strip">
        <div className="ss-label">本次分析的源视频</div>
        <a
          href={submission.url}
          target="_blank"
          rel="noopener noreferrer"
          className="ss-url"
        >
          {submission.url}
        </a>
        <div className="ss-meta">
          model={data.model} · in={data.usage.input}t · out={data.usage.output}t ·{' '}
          {Math.round(data.ms / 1000)}s
          {data.truncated && ' · transcript truncated'}
        </div>
      </div>
      <div className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
    </section>
  );
}
