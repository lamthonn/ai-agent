// Approvals inbox. Question: "What am I signing off, and is it safe?" List on the left, the evidence on the right.
import { useState } from 'react';
import { App, Button, Input } from 'antd';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { approvals, jobById, people, projectById } from '../data/sample';
import { contentFor } from '../data/jobContent';
import { RunTrace } from '../components/RunTrace';
import { approversOf, canApprove, canSee, useMe } from '../data/access';
import { Avatar, WorkflowRef } from '../components/StatusPill';
import { clock, duration, minutesAgo } from '../lib/format';
import { useTitle } from '../lib/useTitle';
import { tr } from '../i18n';

export function Approvals() {
  useTitle(tr('Chờ duyệt', 'Approvals'));
  const { id } = useParams();
  const nav = useNavigate();
  const { message } = App.useApp();
  const [comment, setComment] = useState('');
  const me = useMe();
  const visible = approvals.filter((a) => canSee(me, jobById[a.job].project));
  const pending = visible.filter((a) => a.status === 'pending');
  const decided = visible.filter((a) => a.status !== 'pending');
  const sel = visible.find((a) => a.id === id) ?? pending[0] ?? decided[0];
  const allowed = sel ? canApprove(me, jobById[sel.job].project) : false;
  const job = sel ? jobById[sel.job] : undefined;
  const c = job ? contentFor(job) : undefined;

  const decide = (vi: string, en: string) => { message.success(tr(`${vi} ${sel!.id} (prototype, chưa gọi API)`, `${en} ${sel!.id} (prototype, no API call)`)); setComment(''); };

  return (
    <>
      <div className="title-row">
        <div><h1>{tr('Chờ duyệt', 'Approvals')}</h1><p className="sub">{tr(`${pending.length} yêu cầu đang chờ trong các project bạn được cấp quyền. Job dừng ở bước duyệt cho tới khi có người quyết định.`, `${pending.length} requests waiting in projects you can access. A job holds at its approval step until someone decides.`)}</p></div>
      </div>
      <div className="split">
        <section className="panel list-pane" aria-label={tr('Danh sách yêu cầu', 'Requests')}>
          <h2 className="pane-h">{tr('Đang chờ', 'Waiting')} <span className="meta num">{pending.length}</span></h2>
          <ul className="rows">
            {pending.map((a) => <Item key={a.id} a={a} active={a.id === sel?.id} onClick={() => nav(`/approvals/${a.id}`)} />)}
            {!pending.length && <li className="empty">{tr('Không có yêu cầu nào chờ bạn.', 'Nothing is waiting for you.')}</li>}
          </ul>
          <h2 className="pane-h">{tr('Đã quyết định hôm nay', 'Decided today')} <span className="meta num">{decided.length}</span></h2>
          <ul className="rows">
            {decided.map((a) => <Item key={a.id} a={a} active={a.id === sel?.id} onClick={() => nav(`/approvals/${a.id}`)} />)}
          </ul>
        </section>

        {sel && job && c && (
          <section className="panel detail-pane" aria-labelledby="h-apr">
            <header className="detail-head">
              <div>
                <h2 id="h-apr">{sel.kind === 'plan' ? tr('Duyệt kế hoạch', 'Plan approval') : tr('Duyệt merge', 'Merge approval')}: {job.title}</h2>
                <p className="sub"><Link to={`/jobs/${job.id}`} className="mono">{job.id}</Link> · {projectById[job.project].name} · <WorkflowRef job={job} /> · <span className="mono">{job.branch}</span></p>
              </div>
              <span className="meta nowrap">{sel.status === 'pending' ? tr(`Chờ ${duration(minutesAgo(sel.requested))}`, `Waiting ${duration(minutesAgo(sel.requested))}`) : tr(`Duyệt lúc ${clock(sel.decided!)} bởi ${people[sel.by!].name}`, `Approved at ${clock(sel.decided!)} by ${people[sel.by!].name}`)}</span>
            </header>
            <RunTrace job={job} />
            <p className="approvers"><span className="muted">{tr('Người duyệt được', 'Can approve')}:</span> {approversOf(job.project).map((a) => a.name).join(', ')}</p>

            {sel.kind === 'plan' && 'plan' in c && c.plan && (
              <div className="doc">
                <h3>{tr('Mục tiêu', 'Goal')}</h3><p>{c.plan.goal}</p>
                <h3>{tr('Tiêu chí nghiệm thu', 'Acceptance criteria')}</h3><ul>{c.plan.criteria.map((x) => <li key={x}>{x}</li>)}</ul>
                <h3>{tr('File dự kiến thay đổi', 'Files to change')} <span className="meta num">{c.plan.files.length}</span></h3>
                <table><thead><tr><th>File</th><th>{tr('Thay đổi', 'Change')}</th><th>{tr('Lý do', 'Why')}</th></tr></thead>
                  <tbody>{c.plan.files.map((f) => <tr key={f.path}><td className="mono">{f.path}</td><td>{f.change}</td><td className="muted">{f.why}</td></tr>)}</tbody></table>
                <h3>{tr('Các bước', 'Steps')}</h3><ol>{c.plan.steps.map((x) => <li key={x}>{x}</li>)}</ol>
                <h3>{tr('Rủi ro', 'Risks')}</h3><ul>{c.plan.risks.map((x) => <li key={x}>{x}</li>)}</ul>
                <h3>{tr('Câu hỏi cho bạn', 'Questions for you')}</h3><ul className="questions">{c.plan.questions.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
            )}

            {sel.kind === 'merge' && (
              <div className="doc">
                {'tests' in c && c.tests && c.tests.total > 0 && <p className="lead-line"><span className="num big">{c.tests.passed}/{c.tests.total}</span> {tr('test đạt', 'tests pass')} · {c.tests.duration}</p>}
                {'review' in c && c.review && <><h3>{tr('Kết luận review', 'Review verdict')}</h3><p>{c.review}</p></>}
                {'diffStat' in c && c.diffStat && <>
                  <h3>{tr('Thay đổi', 'Changes')} <span className="meta num">{c.diffStat.length} file</span></h3>
                  <table><thead><tr><th>File</th><th className="n">{tr('Thêm', 'Added')}</th><th className="n">{tr('Xóa', 'Removed')}</th></tr></thead>
                    <tbody>{c.diffStat.map((f) => <tr key={f.path}><td className="mono">{f.path}</td><td className="n num pos-ink">+{f.add}</td><td className="n num">−{f.del}</td></tr>)}</tbody></table>
                </>}
                {!('diffStat' in c) && <p className="note">{tr('Đã merge. Xem chi tiết trong', 'Merged. Details in')} <Link to={`/jobs/${job.id}`}>{job.id}</Link>.</p>}
              </div>
            )}

            {sel.status === 'pending' && !allowed && <p className="finding">{tr('Bạn xem được nhưng không duyệt được yêu cầu này.', 'You can see this request but cannot approve it.')}</p>}
            {sel.status === 'pending' && allowed && (
              <footer className="decide">
                <Input.TextArea rows={2} placeholder={tr('Ghi chú cho agent (bắt buộc khi yêu cầu sửa)', 'Note to the agent (required to request changes)')} value={comment} onChange={(e) => setComment(e.target.value)} aria-label={tr('Ghi chú', 'Note')} />
                <div className="decide-actions">
                  <Button danger onClick={() => decide('Đã từ chối', 'Rejected')}>{tr('Từ chối', 'Reject')}</Button>
                  <Button disabled={!comment.trim()} onClick={() => decide('Đã gửi yêu cầu sửa', 'Requested changes on')} title={!comment.trim() ? tr('Nhập ghi chú để yêu cầu sửa', 'Write a note to request changes') : undefined}>{tr('Yêu cầu sửa', 'Request changes')}</Button>
                  <Button type="primary" onClick={() => (sel.kind === 'plan' ? decide('Đã duyệt kế hoạch', 'Approved plan') : decide('Đã duyệt merge', 'Approved merge'))}>{sel.kind === 'plan' ? tr('Duyệt và viết code', 'Approve and start coding') : tr('Duyệt merge', 'Approve merge')}</Button>
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
          <span className="line1"><span className="ink">{a.kind === 'plan' ? tr('Kế hoạch', 'Plan') : 'Merge'}</span> · <span className="mono">{j.id}</span></span>
          <span className="line2 truncate">{j.title}</span>
        </span>
        <span className="meta num">{clock(a.requested)}</span>
      </button>
    </li>
  );
}
