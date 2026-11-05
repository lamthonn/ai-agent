import type { JobStatus } from '../data/types';

const map: Record<JobStatus, { text: string; tone: string }> = {
  queued: { text: 'Hàng đợi', tone: '' },
  running: { text: 'Đang chạy', tone: 'run' },
  approval: { text: 'Chờ duyệt', tone: 'warn' },
  succeeded: { text: 'Thành công', tone: 'pos' },
  failed: { text: 'Lỗi', tone: 'neg' },
  cancelled: { text: 'Đã hủy', tone: '' },
};

export function StatusPill({ status }: { status: JobStatus }) {
  const m = map[status];
  return <span className={`pill ${m.tone}`}>{m.text}</span>;
}

export const statusText = (s: JobStatus) => map[s].text;

/** A person's initials on a pale tint of their own hue. Identity, not data. */
export function Avatar({ short, hue, name }: { short: string; hue: number; name: string }) {
  return <span className="avatar" style={{ background: `hsl(${hue} 55% 92%)`, color: `hsl(${hue} 45% 28%)` }} title={name} aria-label={name}>{short}</span>;
}
