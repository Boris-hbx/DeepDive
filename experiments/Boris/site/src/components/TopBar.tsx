'use client';

import { usePathname } from 'next/navigation';

function derivePath(pathname: string | null): string {
  if (!pathname) return 'briefs';
  if (pathname.startsWith('/analyze')) return 'analyze';
  const m = pathname.match(/^\/reports\/([^/]+)/);
  if (m) {
    const slug = decodeURIComponent(m[1]);
    return slug.includes('-talk-') ? `talks/${slug}` : `briefs/${slug}`;
  }
  return 'briefs';
}

export default function TopBar() {
  const pathname = usePathname();
  const pathLabel = derivePath(pathname);
  const isAnalyze = pathname?.startsWith('/analyze') ?? false;

  return (
    <div className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <span className="prompt">~</span>
          <span>boris</span>
          <span className="path">/deepdive/{pathLabel}</span>
          <span className="cursor" />
        </div>
        <div className="top-meta">
          <span>
            <span className="ok">●</span> deepdive
          </span>
          {isAnalyze ? (
            <a href="/">← briefs</a>
          ) : (
            <a href="/analyze">/analyze →</a>
          )}
        </div>
      </div>
    </div>
  );
}
