'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReportMeta } from '@/lib/reports';

type Props = {
  reports: ReportMeta[];
};

function shortLabel(meta: ReportMeta): string {
  if (meta.type === 'daily') return 'daily brief';
  const tail = meta.slug.split('-talk-')[1] ?? meta.slug;
  return tail.length > 18 ? tail.slice(0, 17) + '…' : tail;
}

function activeSlugFromPath(pathname: string | null): string | null {
  if (!pathname) return null;
  const m = pathname.match(/^\/reports\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function deriveTitle(pathname: string | null): string {
  if (pathname?.startsWith('/analyze')) return 'ANALYZE';
  return 'DAILY BRIEFS';
}

export default function Sidebar({ reports }: Props) {
  const pathname = usePathname();
  const activeSlug = activeSlugFromPath(pathname);
  const title = deriveTitle(pathname);
  const onAnalyze = pathname?.startsWith('/analyze') ?? false;

  const byDate = new Map<string, ReportMeta[]>();
  for (const r of reports) {
    const list = byDate.get(r.date) ?? [];
    list.push(r);
    byDate.set(r.date, list);
  }
  const dates = Array.from(byDate.keys());
  const activeDate =
    (activeSlug ? activeSlug.match(/^\d{4}-\d{2}-\d{2}/)?.[0] : null) ??
    dates[0] ??
    null;

  return (
    <aside className="sidebar">
      <div className="sidebar-title">{title}</div>
      <nav className="sidebar-list">
        {dates.map((date) => {
          const items = byDate.get(date)!;
          const open = date === activeDate;
          return (
            <details key={date} className="sb-group" open={open}>
              <summary>
                <span className="sb-date">{date}</span>
                <span className="sb-count">[{items.length}]</span>
              </summary>
              <ul>
                {items.map((r) => {
                  const active = r.slug === activeSlug;
                  const cls = ['sb-item', active ? 'active' : ''].join(' ').trim();
                  return (
                    <li key={r.slug}>
                      <Link href={`/reports/${r.slug}`} className={cls}>
                        <span>{shortLabel(r)}</span>
                        <span className="stats">{r.type === 'daily' ? 'D' : 'T'}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </details>
          );
        })}
      </nav>
      <div className="sb-footer">
        <Link
          href="/analyze"
          className={['sb-quick', onAnalyze ? 'active' : ''].join(' ').trim()}
        >
          → 解析视频
        </Link>
        <div className="sb-foot-meta">
          <span className="ok">●</span> {reports.length} reports
        </div>
      </div>
    </aside>
  );
}
