import { Link } from 'react-router-dom';
import type { Job, JobStatus } from '../data/types';
import { workflowById } from '../data/workflows';
import { tr, tx } from '../i18n';

const tone: Record<JobStatus, string> = { queued: '', running: 'run', approval: 'warn', succeeded: 'pos', failed: 'neg', cancelled: '' };
export const statusText = (s: JobStatus) => ({
  queued: tr('Hàng đợi', 'Queued'), running: tr('Đang chạy', 'Running'), approval: tr('Chờ duyệt', 'Awaiting approval'),
  succeeded: tr('Thành công', 'Succeeded'), failed: tr('Lỗi', 'Failed'), cancelled: tr('Đã hủy', 'Cancelled'),
})[s];

export function StatusPill({ status }: { status: JobStatus }) {
  return <span className={`pill ${tone[status]}`}>{statusText(status)}</span>;
}

/** A person's initials on a pale tint of their own hue. Identity, not data. */
export function Avatar({ short, hue, name }: { short: string; hue: number; name: string }) {
  return <span className="avatar" style={{ background: `hsl(${hue} 55% 92%)`, color: `hsl(${hue} 45% 28%)` }} title={name} aria-label={name}>{short}</span>;
}

/** The workflow and version a job ran with, linking to that exact version. */
export function WorkflowRef({ job }: { job: Job }) {
  return <Link to={`/workflows/${job.workflowId}?v=${job.workflowVersion}`}>{tx(workflowById[job.workflowId].name)} v{job.workflowVersion}</Link>;
}
