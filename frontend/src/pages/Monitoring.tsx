// Monitoring. Question: "Is the platform getting better or more expensive?" 14 days, per day.
import { jobs, NOW, projectById, projects } from '../data/sample';
import { Chart } from '../components/Chart';
import { dayMonth, pct, usd } from '../lib/format';
import { useTitle } from '../lib/useTitle';

const DAY = 86_400_000;

export function Monitoring() {
  useTitle('Giám sát');
  const today = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());
  const days = [...Array(14)].map((_, i) => new Date(today.getTime() - (13 - i) * DAY));
  const on = (d: Date) => jobs.filter((j) => j.start >= d && j.start < new Date(d.getTime() + DAY));
  const cost = days.map((d) => Math.round(on(d).reduce((a, j) => a + j.cost, 0) * 100) / 100);
  const total = Math.round(cost.reduce((a, b) => a + b, 0) * 100) / 100;
  const peak = cost.indexOf(Math.max(...cost));

  const finished = jobs.filter((j) => j.status === 'succeeded' || j.status === 'failed');
  const byProject = projects.map((p) => {
    const f = finished.filter((j) => j.project === p.id);
    const ok = f.filter((j) => j.status === 'succeeded').length;
    const failedFix = f.filter((j) => j.status === 'failed').length;
    return { p, n: f.length, ok, rate: f.length ? ok / f.length : 0, failedFix, cost: Math.round(jobs.filter((j) => j.project === p.id).reduce((a, j) => a + j.cost, 0) * 100) / 100 };
  });
  const worst = [...byProject].sort((a, b) => a.rate - b.rate)[0];

  return (
    <>
      <div className="title-row">
        <div>
          <h1>Giám sát</h1>
          <p className="sub">{projectById[worst.p.id].name} có tỉ lệ thành công thấp nhất: {pct(worst.rate)} ({worst.ok}/{worst.n} job), {worst.failedFix} job dừng vì hết lượt sửa.</p>
        </div>
        <span className="stamp">{dayMonth(days[0])} – {dayMonth(days[13])}</span>
      </div>
      <div className="grid">
        <section className="panel span-8" aria-labelledby="h-cost">
          <header><h2 id="h-cost">Chi phí Claude API mỗi ngày</h2><span className="meta num">Tổng {usd(total)}</span></header>
          <Chart kind="bars" label="Chi phí mỗi ngày, 14 ngày" height={200} opts={{ labels: days.map(dayMonth), values: cost, highlight: 13, format: (v: number) => usd(v), annotations: [{ at: peak, label: `Cao nhất ${usd(cost[peak])}`, short: usd(cost[peak]) }] }} />
        </section>
        <section className="panel span-4" aria-labelledby="h-tok">
          <header><h2 id="h-tok">Chi phí theo project</h2><span className="meta">14 ngày</span></header>
          <Chart kind="barList" label="Chi phí theo project" rows={[...byProject].sort((a, b) => b.cost - a.cost).map((r) => ({ label: r.p.name, value: r.cost }))} opts={{ thin: true, format: (v: number) => usd(v) }} />
        </section>
        <section className="panel span-12" aria-labelledby="h-proj">
          <header><h2 id="h-proj">Chất lượng theo project</h2><span className="meta">Job đã kết thúc, 14 ngày</span></header>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Project</th><th className="n">Job kết thúc</th><th className="n">Thành công</th><th className="n">Tỉ lệ</th><th className="n">Hết lượt sửa</th><th className="n">Chi phí</th></tr></thead>
              <tbody>
                {byProject.map((r) => (
                  <tr key={r.p.id}><td className="ink">{r.p.name}</td><td className="n num">{r.n}</td><td className="n num">{r.ok}</td>
                    <td className={`n num${r === worst ? ' neg-ink' : ''}`}>{pct(r.rate)}</td><td className="n num">{r.failedFix}</td><td className="n num">{usd(r.cost)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">Đánh giá thủ công (yêu cầu đáp ứng đủ, thay đổi ngoài phạm vi, người phải sửa lại) sẽ có khi backend lưu phản hồi sau merge.</p>
        </section>
      </div>
    </>
  );
}
