import { notFound } from 'next/navigation';
import { getReportBySlug, stripHeaderAndSummary } from '@/lib/reports';
import { renderMarkdown } from '@/lib/markdown';

// Layout is force-dynamic (FS reads at runtime); pages inherit. No static
// gen here — daily-report/ doesn't exist during `next build`.

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function ReportPage({ params }: Props) {
  const { slug } = await params;
  const found = getReportBySlug(slug);
  if (!found) notFound();

  const { meta, raw } = found;
  const body = stripHeaderAndSummary(raw);
  const html = renderMarkdown(body);

  return (
    <article>
      <header className="article-head">
        <div className="ah-eyebrow">
          {meta.type === 'daily' ? 'brief' : 'talk'}/{meta.slug}.md · agentic-software-engineering
        </div>
        <h1>{meta.title}</h1>
        {meta.summary && <p className="ah-summary">{meta.summary}</p>}
      </header>
      <div className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}
