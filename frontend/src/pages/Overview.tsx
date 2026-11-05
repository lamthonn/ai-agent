// Overview. The screen's question: "What is waiting on me?" The finding: JOB-0148 used all its fix rounds.
import { Button } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { approvals, jobById, jobs, NOW, projectById, projects, stepLabels, workers } from '../data/sample';
import { versionOf } from '../data/workflows';
import { budgetState, fmtAmount, usedToday, useBudget } from '../data/budget';
import { canSee, useMe } from '../data/access';
import type { Job } from '../data/types';
import { RunTrace, TraceLegend, currentStep, maxFixOf } from '../components/RunTrace';
import { StatusPill } from '../components/StatusPill';
import { Chart } from '../components/Chart';
import { Icon } from '../components/Icon';
import { ago, clock, dayMonth, dec, duration, pct, usd, when } from '../lib/format';
import { useTitle } from '../lib/useTitle';
import { tr, tx } from '../i18n';

const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const inWindow = (j: Job, from: Date, to: Date) => j.start >= from && j.start < to;

export function windowStats(from: Date, to: Date, keep: (j: Job) => boolean = () => true) {
  const list = jobs.filter((j) => inWindow(j, from, to) && keep(j));
  const finished = list.filter((j) => j.status === 'succeeded' || j.status === 'failed');
  const ok = finished.filter((j) => j.status === 'succeeded').length;
  const done = list.filter((j) => j.end);
  return {
    count: list.length, finished: finished.length, ok,
    rate: finished.length ? ok / finished.length : 0,
    avgMin: done.length ? Math.round(done.reduce((a, j) => a + j.minutes, 0) / done.length) : 0,
    avgFix: finished.length ? finished.reduce((a, j) => a + j.fix, 0) / finished.length : 0,
    cost: Math.round(list.reduce((a, j) => a + j.cost, 0) * 100) / 100,
  };
}

export function Overview() {
  useTitle(tr('Tổng quan', 'Overview'));
  const nav = useNavigate();
  const budget = useBudget();
  const me = useMe();
  const mine = (p: string) => canSee(me, p);

  const today = startOfDay(NOW), tomorrow = new Date(today.getTime() + DAY);
  const wFrom = new Date(today.getTime() - 6 * DAY), pFrom = new Date(wFrom.getTime() - 7 * DAY);
  // a member's numbers cover only the projects they can access
  const keep = (j: Job) => mine(j.project);
  const w = windowStats(wFrom, tomorrow, keep), prev = windowStats(pFrom, wFrom, keep);

  const failed = jobs.filter((j) => j.status === 'failed' && j.start >= today && mine(j.project));
  const pending = approvals.filter((a) => a.status === 'pending' && mine(jobById[a.job].project));
  const attention = [
    ...failed.map((j) => ({ job: j, reason: j.note ? tx(j.note) : tr('Job lỗi', 'Job failed'), since: j.end!, action: tr('Xem log', 'View log'), to: `/jobs/${j.id}` })),
    ...pending.map((a) => ({ job: jobById[a.job], reason: a.kind === 'plan' ? tr('Kế hoạch chờ duyệt trước khi viết code', 'Plan awaits approval before coding') : tr('Đã qua test và review, chờ duyệt merge', 'Passed tests and review, awaits merge approval'), since: a.requested, action: a.kind === 'plan' ? tr('Duyệt kế hoạch', 'Review plan') : tr('Duyệt merge', 'Review merge'), to: `/approvals/${a.id}` })),
  ];
  const live = jobs.filter((j) => ['running', 'approval', 'queued'].includes(j.status) && mine(j.project)).sort((a, b) => a.start.getTime() - b.start.getTime());
  // One step header above the traces when every live job runs the same workflow version; otherwise each row names its steps.
  const sameFlow = live.every((j) => j.workflowId === live[0]?.workflowId && j.workflowVersion === live[0]?.workflowVersion);
  const headSteps = live[0] ? versionOf(live[0].workflowId, live[0].workflowVersion).steps : [];

  const days = [...Array(14)].map((_, i) => new Date(today.getTime() - (13 - i) * DAY));
  const perDay = days.map((d) => jobs.filter((j) => inWindow(j, d, new Date(d.getTime() + DAY)) && keep(j)).length);


  const spent = usedToday(budget);
  const bState = budgetState(spent, budget.daily, budget.warnAt);
  const topProject = [...projects].filter((p) => mine(p.id)).sort((x, y) => usedToday(budget, y.id) - usedToday(budget, x.id))[0];

  const delta = (cur: number, before: number, f: (v: number) => string, goodUp: boolean) => {
    const d = cur - before;
    if (Math.abs(d) < 1e-9) return <span>{tr('Không đổi so với 7 ngày trước', 'Same as the 7 days before')}</span>;
    const good = goodUp ? d > 0 : d < 0;
    return <><span className={good ? 'up' : 'down'}>{d > 0 ? '+' : '−'}{f(Math.abs(d))}</span> {tr('so với 7 ngày trước', 'vs the 7 days before')}</>;
  };

  return (
    <>
      <div className="title-row">
        <div>
          <h1>{tr('Tổng quan', 'Overview')}</h1>
          <p className="sub">
            {tr(`${attention.length} việc cần bạn xử lý.`, `${attention.length} items need you.`)}{' '}
            {failed[0] ? tr(`${failed[0].id} đã dùng hết ${maxFixOf(failed[0])}/${maxFixOf(failed[0])} lần sửa và dừng lúc ${clock(failed[0].end!)}.`, `${failed[0].id} used all ${maxFixOf(failed[0])} fix rounds and stopped at ${clock(failed[0].end!)}.`) : null}
          </p>
        </div>
        <div className="title-actions">
          <span className="stamp">{tr('Cập nhật', 'Updated')} {clock(NOW)}</span>
          <Button type="primary" icon={<Icon name="plus" />} onClick={() => nav('/jobs?new=1')}>{tr('Tạo job', 'New job')}</Button>
        </div>
      </div>

      {/* 12 columns, 24px gutter: content 1154px at 1440 → (1154 − 11×24) / 12 = 74.2px per column. 8 + 4 = 12. */}
      <div className="grid">
        <section className="panel span-8" aria-labelledby="h-attn">
          <header><h2 id="h-attn">{tr('Cần bạn xử lý', 'Needs you')}</h2><span className="meta num">{tr(`${attention.length} việc`, `${attention.length} items`)}</span></header>
          <ul className="rows">
            {attention.map((a) => (
              <li className="row attn" key={a.job.id + a.action}>
                <div className="grow">
                  <div className="line1"><Link to={`/jobs/${a.job.id}`} className="mono">{a.job.id}</Link> <span className="ink">{a.job.title}</span></div>
                  <div className="line2">{projectById[a.job.project].name} · {a.reason}</div>
                </div>
                <span className="meta nowrap">{a.job.status === 'failed' ? tr(`Dừng ${ago(a.since)}`, `Stopped ${ago(a.since)}`) : tr(`Chờ ${duration(Math.round((NOW.getTime() - a.since.getTime()) / 60000))}`, `Waiting ${duration(Math.round((NOW.getTime() - a.since.getTime()) / 60000))}`)}</span>
                <Button onClick={() => nav(a.to)}>{a.action}</Button>
              </li>
            ))}
            {!attention.length && <li className="empty">{tr('Không có việc nào chờ bạn.', 'Nothing is waiting on you.')}</li>}
          </ul>
        </section>

        <section className="panel span-4" aria-labelledby="h-budget">
            <header><h2 id="h-budget">{budget.unit === 'usd' ? tr('Chi phí hôm nay', 'Spend today') : tr('Token hôm nay', 'Tokens today')}</h2><Link className="card-link" to="/settings/budget">{tr('Hạn mức', 'Limits')} <Icon name="chevron" size={12} /></Link></header>
            {budget.enabled ? <>
              <div className="budget-figure num"><span className="big">{fmtAmount(budget, spent)}</span> <span className="muted">/ {fmtAmount(budget, budget.daily)}</span></div>
              <div className={`meter ${bState}`} role="meter" aria-valuemin={0} aria-valuemax={budget.daily} aria-valuenow={spent} aria-label={tr('Chi phí hôm nay so với hạn mức', 'Spend today against the limit')}>
                <span style={{ width: `${Math.min(100, (spent / budget.daily) * 100)}%` }} />
                <i style={{ left: `${budget.warnAt * 100}%` }} title={tr('Ngưỡng cảnh báo', 'Warning threshold')} />
              </div>
              <p className="meter-scale num"><span>0</span><span>{tr('cảnh báo', 'warn')} {pct(budget.warnAt, 0)}</span><span>{fmtAmount(budget, budget.daily)}</span></p>
              {topProject && <p className="budget-project num">{topProject.name}: {fmtAmount(budget, usedToday(budget, topProject.id))}{budget.projects[topProject.id] != null ? ` / ${fmtAmount(budget, budget.projects[topProject.id]!)}` : ''} <span className="muted">{tr('· project dùng nhiều nhất', '· top project today')}</span></p>}
              <p className="note">{bState === 'over' ? tr('Đã chạm hạn mức: job mới vào hàng đợi.', 'Limit reached: new jobs wait in the queue.') : bState === 'warn' ? tr('Đã qua ngưỡng cảnh báo.', 'Past the warning threshold.') : tr(`Còn ${fmtAmount(budget, budget.daily - spent)} trước khi chạm hạn mức.`, `${fmtAmount(budget, budget.daily - spent)} left before the limit.`)}</p>
            </> : <p className="note">{tr('Chưa bật hạn mức chi phí.', 'No spending limit is set.')} <Link to="/settings/budget">{tr('Bật', 'Turn on')}</Link></p>}
          </section>

        <section className="panel span-12" aria-labelledby="h-live">
          <header><h2 id="h-live">{tr('Đang chạy và hàng đợi', 'Running and queued')}</h2><TraceLegend states={['done', 'running', 'waiting', 'failed', 'pending']} /></header>
          {sameFlow && (
            <div className="row live live-head" aria-hidden="true">
              <span />
              <ol className="trace trace-head">{headSteps.map((s) => <li key={s} className="name">{tx(stepLabels[s])}</li>)}</ol>
              <span />
            </div>
          )}
          <ul className="rows">
            {live.map((j) => (
              <li className="row live" key={j.id}>
                <div className="who">
                  <div className="line1"><Link to={`/jobs/${j.id}`} className="mono">{j.id}</Link> <StatusPill status={j.status} /></div>
                  <div className="line2 truncate" title={j.title}>{j.title}</div>
                </div>
                <div className={sameFlow ? '' : 'trace-named'}><RunTrace job={j} /></div>
                <div className="where">
                  <div className="line1">{currentStep(j)}</div>
                  <div className="line2">{j.status === 'queued' ? tr(`Vào hàng đợi ${clock(j.start)}`, `Queued at ${clock(j.start)}`) : tr(`Bắt đầu ${clock(j.start)}`, `Started ${clock(j.start)}`)}</div>
                </div>
              </li>
            ))}
          </ul>
          {live.find((j) => j.status === 'queued')?.note && <p className="note">{tx(live.find((j) => j.status === 'queued')!.note!)}.</p>}
        </section>

        <section className="kpis span-12" aria-label={tr('7 ngày qua', 'Last 7 days')}>
          <div className="kpi"><div className="kpi-label">{tr('Jobs 7 ngày', 'Jobs, 7 days')}</div><div className="kpi-value num">{w.count}</div><div className="delta">{delta(w.count, prev.count, String, true)}</div></div>
          <div className="kpi"><div className="kpi-label">{tr('Tỉ lệ thành công', 'Success rate')}</div><div className="kpi-value num">{pct(w.rate)}</div><div className="delta">{tr(`${w.ok} / ${w.finished} job đã kết thúc`, `${w.ok} of ${w.finished} finished jobs`)}</div></div>
          <div className="kpi"><div className="kpi-label">{tr('Thời gian chạy trung bình', 'Average run time')}</div><div className="kpi-value num">{w.avgMin}<small>{tr('phút', 'min')}</small></div><div className="delta">{delta(w.avgMin, prev.avgMin, (v) => duration(v), false)}</div></div>
          <div className="kpi"><div className="kpi-label">{tr('Vòng sửa trung bình', 'Average fix rounds')}</div><div className="kpi-value num">{dec(w.avgFix)}</div><div className="delta">{delta(Math.round(w.avgFix * 10) / 10, Math.round(prev.avgFix * 10) / 10, (v) => dec(v), false)}</div></div>
          <div className="kpi"><div className="kpi-label">{tr('Chi phí Claude API', 'Claude API spend')}</div><div className="kpi-value num">{usd(w.cost)}</div><div className="delta">{delta(w.cost, prev.cost, usd, false)}</div></div>
        </section>

        <section className="panel span-8" aria-labelledby="h-day">
          <header><h2 id="h-day">{tr('Jobs mỗi ngày', 'Jobs per day')}</h2><span className="meta">{dayMonth(days[0])} – {dayMonth(days[13])}, {tr('hôm nay tô màu', 'today in colour')}</span></header>
          <Chart kind="bars" label={tr('Số job mỗi ngày trong 14 ngày', 'Jobs per day over 14 days')} height={180} opts={{ labels: days.map(dayMonth), values: perDay, highlight: 13 }} />
        </section>

        <section className="panel span-4" aria-labelledby="h-sbx">
          <header><h2 id="h-sbx">Sandbox</h2><span className="meta num">{tr(`${workers.filter((x) => x.state === 'busy').length}/${workers.length} đang chạy`, `${workers.filter((x) => x.state === 'busy').length}/${workers.length} busy`)}</span></header>
          <ul className="rows">
            {workers.map((x) => (
              <li className="row" key={x.id}>
                <div className="grow">
                  <div className="line1"><span className="mono">{x.id}</span> <span className={`dot ${x.state}`} aria-hidden="true" />{x.state === 'busy' ? tr('Đang chạy', 'Busy') : x.state === 'idle' ? tr('Rảnh', 'Idle') : tr('Bảo trì', 'Maintenance')}</div>
                  <div className="line2">{x.job ? (mine(jobById[x.job].project) ? <Link to={`/jobs/${x.job}`} className="mono">{x.job}</Link> : <span className="muted">{tr('Job của project khác', 'A job in another project')}</span>) : x.note ? tx(x.note) : null}</div>
                </div>
                <span className="num meta nowrap">{x.state === 'busy' ? `${dec(x.mem)} / ${x.memMax} GB` : '—'}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel span-12" aria-labelledby="h-recent">
          <header><h2 id="h-recent">{tr('Job gần đây', 'Recent jobs')}</h2><Link className="card-link" to="/jobs">{tr(`Xem tất cả ${jobs.filter((j) => mine(j.project)).length}`, `View all ${jobs.filter((j) => mine(j.project)).length}`)} <Icon name="chevron" size={12} /></Link></header>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Job</th><th>Project</th><th>{tr('Trạng thái', 'Status')}</th><th>{tr('Bước', 'Step')}</th><th className="n">{tr('Thời gian chạy', 'Run time')}</th><th className="n">{tr('Chi phí', 'Cost')}</th><th className="n">{tr('Bắt đầu', 'Started')}</th></tr></thead>
              <tbody>
                {jobs.filter((j) => mine(j.project)).slice(0, 6).map((j) => (
                  <tr key={j.id} onClick={() => nav(`/jobs/${j.id}`)} className="clickable">
                    <td><Link to={`/jobs/${j.id}`} className="mono">{j.id}</Link> <span className="ink">{j.title}</span></td>
                    <td>{projectById[j.project].name}</td>
                    <td><StatusPill status={j.status} /></td>
                    <td className="muted">{currentStep(j)}</td>
                    <td className="n num">{j.minutes ? duration(j.minutes) : '—'}</td>
                    <td className="n num">{j.cost ? usd(j.cost) : '—'}</td>
                    <td className="n num">{when(j.start)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
