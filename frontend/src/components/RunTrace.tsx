// The run trace: the product's own element. Every job shows where it is in its workflow, step by step,
// with the minutes each step took and the fix rounds it used. One mark per state; the legend draws the same marks.
import type { Job, StepState } from '../data/types';
import { steps } from '../data/sample';

const stateLabel: Record<StepState, string> = {
  done: 'Xong', running: 'Đang chạy', waiting: 'Chờ duyệt', failed: 'Lỗi', pending: 'Chưa chạy', skipped: 'Bỏ qua',
};

export function RunTrace({ job, size = 'row' }: { job: Job; size?: 'row' | 'large' }) {
  return (
    <ol className={`trace trace-${size}`} aria-label={`Tiến trình ${job.id}`}>
      {job.trace.map((s) => {
        const label = steps.find((x) => x.id === s.step)!.label;
        const detail = s.step === 'fix' && s.state !== 'pending' && s.state !== 'skipped' ? `${s.rounds}/3 vòng` : s.min ? `${s.min} ph` : s.state === 'waiting' ? 'chờ' : '—';
        return (
          <li key={s.step} className={`step is-${s.state}`} title={`${label}: ${stateLabel[s.state]}`}>
            <span className="bar" />
            <span className="name">{label}</span>
            {size === 'large' && <span className="t num">{detail}</span>}
          </li>
        );
      })}
    </ol>
  );
}

export function TraceLegend({ states }: { states: StepState[] }) {
  return (
    <ul className="trace-legend" aria-label="Chú thích">
      {states.map((s) => (
        <li key={s} className={`is-${s}`}><span className="bar" />{stateLabel[s]}</li>
      ))}
    </ul>
  );
}

/** The step a job is on now, in words. */
export function currentStep(job: Job) {
  const s = job.trace.find((x) => ['running', 'waiting', 'failed'].includes(x.state));
  if (!s) return job.status === 'queued' ? 'Trong hàng đợi' : job.status === 'succeeded' ? 'Hoàn tất' : '—';
  const label = steps.find((x) => x.id === s.step)!.label;
  return s.step === 'fix' ? `${label} ${s.rounds}/3` : label;
}
