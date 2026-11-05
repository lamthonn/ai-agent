// Job detail. Question: "Where is this job, and what went wrong?" Trace first, then evidence (log, diff, tests).
import { App, Button, Popconfirm, Tabs } from 'antd';
import { api } from '../lib/api';
import { refresh, useLive } from '../data/live';
import { useJobDetail } from '../data/useJobDetail';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { approvals, jobById, people, projectById } from '../data/sample';
import { fmtAmount, useBudget } from '../data/budget';
import { canSee, isAdmin, jobApprovers, useMe } from '../data/access';
import { RunTrace, TraceLegend, currentStep, maxFixOf } from '../components/RunTrace';
import { StatusPill, WorkflowRef } from '../components/StatusPill';
import { Icon } from '../components/Icon';
import { clock, duration, int, usd, when } from '../lib/format';
import { utc } from '../lib/api';
import { useTitle } from '../lib/useTitle';
import { tr, tx } from '../i18n';

export function JobDetail() {
  const { id = '' } = useParams();
  useLive();
  const job = jobById[id];
  useTitle(job ? job.id : tr('Không tìm thấy job', 'Job not found'));
  const nav = useNavigate();
  const { message } = App.useApp();
  const budget = useBudget();
  const me = useMe();
  const detail = useJobDetail(job ? id : undefined, job?.status);
  if (job && !canSee(me, job.project)) return <div className="title-row"><div><h1>{tr('Bạn chưa được cấp quyền vào project này', 'You do not have access to this project')}</h1><p className="sub">{tr(`${job.id} thuộc ${projectById[job.project].name}. Hãy nhờ admin cấp quyền.`, `${job.id} belongs to ${projectById[job.project].name}. Ask an admin for access.`)} <Link to="/jobs">{tr('Về danh sách jobs', 'Back to jobs')}</Link></p></div></div>;
  if (!job) return <div className="title-row"><div><h1>{tr(`Không tìm thấy job ${id}`, `Job ${id} not found`)}</h1><p className="sub"><Link to="/jobs">{tr('Về danh sách jobs', 'Back to jobs')}</Link></p></div></div>;

  const p = projectById[job.project];
  const apr = approvals.find((a) => a.job === job.id && a.status === 'pending');
  const fixStep = job.trace.find((s) => s.step === 'fix');
  const maxFix = maxFixOf(job);
  const ev = detail.context;

  const cancel = async () => {
    try { await api(`/jobs/${job.id}/cancel`, { method: 'POST', body: {} }); message.success(tr('Đã hủy. Worker dừng ở bước kế tiếp.', 'Cancelled. The worker stops at the next step.')); await refresh(); }
    catch (e) { message.error((e as Error).message); }
  };
  const stop = (label: string) => <Popconfirm title={tr(`Hủy ${job.id}?`, `Cancel ${job.id}?`)} description={tr('Branch và workspace được giữ lại.', 'The branch and workspace are kept.')} okText={tr('Hủy job', 'Cancel job')} cancelText={tr('Không', 'No')} onConfirm={cancel}><Button danger icon={<Icon name="stop" />}>{label}</Button></Popconfirm>;

  const actions = {
    running: stop(tr('Hủy', 'Cancel')),
    queued: stop(tr('Bỏ khỏi hàng đợi', 'Remove from queue')),
    approval: <Button type="primary" disabled={!apr?.canApprove} title={apr?.canApprove ? undefined : tr('Bạn tạo job này nên cần người khác duyệt, hoặc bạn không có quyền duyệt project này', 'You created this job so someone else must approve it, or you cannot approve in this project')} onClick={() => nav(`/approvals/${apr?.id}`)}>{job.approval === 'plan' ? tr('Duyệt kế hoạch', 'Review plan') : tr('Duyệt merge', 'Review merge')}</Button>,
    failed: null, succeeded: null, cancelled: null,
  }[job.status];

  const log = detail.events.map((e) => (
    <span key={e.id} className={`log-line ${e.level}`}><span className="log-t">{clock(utc(e.at)!)}</span>{e.message}{'\n'}</span>
  ));
  const text = (t: string) => <pre className="prose" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{t}</pre>;

  const tabItems = [
    { key: 'log', label: 'Log', children: (
      <pre className="log" aria-label={tr('Log thực thi', 'Execution log')}>{log.length ? log : <span className="muted">{tr('Chưa có log. Job chờ worker nhận.', 'No log yet. The job is waiting for a worker.')}</span>}</pre>) },
    ...(ev?.plan ? [{ key: 'plan', label: tr('Kế hoạch', 'Plan'), children: <>{text(ev.plan.text)}{apr?.kind === 'plan' && <p><Link to={`/approvals/${apr.id}`}>{tr('Duyệt trong màn Chờ duyệt', 'Decide on the approval screen')}</Link></p>}</> }] : []),
    ...(ev?.diff ? [{ key: 'diff', label: 'Git diff', children: <pre className="diff">{ev.diff.split('\n').map((ln, i) => <span key={i} className={ln.startsWith('+') ? 'add' : ln.startsWith('-') ? 'del' : ln.startsWith('@@') ? 'hunk' : ''}>{ln}{'\n'}</span>)}</pre> }] : []),
    ...(ev?.review ? [{ key: 'review', label: 'Review', children: text(ev.review.text) }] : []),
    ...(ev?.analyze ? [{ key: 'analyze', label: tr('Phân tích', 'Analysis'), children: text(ev.analyze.text) }] : []),
    { key: 'req', label: tr('Yêu cầu', 'Requirement'), children: text(detail.requirement) },
  ];

  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb"><Link to="/jobs">Jobs</Link><Icon name="chevron" size={12} /><span className="mono">{job.id}</span></nav>
      <div className="title-row">
        <div>
          <h1>{job.title} <StatusPill status={job.status} /></h1>
          <p className="sub">{p.name} · <span className="mono">{job.branch}</span> · <WorkflowRef job={job} /> · {tr(`bắt đầu ${when(job.start)} bởi ${people[job.by]?.name ?? job.by}`, `started ${when(job.start)} by ${people[job.by]?.name ?? job.by}`)}</p>
        </div>
        <div className="title-actions">{actions}</div>
      </div>

      {job.note && <p className={`finding ${job.status === 'failed' ? 'bad' : ''}`}>{tx(job.note)}.{job.status === 'failed' && tr(' Branch và workspace được giữ nguyên để bạn xử lý tiếp.', ' The branch and workspace are kept for you to pick up.')}</p>}

      <div className="grid">
        <section className="panel span-12" aria-labelledby="h-trace">
          <header><h2 id="h-trace">{tr('Tiến trình', 'Progress')}</h2><TraceLegend states={[...new Set(job.trace.map((s) => s.state))].filter((s) => s !== 'skipped')} /></header>
          <RunTrace job={job} size="large" />
        </section>

        <section className="panel span-8" aria-label={tr('Kết quả', 'Results')}>
          <Tabs items={tabItems} />
        </section>

        <section className="panel span-4" aria-labelledby="h-facts">
          <header><h2 id="h-facts">{tr('Thông tin', 'Details')}</h2></header>
          <dl className="facts">
            <div><dt>{tr('Bước hiện tại', 'Current step')}</dt><dd>{currentStep(job)}</dd></div>
            <div><dt>Workflow</dt><dd><WorkflowRef job={job} /></dd></div>
            <div><dt>{tr('Vòng sửa', 'Fix rounds')}</dt><dd className="num">{fixStep ? `${fixStep.rounds ?? 0} / ${maxFix}` : '—'}</dd></div>
            <div><dt>{tr('Thời gian chạy', 'Run time')}</dt><dd className="num">{job.minutes ? duration(job.minutes) : '—'}</dd></div>
            <div><dt>{tr('Kết thúc', 'Ended')}</dt><dd className="num">{job.end ? clock(job.end) : '—'}</dd></div>
            <div><dt>Token</dt><dd className="num">{job.tokens ? int(job.tokens) : '—'}</dd></div>
            <div><dt>{tr('Chi phí', 'Cost')}</dt><dd className="num">{job.cost ? usd(job.cost) : '—'}{budget.enabled && <span className="sub">{tr(`hạn mức ${fmtAmount(budget, budget.perJob)}/job`, `limit ${fmtAmount(budget, budget.perJob)} per job`)}</span>}</dd></div>
            <div><dt>Build</dt><dd><code>{p.build}</code></dd></div>
            <div><dt>Test</dt><dd><code>{p.test}</code></dd></div>
            <div><dt>{tr('Branch gốc', 'Base branch')}</dt><dd className="mono">{p.branch}</dd></div>
            {isAdmin(me) && <div><dt>{tr('Người duyệt được', 'Can approve')}</dt><dd>{jobApprovers(job).map((a) => a.name).join(', ')}</dd></div>}
          </dl>
          <p className="note">{tr('Thời gian chạy không tính lúc chờ duyệt. Token và chi phí là ước tính.', 'Run time excludes approval waits. Tokens and cost are estimates.')}</p>
        </section>
      </div>
    </>
  );
}
