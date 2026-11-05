// Approvals inbox. Question: "What am I signing off, and is it safe?" List on the left, the evidence on the right.
import { useState } from 'react';
import { App, Button, Input, Popconfirm } from 'antd';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { approvals, jobById, people, projectById } from '../data/sample';
import { api, ApiError } from '../lib/api';
import { aprNumber, refresh, useLive } from '../data/live';
import { useJobDetail } from '../data/useJobDetail';
import { RunTrace } from '../components/RunTrace';
import { canSee, isAdmin, jobApprovers, useMe } from '../data/access';
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
  useLive();
  const visible = approvals.filter((a) => jobById[a.job] && canSee(me, jobById[a.job].project));
  const pending = visible.filter((a) => a.status === 'pending');
  const decided = visible.filter((a) => a.status !== 'pending');
  const sel = visible.find((a) => a.id === id) ?? pending[0] ?? decided[0];
  const allowed = !!sel?.canApprove;
  const job = sel ? jobById[sel.job] : undefined;
  const detail = useJobDetail(job?.id, job?.status);
  const c = detail.context;
  const [busy, setBusy] = useState(false);

  const decide = async (decision: 'approve' | 'reject', vi: string, en: string) => {
    setBusy(true);
    try {
      await api(`/approvals/${aprNumber(sel!.id)}/decide`, { body: { decision, note: comment.trim() || undefined } });
      message.success(tr(`${vi} ${sel!.id}`, `${en} ${sel!.id}`)); setComment('');
      await refresh();
    } catch (e) { message.error(e instanceof ApiError ? e.message : String(e)); } finally { setBusy(false); }
  };

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
              <span className="meta nowrap">{sel.status === 'pending' ? tr(`Chờ ${duration(minutesAgo(sel.requested))}`, `Waiting ${duration(minutesAgo(sel.requested))}`) : tr(`Duyệt lúc ${clock(sel.decided!)} bởi ${people[sel.by!]?.name ?? sel.by}`, `Approved at ${clock(sel.decided!)} by ${people[sel.by!]?.name ?? sel.by}`)}</span>
            </header>
            <RunTrace job={job} />
            {isAdmin(me) && <p className="approvers"><span className="muted">{tr('Người duyệt được', 'Can approve')}:</span> {jobApprovers(job).map((a) => a.name).join(', ')}</p>}

            {detail.loading && <p className="note">{tr('Đang tải…', 'Loading…')}</p>}
            {sel.kind === 'plan' && (
              <div className="doc">
                {c?.plan ? <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{c.plan.text}</pre> : !detail.loading && <p className="note">{tr('Chưa có kế hoạch.', 'No plan yet.')}</p>}
              </div>
            )}

            {sel.kind === 'merge' && (
              <div className="doc">
                {c?.review && <><h3>{tr('Kết luận review', 'Review verdict')} {c.review.verdict && <span className={`pill ${c.review.verdict === 'pass' ? 'pos' : 'neg'}`}>{c.review.verdict === 'pass' ? tr('Đạt', 'Pass') : tr('Không đạt', 'Fail')}</span>}</h3><pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{c.review.text}</pre></>}
                {c?.diff ? <><h3>Git diff</h3><pre className="diff">{c.diff.split('\n').map((ln, i) => <span key={i} className={ln.startsWith('+') ? 'add' : ln.startsWith('-') ? 'del' : ln.startsWith('@@') ? 'hunk' : ''}>{ln}{'\n'}</span>)}</pre></>
                  : !detail.loading && <p className="note">{tr('Không có thay đổi nào để duyệt.', 'There are no changes to approve.')} <Link to={`/jobs/${job.id}`}>{job.id}</Link></p>}
              </div>
            )}

            {sel.status === 'pending' && !allowed && <p className="finding">{tr('Bạn xem được nhưng không duyệt được yêu cầu này: bạn tạo job này nên cần người khác duyệt, hoặc chưa được cấp quyền duyệt.', 'You can see this request but cannot approve it: you created the job so someone else must approve, or you lack approval rights.')}</p>}
            {sel.status === 'pending' && allowed && (
              <footer className="decide">
                <Input.TextArea rows={2} placeholder={tr('Ghi chú (không bắt buộc)', 'Note (optional)')} value={comment} onChange={(e) => setComment(e.target.value)} aria-label={tr('Ghi chú', 'Note')} />
                <div className="decide-actions">
                  <Popconfirm title={tr('Từ chối và hủy job này?', 'Reject and cancel this job?')} okText={tr('Từ chối', 'Reject')} cancelText={tr('Không', 'No')} onConfirm={() => decide('reject', 'Đã từ chối', 'Rejected')}><Button danger loading={busy}>{tr('Từ chối', 'Reject')}</Button></Popconfirm>
                  <Button type="primary" loading={busy} onClick={() => (sel.kind === 'plan' ? decide('approve', 'Đã duyệt kế hoạch', 'Approved plan') : decide('approve', 'Đã duyệt merge', 'Approved merge'))}>{sel.kind === 'plan' ? tr('Duyệt và viết code', 'Approve and start coding') : tr('Duyệt merge', 'Approve merge')}</Button>
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
