// Job detail. Question: "Where is this job, and what went wrong?" Trace first, then evidence (log, diff, tests).
import { App, Button, Popconfirm, Tabs } from 'antd';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { approvals, jobById, people, projectById } from '../data/sample';
import { contentFor } from '../data/jobContent';
import { fmtAmount, useBudget } from '../data/budget';
import { approvalCheck, canSee, jobApprovers, useMe } from '../data/access';
import { RunTrace, TraceLegend, currentStep, maxFixOf } from '../components/RunTrace';
import { StatusPill, WorkflowRef } from '../components/StatusPill';
import { Icon } from '../components/Icon';
import { clock, duration, int, usd, when } from '../lib/format';
import { useTitle } from '../lib/useTitle';
import { tr, tx } from '../i18n';

export function JobDetail() {
  const { id = '' } = useParams();
  const job = jobById[id];
  useTitle(job ? job.id : tr('Không tìm thấy job', 'Job not found'));
  const nav = useNavigate();
  const { message } = App.useApp();
  const budget = useBudget();
  const me = useMe();
  if (job && !canSee(me, job.project)) return <div className="title-row"><div><h1>{tr('Bạn chưa được cấp quyền vào project này', 'You do not have access to this project')}</h1><p className="sub">{tr(`${job.id} thuộc ${projectById[job.project].name}. Hãy nhờ admin cấp quyền.`, `${job.id} belongs to ${projectById[job.project].name}. Ask an admin for access.`)} <Link to="/jobs">{tr('Về danh sách jobs', 'Back to jobs')}</Link></p></div></div>;
  if (!job) return <div className="title-row"><div><h1>{tr(`Không tìm thấy job ${id}`, `Job ${id} not found`)}</h1><p className="sub"><Link to="/jobs">{tr('Về danh sách jobs', 'Back to jobs')}</Link></p></div></div>;

  const p = projectById[job.project];
  const c = contentFor(job);
  const apr = approvals.find((a) => a.job === job.id && a.status === 'pending');
  const fixStep = job.trace.find((s) => s.step === 'fix');
  const maxFix = maxFixOf(job);
  const check = approvalCheck(me, job);
  const proto = (vi: string, en: string) => message.info(tr(`${vi} (prototype)`, `${en} (prototype)`));

  const actions = {
    running: <><Button icon={<Icon name="pause" />} onClick={() => proto('Đã gửi lệnh tạm dừng', 'Pause sent')}>{tr('Tạm dừng', 'Pause')}</Button><Popconfirm title={tr(`Hủy ${job.id}?`, `Cancel ${job.id}?`)} description={tr('Branch và workspace được giữ lại.', 'The branch and workspace are kept.')} okText={tr('Hủy job', 'Cancel job')} cancelText={tr('Không', 'No')} onConfirm={() => proto('Đã hủy', 'Cancelled')}><Button danger icon={<Icon name="stop" />}>{tr('Hủy', 'Cancel')}</Button></Popconfirm></>,
    queued: <Popconfirm title={tr(`Bỏ ${job.id} khỏi hàng đợi?`, `Remove ${job.id} from the queue?`)} okText={tr('Bỏ', 'Remove')} cancelText={tr('Không', 'No')}><Button danger>{tr('Bỏ khỏi hàng đợi', 'Remove from queue')}</Button></Popconfirm>,
    approval: <Button type="primary" disabled={!check.ok} title={check.ok ? undefined : check.reason === 'own-job' ? tr('Bạn tạo job này nên cần người khác duyệt', 'You created this job; someone else must approve it') : tr('Bạn không có quyền duyệt project này', 'You cannot approve in this project')} onClick={() => nav(`/approvals/${apr?.id}`)}>{job.approval === 'plan' ? tr('Duyệt kế hoạch', 'Review plan') : tr('Duyệt merge', 'Review merge')}</Button>,
    failed: <><Button onClick={() => proto('Đã mở workspace', 'Workspace opened')}>{tr('Mở workspace', 'Open workspace')}</Button><Button type="primary" icon={<Icon name="play" />} onClick={() => proto('Đã chạy lại từ bước Sửa lỗi với thêm 2 vòng', 'Re-ran from Fix with 2 more rounds')}>{tr('Chạy lại bước sửa', 'Re-run fix step')}</Button></>,
    succeeded: <Button>{tr('Tải báo cáo', 'Download report')}</Button>,
    cancelled: <Button icon={<Icon name="play" />}>{tr('Chạy lại', 'Run again')}</Button>,
  }[job.status];

  const tabItems = [
    { key: 'log', label: 'Log', children: (
      <pre className="log" aria-label={tr('Log thực thi', 'Execution log')}>{c.log.map((l, i) => (
        <span key={i} className={`log-line ${l.level}`}><span className="log-t">{l.t}</span><span className="log-node">{l.node}</span>{l.msg}{'\n'}</span>
      ))}</pre>) },
    ...('diff' in c && c.diff ? [{ key: 'diff', label: 'Git diff', children: <pre className="diff">{c.diff.split('\n').map((ln, i) => <span key={i} className={ln.startsWith('+') ? 'add' : ln.startsWith('-') ? 'del' : ln.startsWith('@@') ? 'hunk' : ''}>{ln}{'\n'}</span>)}</pre> }] : []),
    ...('diffStat' in c && c.diffStat ? [{ key: 'diff', label: 'Git diff', children: (
      <table><thead><tr><th>File</th><th className="n">{tr('Thêm', 'Added')}</th><th className="n">{tr('Xóa', 'Removed')}</th></tr></thead>
        <tbody>{c.diffStat.map((f) => <tr key={f.path}><td className="mono">{f.path}</td><td className="n num pos-ink">+{f.add}</td><td className="n num">−{f.del}</td></tr>)}
          <tr className="total"><td>{c.diffStat.length} file</td><td className="n num pos-ink">+{c.diffStat.reduce((a, f) => a + f.add, 0)}</td><td className="n num">−{c.diffStat.reduce((a, f) => a + f.del, 0)}</td></tr></tbody></table>) }] : []),
    ...(c.tests && c.tests.total ? [{ key: 'tests', label: `Test ${c.tests.passed}/${c.tests.total}`, children: (
      <div>
        <p className="lead-line"><span className="num big">{c.tests.passed}/{c.tests.total}</span> {tr('test đạt', 'tests pass')} · {tr(`${c.tests.failed.length} lỗi`, `${c.tests.failed.length} failed`)} · {c.tests.duration}</p>
        {c.tests.failed.length ? <ul className="rows">{c.tests.failed.map((t) => (
          <li key={t.name} className="row"><div className="grow"><div className="line1 mono">{t.name}</div><div className="line2">{t.message} · <span className="mono">{t.file}</span></div></div><span className="pill neg">{tr('Lỗi', 'Failed')}</span></li>
        ))}</ul> : <p className="note">{tr('Không có test lỗi.', 'No failing tests.')}</p>}
      </div>) }] : []),
    ...('review' in c && c.review ? [{ key: 'review', label: 'Review', children: <p className="prose">{c.review}</p> }] : []),
    ...('plan' in c && c.plan ? [{ key: 'plan', label: tr('Kế hoạch', 'Plan'), children: <p className="prose">{c.plan.goal} <Link to={`/approvals/${apr?.id}`}>{tr('Xem đầy đủ trong màn duyệt', 'Read it in full on the approval screen')}</Link></p> }] : []),
  ];

  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb"><Link to="/jobs">Jobs</Link><Icon name="chevron" size={12} /><span className="mono">{job.id}</span></nav>
      <div className="title-row">
        <div>
          <h1>{job.title} <StatusPill status={job.status} /></h1>
          <p className="sub">{p.name} · <span className="mono">{job.branch}</span> · <WorkflowRef job={job} /> · {tr(`bắt đầu ${when(job.start)} bởi ${people[job.by].name}`, `started ${when(job.start)} by ${people[job.by].name}`)}</p>
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
            <div><dt>{tr('Người duyệt được', 'Can approve')}</dt><dd>{jobApprovers(job).map((a) => a.name).join(', ')}</dd></div>
          </dl>
          <h3 className="sub-h">Artifact</h3>
          <ul className="rows compact">
            {['execution-log.jsonl', ...(job.end ? ['git-diff.patch', 'test-report.trx', 'final-report.md'] : [])].map((f) => <li key={f} className="row"><span className="mono grow">{f}</span><a href="#" onClick={(e) => e.preventDefault()}>{tr('Tải', 'Download')}</a></li>)}
          </ul>
          <p className="note">{tr('Thời gian chạy không tính lúc chờ duyệt. Token và chi phí là ước tính.', 'Run time excludes approval waits. Tokens and cost are estimates.')}</p>
        </section>
      </div>
    </>
  );
}
