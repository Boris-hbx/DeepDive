import { redirect } from 'next/navigation';
import { getLatestSlug } from '@/lib/reports';

// Layout is force-dynamic; this page inherits.

export default function HomePage() {
  const slug = getLatestSlug();
  if (slug) redirect(`/reports/${slug}`);

  return (
    <div className="article-head">
      <div className="ah-eyebrow">deepdive · empty state</div>
      <h1>暂无报告</h1>
      <p className="ah-summary">
        把 markdown 放进 <code>experiments/Boris/daily-report/</code>，
        文件名以 <code>YYYY-MM-DD</code> 开头。
      </p>
    </div>
  );
}
