import fs from 'node:fs';
import path from 'node:path';

export type ReportType = 'daily' | 'talk';

export type ReportMeta = {
  slug: string;            // e.g. '2026-04-26' or '2026-04-26-talk-fundamentals'
  type: ReportType;
  date: string;            // 'YYYY-MM-DD'
  title: string;           // first H1 stripped of '#'
  summary?: string;        // first blockquote line, if any
  filePath: string;
};

const DATE_RE = /^(\d{4}-\d{2}-\d{2})/;

function reportsDir(): string {
  // env wins (Docker / fly will set REPORTS_DIR=/app/daily-report);
  // otherwise fall back to ../daily-report relative to site/ cwd.
  const fromEnv = process.env.REPORTS_DIR;
  if (fromEnv && fromEnv.length > 0) return path.resolve(fromEnv);
  return path.resolve(process.cwd(), '..', 'daily-report');
}

function classify(slug: string): ReportType {
  return slug.includes('-talk-') ? 'talk' : 'daily';
}

function readTitleAndSummary(md: string): { title: string; summary?: string } {
  const lines = md.split(/\r?\n/);
  let title = '';
  let summary: string | undefined;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!title && line.startsWith('# ')) {
      title = line.replace(/^#\s+/, '').trim();
      continue;
    }
    if (title && line.startsWith('> ')) {
      summary = line.replace(/^>\s+/, '').trim();
      break;
    }
    if (title && line.trim() === '') continue;
    if (title && !line.startsWith('>')) break;
  }
  return { title: title || '(untitled)', summary };
}

export function getAllReports(): ReportMeta[] {
  const dir = reportsDir();
  if (!fs.existsSync(dir)) return [];

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md') && DATE_RE.test(f));

  const reports: ReportMeta[] = files.map((file) => {
    const slug = file.replace(/\.md$/, '');
    const filePath = path.join(dir, file);
    const md = fs.readFileSync(filePath, 'utf8');
    const dateMatch = slug.match(DATE_RE);
    const date = dateMatch ? dateMatch[1] : '';
    const type = classify(slug);
    const { title, summary } = readTitleAndSummary(md);
    return { slug, type, date, title, summary, filePath };
  });

  // sort: date desc, then daily before talk on same day, then slug
  reports.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    if (a.type !== b.type) return a.type === 'daily' ? -1 : 1;
    return a.slug < b.slug ? -1 : 1;
  });

  return reports;
}

export function getReportBySlug(slug: string): { meta: ReportMeta; raw: string } | null {
  const all = getAllReports();
  const meta = all.find((r) => r.slug === slug);
  if (!meta) return null;
  const raw = fs.readFileSync(meta.filePath, 'utf8');
  return { meta, raw };
}

export function getLatestSlug(): string | null {
  const all = getAllReports();
  return all.length > 0 ? all[0].slug : null;
}

export function stripHeaderAndSummary(md: string): string {
  // Remove leading H1 and the first blockquote block. Keep the rest as-is.
  const lines = md.split(/\r?\n/);
  let i = 0;

  // skip leading blank lines
  while (i < lines.length && lines[i].trim() === '') i++;

  // skip H1
  if (i < lines.length && lines[i].startsWith('# ')) {
    i++;
    while (i < lines.length && lines[i].trim() === '') i++;
  }

  // skip blockquote block (consecutive lines starting with `>` or empty between)
  if (i < lines.length && lines[i].startsWith('>')) {
    while (i < lines.length && (lines[i].startsWith('>') || lines[i].trim() === '')) {
      // if we hit a non-blockquote non-blank, stop. blank is allowed inside.
      if (lines[i].trim() === '') {
        // peek: blank is part of blockquote only if next line is also blockquote
        if (i + 1 < lines.length && lines[i + 1].startsWith('>')) {
          i++;
          continue;
        }
        break;
      }
      i++;
    }
    while (i < lines.length && lines[i].trim() === '') i++;
  }

  return lines.slice(i).join('\n');
}
