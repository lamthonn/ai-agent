// Approvals inbox. Question: "What am I signing off, and is it safe?" List on the left, the evidence on the right.
import { useState } from 'react';
import { App, Button, Input } from 'antd';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { approvals, jobById, people, projectById } from '../data/sample';
import { contentFor } from '../data/jobContent';
import { RunTrace } from '../components/RunTrace';
import { Avatar } from '../components/StatusPill';
import { clock, duration, minutesAgo } from '../lib/format';
import { useTitle } from '../lib/useTitle';

export function Approvals() {
  useTitle('Chờ duyệt');
  const { id } = useParams();
  const nav = useNavigate();
  const { message } = App.useApp();
  const [comment, setComment] = useState('');
  const pending = approvals.filter((a) => a.status === 'pending');
  const decided = approvals.filter((a) => a.status !== 'pending');
  const sel = approvals.find((a) => a.id === id) ?? pending[0];
  const job = sel ? jobById[sel.job] : undefined;
  const c = job ? contentFor(job) : undefined;

  const decide = (verb: string) => { message.success(`${verb} ${sel!.id} (prototype, chưa gọi API)`); setComment(''); };

  return (
    <>
      <div className="title-row">
        <div><h1>Chờ duyệt</h1><p className="sub">{pending.length} yêu cầu đang chờ. Job dừng ở bước duyệt cho tới khi bạn quyết định.</p></div>
      </div>
      <div className="split">
        <section className="panel list-pane" aria-label="Danh sách yêu cầu">
          <h2 className="pane-h">Đang chờ <span className="meta num">{pending.length}</span></h2>
          <ul className="rows">
            {pending.map((a) => <Item key={a.id} a={a} active={a.id === sel?.id} onClick={() => nav(`/approvals/${a.id}`)} />)}
          </ul>
          <h2 className="pane-h">Đã quyết định hôm nay <span className="meta num">{decided.length}</span></h2>
          <ul className="rows">
            {decided.map((a) => <Item key={a.id} a={a} active={a.id === sel?.id} onClick={() => nav(`/approvals/${a.id}`)} />)}
          </ul>
        </section>

        {sel && job && c && (
          <section className="panel detail-pane" aria-labelledby="h-apr">
            <header className="detail-head">
              <div>
                <h2 id="h-apr">{sel.kind === 'plan' ? 'Duyệt kế hoạch' : 'Duyệt merge'}: {job.title}</h2>
                <p className="sub"><Link to={`/jobs/${job.id}`} className="mono">{job.id}</Link> · {projectById[job.project].name} · <span className="mono">{job.branch}</span></p>
              </div>
              <span className="meta nowrap">{sel.status === 'pending' ? `Chờ ${duration(minutesAgo(sel.requested))}` : `Duyệt lúc ${clock(sel.decided!)} bởi ${people[sel.by!].name}`}</span>
            </header>
            <RunTrace job={job} />

            {sel.kind === 'plan' && 'plan' in c && c.plan && (
              <div className="doc">
                <h3>Mục tiêu</h3><p>{c.plan.goal}</p>
                <h3>Tiêu chí nghiệm thu</h3><ul>{c.plan.criteria.map((x) => <li key={x}>{x}</li>)}</ul>
                <h3>File dự kiến thay đổi <span className="meta num">{c.plan.files.length}</span></h3>
                <table><thead><tr><th>File</th><th>Thay đổi</th><th>Lý do</th></tr></thead>
                  <tbody>{c.plan.files.map((f) => <tr key={f.path}><td className="mono">{f.path}</td><td>{f.change}</td><td className="muted">{f.why}</td></tr>)}</tbody></table>
                <h3>Các bước</h3><ol>{c.plan.steps.map((x) => <li key={x}>{x}</li>)}</ol>
                <h3>Rủi ro</h3><ul>{c.plan.risks.map((x) => <li key={x}>{x}</li>)}</ul>
                <h3>Câu hỏi cho bạn</h3><ul className="questions">{c.plan.questions.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
            )}

            {sel.kind === 'merge' && (
              <div className="doc">
                {'tests' in c && c.tests && c.tests.total > 0 && <p className="lead-line"><span className="num big">{c.tests.passed}/{c.tests.total}</span> test đạt · {c.tests.duration}</p>}
                {'review' in c && c.review && <><h3>Kết luận review</h3><p>{c.review}</p></>}
                {'diffStat' in c && c.diffStat && <>
                  <h3>Thay đổi <span className="meta num">{c.diffStat.length} file</span></h3>
                  <table><thead><tr><th>File</th><th className="n">Thêm</th><th className="n">Xóa</th></tr></thead>
                    <tbody>{c.diffStat.map((f) => <tr key={f.path}><td className="mono">{f.path}</td><td className="n num pos-ink">+{f.add}</td><td className="n num">−{f.del}</td></tr>)}</tbody></table>
                </>}
                {!('diffStat' in c) && <p className="note">Đã merge. Xem chi tiết trong <Link to={`/jobs/${job.id}`}>{job.id}</Link>.</p>}
              </div>
            )}

            {sel.status === 'pending' && (
              <footer className="decide">
                <Input.TextArea rows={2} placeholder="Ghi chú cho agent (bắt buộc khi yêu cầu sửa)" value={comment} onChange={(e) => setComment(e.target.value)} aria-label="Ghi chú" />
                <div className="decide-actions">
                  <Button danger onClick={() => decide('Đã từ chối')}>Từ chối</Button>
                  <Button disabled={!comment.trim()} onClick={() => decide('Đã gửi yêu cầu sửa')} title={!comment.trim() ? 'Nhập ghi chú để yêu cầu sửa' : undefined}>Yêu cầu sửa</Button>
                  <Button type="primary" onClick={() => decide(sel.kind === 'plan' ? 'Đã duyệt kế hoạch' : 'Đã duyệt merge')}>{sel.kind === 'plan' ? 'Duyệt và viết code' : 'Duyệt merge'}</Button>
                </div>
              </footer>
            )}
          </section>
        )}
      </div>
    </>
  );
}

function Item({ a, active, onClick }: { a: (typeof approvals)[number]; active: boolean; onClick: () => void }) {
  const j = jobById[a.job];
  const by = people[j.by];
  return (
    <li>
      <button className={`inbox-item${active ? ' selected' : ''}${a.status !== 'pending' ? ' done' : ''}`} onClick={onClick} aria-current={active ? 'true' : undefined}>
        <Avatar {...by} />
        <span className="grow">
          <span className="line1"><span className="ink">{a.kind === 'plan' ? 'Kế hoạch' : 'Merge'}</span> · <span className="mono">{j.id}</span></span>
          <span className="line2 truncate">{j.title}</span>
        </span>
        <span className="meta num">{clock(a.requested)}</span>
      </button>
    </li>
  );
}
