// Job detail. Question: "Where is this job, and what went wrong?" Trace first, then evidence (log, diff, tests).
import { App, Button, Popconfirm, Tabs } from 'antd';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { approvals, jobById, people, projectById } from '../data/sample';
import { contentFor } from '../data/jobContent';
import { RunTrace, TraceLegend, currentStep } from '../components/RunTrace';
import { StatusPill } from '../components/StatusPill';
import { Icon } from '../components/Icon';
import { clock, duration, int, usd, when } from '../lib/format';
import { useTitle } from '../lib/useTitle';

export function JobDetail() {
  const { id = '' } = useParams();
  const job = jobById[id];
  useTitle(job ? job.id : 'Không tìm thấy job');
  const nav = useNavigate();
  const { message } = App.useApp();
  if (!job) return <div className="title-row"><div><h1>Không tìm thấy job {id}</h1><p className="sub"><Link to="/jobs">Về danh sách jobs</Link></p></div></div>;

  const p = projectById[job.project];
  const c = contentFor(job);
  const apr = approvals.find((a) => a.job === job.id && a.status === 'pending');
  const fixStep = job.trace.find((s) => s.step === 'fix')!;

  const actions = {
    running: <><Button icon={<Icon name="pause" />} onClick={() => message.info('Đã gửi lệnh tạm dừng (prototype)')}>Tạm dừng</Button><Popconfirm title={`Hủy ${job.id}?`} description="Branch và workspace được giữ lại." okText="Hủy job" cancelText="Không" onConfirm={() => message.info('Đã hủy (prototype)')}><Button danger icon={<Icon name="stop" />}>Hủy</Button></Popconfirm></>,
    queued: <Popconfirm title={`Bỏ ${job.id} khỏi hàng đợi?`} okText="Bỏ" cancelText="Không"><Button danger>Bỏ khỏi hàng đợi</Button></Popconfirm>,
    approval: <Button type="primary" onClick={() => nav(`/approvals/${apr?.id}`)}>{job.approval === 'plan' ? 'Duyệt kế hoạch' : 'Duyệt merge'}</Button>,
    failed: <><Button onClick={() => message.info('Đã mở workspace (prototype)')}>Mở workspace</Button><Button type="primary" icon={<Icon name="play" />} onClick={() => message.success('Đã chạy lại từ bước Sửa lỗi với thêm 2 vòng (prototype)')}>Chạy lại bước sửa</Button></>,
    succeeded: <Button>Tải báo cáo</Button>,
    cancelled: <Button icon={<Icon name="play" />}>Chạy lại</Button>,
  }[job.status];

  const tabItems = [
    { key: 'log', label: 'Log', children: (
      <pre className="log" aria-label="Log thực thi">{c.log.map((l, i) => (
        <span key={i} className={`log-line ${l.level}`}><span className="log-t">{l.t}</span><span className="log-node">{l.node}</span>{l.msg}{'\n'}</span>
      ))}</pre>) },
    ...('diff' in c && c.diff ? [{ key: 'diff', label: 'Git diff', children: <pre className="diff">{c.diff.split('\n').map((ln, i) => <span key={i} className={ln.startsWith('+') ? 'add' : ln.startsWith('-') ? 'del' : ln.startsWith('@@') ? 'hunk' : ''}>{ln}{'\n'}</span>)}</pre> }] : []),
    ...('diffStat' in c && c.diffStat ? [{ key: 'diff', label: 'Git diff', children: (
      <table><thead><tr><th>File</th><th className="n">Thêm</th><th className="n">Xóa</th></tr></thead>
        <tbody>{c.diffStat.map((f) => <tr key={f.path}><td className="mono">{f.path}</td><td className="n num pos-ink">+{f.add}</td><td className="n num">−{f.del}</td></tr>)}
          <tr className="total"><td>{c.diffStat.length} file</td><td className="n num pos-ink">+{c.diffStat.reduce((a, f) => a + f.add, 0)}</td><td className="n num">−{c.diffStat.reduce((a, f) => a + f.del, 0)}</td></tr></tbody></table>) }] : []),
    ...(c.tests && c.tests.total ? [{ key: 'tests', label: `Test ${c.tests.passed}/${c.tests.total}`, children: (
      <div>
        <p className="lead-line"><span className="num big">{c.tests.passed}/{c.tests.total}</span> test đạt · {c.tests.failed.length} lỗi · {c.tests.duration}</p>
        {c.tests.failed.length ? <ul className="rows">{c.tests.failed.map((t) => (
          <li key={t.name} className="row"><div className="grow"><div className="line1 mono">{t.name}</div><div className="line2">{t.message} · <span className="mono">{t.file}</span></div></div><span className="pill neg">Lỗi</span></li>
        ))}</ul> : <p className="note">Không có test lỗi.</p>}
      </div>) }] : []),
    ...('review' in c && c.review ? [{ key: 'review', label: 'Review', children: <p className="prose">{c.review}</p> }] : []),
    ...('plan' in c && c.plan ? [{ key: 'plan', label: 'Kế hoạch', children: <p className="prose">{c.plan.goal} <Link to={`/approvals/${apr?.id}`}>Xem đầy đủ trong màn duyệt</Link></p> }] : []),
  ];

  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb"><Link to="/jobs">Jobs</Link><Icon name="chevron" size={12} /><span className="mono">{job.id}</span></nav>
      <div className="title-row">
        <div>
          <h1>{job.title} <StatusPill status={job.status} /></h1>
          <p className="sub">{p.name} · <span className="mono">{job.branch}</span> · {job.workflow} · bắt đầu {when(job.start)} bởi {people[job.by].name}</p>
        </div>
        <div className="title-actions">{actions}</div>
      </div>

      {job.note && <p className={`finding ${job.status === 'failed' ? 'bad' : ''}`}>{job.note}.{job.status === 'failed' && ' Branch và workspace được giữ nguyên để bạn xử lý tiếp.'}</p>}

      <div className="grid">
        <section className="panel span-12" aria-labelledby="h-trace">
          <header><h2 id="h-trace">Tiến trình</h2><TraceLegend states={[...new Set(job.trace.map((s) => s.state))].filter((s) => s !== 'skipped')} /></header>
          <RunTrace job={job} size="large" />
        </section>

        <section className="panel span-8" aria-label="Kết quả">
          <Tabs items={tabItems} />
        </section>

        <section className="panel span-4" aria-labelledby="h-facts">
          <header><h2 id="h-facts">Thông tin</h2></header>
          <dl className="facts">
            <div><dt>Bước hiện tại</dt><dd>{currentStep(job)}</dd></div>
            <div><dt>Vòng sửa</dt><dd className="num">{fixStep.rounds ?? 0} / 3</dd></div>
            <div><dt>Thời gian chạy</dt><dd className="num">{job.minutes ? duration(job.minutes) : '—'}</dd></div>
            <div><dt>Kết thúc</dt><dd className="num">{job.end ? clock(job.end) : '—'}</dd></div>
            <div><dt>Token</dt><dd className="num">{job.tokens ? int(job.tokens) : '—'}</dd></div>
            <div><dt>Chi phí</dt><dd className="num">{job.cost ? usd(job.cost) : '—'}</dd></div>
            <div><dt>Build</dt><dd><code>{p.build}</code></dd></div>
            <div><dt>Test</dt><dd><code>{p.test}</code></dd></div>
            <div><dt>Branch gốc</dt><dd className="mono">{p.branch}</dd></div>
          </dl>
          <h3 className="sub-h">Artifact</h3>
          <ul className="rows compact">
            {['execution-log.jsonl', ...(job.end ? ['git-diff.patch', 'test-report.trx', 'final-report.md'] : [])].map((f) => <li key={f} className="row"><span className="mono grow">{f}</span><a href="#" onClick={(e) => e.preventDefault()}>Tải</a></li>)}
          </ul>
          <p className="note">Thời gian chạy không tính lúc chờ duyệt. Token và chi phí là ước tính.</p>
        </section>
      </div>
    </>
  );
}
