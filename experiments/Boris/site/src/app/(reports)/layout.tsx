import { getAllReports } from '@/lib/reports';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';

// daily-report/ files are baked into the image at runner stage, not builder.
// Force runtime rendering so getAllReports() reads the actual filesystem on
// every request rather than the empty list seen during `next build`.
export const dynamic = 'force-dynamic';

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  const reports = getAllReports();
  return (
    <>
      <TopBar />
      <div className="layout">
        <Sidebar reports={reports} />
        <main className="content">{children}</main>
      </div>
    </>
  );
}
