// Overview. The screen's question: "What is waiting on me?" The finding: JOB-0148 used all 3 fix rounds.
import { Button } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { approvals, jobById, jobs, NOW, projectById, steps, workers } from '../data/sample';
import type { Job } from '../data/types';
import { RunTrace, TraceLegend, currentStep } from '../components/RunTrace';
import { StatusPill } from '../components/StatusPill';
import { Chart } from '../components/Chart';
import { Icon } from '../components/Icon';
import { ago, clock, dayMonth, dec, duration, pct, usd, when } from '../lib/format';
import { useTitle } from '../lib/useTitle';

const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const inWindow = (j: Job, from: Date, to: Date) => j.start >= from && j.start < to;

export function windowStats(from: Date, to: Date) {
  const list = jobs.filter((j) => inWindow(j, from, to));
  const finished = list.filter((j) => j.status === 'succeeded' || j.status === 'failed');
  const ok = finished.filter((j) => j.status === 'succeeded').length;
  const done = list.filter((j) => j.end);
  return {
    count: list.length,
    finished: finished.length,
    ok,
    rate: finished.length ? ok / finished.length : 0,
    avgMin: done.length ? Math.round(done.reduce((a, j) => a + j.minutes, 0) / done.length) : 0,
    avgFix: finished.length ? finished.reduce((a, j) => a + j.fix, 0) / finished.length : 0,
    cost: Math.round(list.reduce((a, j) => a + j.cost, 0) * 100) / 100,
  };
}

export function Overview() {
  useTitle('Tổng quan');
  const nav = useNavigate();

  const today = startOfDay(NOW), tomorrow = new Date(today.getTime() + DAY);
  const wFrom = new Date(today.getTime() - 6 * DAY), pFrom = new Date(wFrom.getTime() - 7 * DAY);
  const w = windowStats(wFrom, tomorrow), prev = windowStats(pFrom, wFrom);

  const failed = jobs.filter((j) => j.status === 'failed' && j.start >= today);
  const pending = approvals.filter((a) => a.status === 'pending');
  const attention = [
    ...failed.map((j) => ({ job: j, reason: j.note ?? 'Job lỗi', since: j.end!, action: 'Xem log', to: `/jobs/${j.id}` })),
    ...pending.map((a) => ({ job: jobById[a.job], reason: a.kind === 'plan' ? 'Kế hoạch chờ duyệt trước khi viết code' : 'Đã qua test và review, chờ duyệt merge', since: a.requested, action: a.kind === 'plan' ? 'Duyệt kế hoạch' : 'Duyệt merge', to: `/approvals/${a.id}` })),
  ];
  const live = jobs.filter((j) => ['running', 'approval', 'queued'].includes(j.status)).sort((a, b) => a.start.getTime() - b.start.getTime());

  // 14 days of jobs per day, today last.
  const days = [...Array(14)].map((_, i) => new Date(today.getTime() - (13 - i) * DAY));
  const perDay = days.map((d) => jobs.filter((j) => inWindow(j, d, new Date(d.getTime() + DAY))).length);

  const finished7 = jobs.filter((j) => inWindow(j, wFrom, tomorrow) && (j.status === 'succeeded' || j.status === 'failed'));
  const fixDist = [0, 1, 2, 3].map((k) => ({ label: k === 0 ? 'Không cần sửa' : k === 3 ? '3 vòng (tối đa)' : `${k} vòng`, value: finished7.filter((j) => j.fix === k).length }));

  const delta = (cur: number, before: number, f: (v: number) => string, goodUp: boolean) => {
    const d = cur - before;
    if (Math.abs(d) < 1e-9) return <span>Không đổi so với 7 ngày trước</span>;
    const good = goodUp ? d > 0 : d < 0;
    return <><span className={good ? 'up' : 'down'}>{d > 0 ? '+' : '−'}{f(Math.abs(d))}</span> so với 7 ngày trước</>;
  };

  return (
    <>
      <div className="title-row">
        <div>
          <h1>Tổng quan</h1>
          <p className="sub">
            {attention.length} việc cần bạn xử lý. {failed[0] ? <><span className="mono">{failed[0].id}</span> đã dùng hết 3/3 lần sửa và dừng lúc {clock(failed[0].end!)}.</> : null}
          </p>
        </div>
        <div className="title-actions">
          <span className="stamp">Cập nhật {clock(NOW)}</span>
          <Button type="primary" icon={<Icon name="plus" />} onClick={() => nav('/jobs?new=1')}>Tạo job</Button>
        </div>
      </div>

      {/* 12 columns, 24px gutter: content 1154px at 1440 → (1154 − 11×24) / 12 = 74.2px per column. 8 + 4 = 12. */}
      <div className="grid">
        <section className="panel span-8" aria-labelledby="h-attn">
          <header><h2 id="h-attn">Cần bạn xử lý</h2><span className="meta num">{attention.length} việc</span></header>
          <ul className="rows">
            {attention.map((a) => (
              <li className="row attn" key={a.job.id + a.action}>
                <div className="grow">
                  <div className="line1"><Link to={`/jobs/${a.job.id}`} className="mono">{a.job.id}</Link> <span className="ink">{a.job.title}</span></div>
                  <div className="line2">{projectById[a.job.project].name} · {a.reason}</div>
                </div>
                <span className="meta nowrap">{a.job.status === 'failed' ? `Dừng ${ago(a.since)}` : `Chờ ${duration(Math.round((NOW.getTime() - a.since.getTime()) / 60000))}`}</span>
                <Button onClick={() => nav(a.to)}>{a.action}</Button>
              </li>
            ))}
            {!attention.length && <li className="empty">Không có việc nào chờ bạn.</li>}
          </ul>
        </section>

        <section className="panel span-4" aria-labelledby="h-sbx">
          <header><h2 id="h-sbx">Sandbox</h2><span className="meta num">{workers.filter((x) => x.state === 'busy').length}/{workers.length} đang chạy</span></header>
          <ul className="rows">
            {workers.map((x) => (
              <li className="row" key={x.id}>
                <div className="grow">
                  <div className="line1"><span className="mono">{x.id}</span> <span className={`dot ${x.state}`} aria-hidden="true" />{x.state === 'busy' ? 'Đang chạy' : x.state === 'idle' ? 'Rảnh' : 'Bảo trì'}</div>
                  <div className="line2">{x.job ? <Link to={`/jobs/${x.job}`} className="mono">{x.job}</Link> : x.note}</div>
                </div>
                <span className="num meta nowrap">{x.state === 'busy' ? `${dec(x.mem)} / ${x.memMax} GB` : '—'}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel span-12" aria-labelledby="h-live">
          <header><h2 id="h-live">Đang chạy và hàng đợi</h2><TraceLegend states={['done', 'running', 'waiting', 'failed', 'pending']} /></header>
          <div className="row live live-head" aria-hidden="true">
            <span />
            <ol className="trace trace-head">{steps.map((s) => <li key={s.id} className="name">{s.label}</li>)}</ol>
            <span />
          </div>
          <ul className="rows">
            {live.map((j) => (
              <li className="row live" key={j.id}>
                <div className="who">
                  <div className="line1"><Link to={`/jobs/${j.id}`} className="mono">{j.id}</Link> <StatusPill status={j.status} /></div>
                  <div className="line2 truncate" title={j.title}>{j.title}</div>
                </div>
                <RunTrace job={j} />
                <div className="where">
                  <div className="line1">{currentStep(j)}</div>
                  <div className="line2">{j.status === 'queued' ? `Vào hàng đợi ${clock(j.start)}` : `Bắt đầu ${clock(j.start)}`}</div>
                </div>
              </li>
            ))}
          </ul>
          {live.find((j) => j.status === 'queued')?.note && <p className="note">{live.find((j) => j.status === 'queued')!.note}.</p>}
        </section>

        <section className="kpis span-12" aria-label="7 ngày qua">
          <div className="kpi"><div className="kpi-label">Jobs 7 ngày</div><div className="kpi-value num">{w.count}</div><div className="delta">{delta(w.count, prev.count, String, true)}</div></div>
          <div className="kpi"><div className="kpi-label">Tỉ lệ thành công</div><div className="kpi-value num">{pct(w.rate)}</div><div className="delta">{w.ok} / {w.finished} job đã kết thúc</div></div>
          <div className="kpi"><div className="kpi-label">Thời gian chạy trung bình</div><div className="kpi-value num">{w.avgMin}<small>phút</small></div><div className="delta">{delta(w.avgMin, prev.avgMin, (v) => `${v} phút`, false)}</div></div>
          <div className="kpi"><div className="kpi-label">Vòng sửa trung bình</div><div className="kpi-value num">{dec(w.avgFix)}<small>/ 3</small></div><div className="delta">{delta(Math.round(w.avgFix * 10) / 10, Math.round(prev.avgFix * 10) / 10, (v) => dec(v), false)}</div></div>
          <div className="kpi"><div className="kpi-label">Chi phí Claude API</div><div className="kpi-value num">{usd(w.cost)}</div><div className="delta">{delta(w.cost, prev.cost, usd, false)}</div></div>
        </section>

        <section className="panel span-8" aria-labelledby="h-day">
          <header><h2 id="h-day">Jobs mỗi ngày</h2><span className="meta">{dayMonth(days[0])} – {dayMonth(days[13])}, hôm nay tô màu</span></header>
          <Chart kind="bars" label="Số job mỗi ngày trong 14 ngày" height={180} opts={{ labels: days.map(dayMonth), values: perDay, highlight: 13 }} />
        </section>

        <section className="panel span-4" aria-labelledby="h-fix">
          <header><h2 id="h-fix">Số vòng sửa mỗi job</h2><span className="meta num">{finished7.length} job, 7 ngày</span></header>
          <Chart kind="barList" label="Phân bố số vòng sửa lỗi" rows={fixDist} opts={{ thin: true }} />
          <p className="note">Job hết 3 vòng sẽ dừng và chờ người xử lý.</p>
        </section>

        <section className="panel span-12" aria-labelledby="h-recent">
          <header><h2 id="h-recent">Job gần đây</h2><Link className="card-link" to="/jobs">Xem tất cả {jobs.length} <Icon name="chevron" size={12} /></Link></header>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Job</th><th>Project</th><th>Trạng thái</th><th>Bước</th><th className="n">Thời gian chạy</th><th className="n">Chi phí</th><th className="n">Bắt đầu</th></tr></thead>
              <tbody>
                {jobs.slice(0, 6).map((j) => (
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
