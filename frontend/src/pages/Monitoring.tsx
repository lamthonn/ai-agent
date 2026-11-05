// Monitoring. Question: "Is the platform getting better or more expensive?" 14 days, per day.
import { Link } from 'react-router-dom';
import { allJobs as jobs, NOW, projects } from '../data/sample';
import { workflows } from '../data/workflows';
import { fmtAmount, jobUse, useBudget } from '../data/budget';
import { Chart } from '../components/Chart';
import { dayMonth, pct, usd } from '../lib/format';
import { useTitle } from '../lib/useTitle';
import { tr, tx } from '../i18n';

const DAY = 86_400_000;

export function Monitoring() {
  useTitle(tr('Giám sát', 'Monitoring'));
  const budget = useBudget();
  const today = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());
  const days = [...Array(14)].map((_, i) => new Date(today.getTime() - (13 - i) * DAY));
  const on = (d: Date) => jobs.filter((j) => j.start >= d && j.start < new Date(d.getTime() + DAY));
  // the chart counts in the budget's unit, so the limit line reads against the bars
  const cost = days.map((d) => Math.round(on(d).reduce((a, j) => a + jobUse(budget, j), 0) * 100) / 100);
  const total = Math.round(cost.reduce((a, b) => a + b, 0) * 100) / 100;
  const f = (v: number) => fmtAmount(budget, v);
  const peak = cost.indexOf(Math.max(...cost));
  const overDays = budget.enabled ? cost.filter((c) => c >= budget.daily).length : 0;

  const finished = jobs.filter((j) => j.status === 'succeeded' || j.status === 'failed');
  const quality = (pick: (j: (typeof jobs)[number]) => boolean) => {
    const f = finished.filter(pick);
    const ok = f.filter((j) => j.status === 'succeeded').length;
    return { n: f.length, ok, rate: f.length ? ok / f.length : 0, failed: f.length - ok, cost: Math.round(jobs.filter(pick).reduce((a, j) => a + j.cost, 0) * 100) / 100 };
  };
  const byProject = projects.map((p) => ({ name: p.name, id: p.id, ...quality((j) => j.project === p.id) }));
  const byFlow = workflows.flatMap((w) => w.versions.map((v) => ({ name: `${tx(w.name)} v${v.version}`, id: `${w.id}@${v.version}`, ...quality((j) => j.workflowId === w.id && j.workflowVersion === v.version) }))).filter((r) => r.n);
  const worst = [...byProject].sort((a, b) => a.rate - b.rate)[0];
  const fixDist = [0, 1, 2, 3].map((k) => ({ label: k === 0 ? tr('Không cần sửa', 'No fix needed') : tr(`${k} vòng`, `${k} round${k > 1 ? 's' : ''}`), value: finished.filter((j) => j.fix === k).length }));

  const table = (rows: typeof byProject, first: string) => (
    <div className="table-wrap">
      <table>
        <thead><tr><th>{first}</th><th className="n">{tr('Job kết thúc', 'Finished')}</th><th className="n">{tr('Thành công', 'Succeeded')}</th><th className="n">{tr('Tỉ lệ', 'Rate')}</th><th className="n">{tr('Hết lượt sửa', 'Out of fixes')}</th><th className="n">{tr('Chi phí', 'Cost')}</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}><td className="ink">{r.name}</td><td className="n num">{r.n}</td><td className="n num">{r.ok}</td>
              <td className={`n num${r.id === worst.id ? ' neg-ink' : ''}`}>{pct(r.rate)}</td><td className="n num">{r.failed}</td><td className="n num">{usd(r.cost)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <div className="title-row">
        <div>
          <h1>{tr('Giám sát', 'Monitoring')}</h1>
          <p className="sub">{tr(`${worst.name} có tỉ lệ thành công thấp nhất: ${pct(worst.rate)} (${worst.ok}/${worst.n} job), ${worst.failed} job dừng vì hết lượt sửa.`, `${worst.name} has the lowest success rate: ${pct(worst.rate)} (${worst.ok}/${worst.n} jobs); ${worst.failed} stopped out of fix rounds.`)}</p>
        </div>
        <span className="stamp">{dayMonth(days[0])} – {dayMonth(days[13])}</span>
      </div>
      <div className="grid">
        <section className="panel span-8" aria-labelledby="h-cost">
          <header><h2 id="h-cost">{budget.unit === 'usd' ? tr('Chi phí Claude API mỗi ngày', 'Claude API spend per day') : tr('Token Claude API mỗi ngày', 'Claude API tokens per day')}</h2><span className="meta num">{tr('Tổng', 'Total')} {f(total)}{budget.enabled && <> · {tr(`${overDays} ngày chạm hạn mức`, `${overDays} days at the limit`)}</>}</span></header>
          <Chart kind="bars" label={tr('Chi phí mỗi ngày, 14 ngày', 'Spend per day, 14 days')} height={200} opts={{
            labels: days.map(dayMonth), values: cost, highlight: 13, format: f, tickFormat: budget.unit === 'usd' ? f : (v: number) => (v ? `${v / 1_000_000}M` : "0"),
            annotations: [{ at: peak, label: tr(`Cao nhất ${f(cost[peak])}`, `Peak ${f(cost[peak])}`), short: f(cost[peak]) }],
            ...(budget.enabled ? { reference: { value: budget.daily, label: tr(`Hạn mức ${f(budget.daily)}`, `Limit ${f(budget.daily)}`) } } : {}),
          }} />
          <p className="note"><Link to="/settings/budget">{tr('Đổi hạn mức', 'Change limits')}</Link></p>
        </section>
        <section className="panel span-4" aria-labelledby="h-tok">
          <header><h2 id="h-tok">{tr('Chi phí theo project', 'Spend by project')}</h2><span className="meta">{tr('14 ngày', '14 days')}</span></header>
          <Chart kind="barList" label={tr('Chi phí theo project', 'Spend by project')} rows={[...byProject].sort((a, b) => b.cost - a.cost).map((r) => ({ label: r.name, value: r.cost }))} opts={{ thin: true, format: (v: number) => usd(v) }} />
        </section>
        <section className="panel span-4" aria-labelledby="h-fix">
          <header><h2 id="h-fix">{tr('Số vòng sửa mỗi job', 'Fix rounds per job')}</h2><span className="meta num">{tr(`${finished.length} job kết thúc`, `${finished.length} finished jobs`)}</span></header>
          <Chart kind="barList" label={tr('Phân bố số vòng sửa lỗi', 'Distribution of fix rounds')} rows={fixDist} opts={{ thin: true }} />
          <p className="note">{tr('Job dùng hết số vòng của workflow sẽ dừng và chờ người xử lý.', 'A job that uses all its workflow’s rounds stops and waits for a person.')}</p>
        </section>
        <section className="panel span-8" aria-labelledby="h-proj">
          <header><h2 id="h-proj">{tr('Chất lượng theo project', 'Quality by project')}</h2><span className="meta">{tr('Job đã kết thúc, 14 ngày', 'Finished jobs, 14 days')}</span></header>
          {table(byProject, 'Project')}
        </section>
        <section className="panel span-12" aria-labelledby="h-flow">
          <header><h2 id="h-flow">{tr('Chất lượng theo phiên bản workflow', 'Quality by workflow version')}</h2><span className="meta">{tr('So sánh trước và sau khi sửa workflow', 'Compare before and after a workflow change')}</span></header>
          {table(byFlow.map((r) => ({ ...r, id: r.id })), 'Workflow')}
          <p className="note">{tr('Đánh giá thủ công (đáp ứng đủ yêu cầu, thay đổi ngoài phạm vi, người phải sửa lại) sẽ có khi backend lưu phản hồi sau merge.', 'Manual review scores (requirement met, out-of-scope changes, rework) arrive once the backend stores post-merge feedback.')}</p>
        </section>
      </div>
    </>
  );
}
