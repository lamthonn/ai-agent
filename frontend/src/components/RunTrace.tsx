// The run trace: the product's own element. Every job shows where it is in its workflow version, step by step,
// with the minutes each step took and the fix rounds it used. One mark per state; the legend draws the same marks.
import type { Job, StepState } from '../data/types';
import { stepLabels } from '../data/sample';
import { versionOf } from '../data/workflows';
import { tr, tx } from '../i18n';

export const stateLabel = (s: StepState) => ({
  done: tr('Xong', 'Done'), running: tr('Đang chạy', 'Running'), waiting: tr('Chờ duyệt', 'Awaiting approval'),
  failed: tr('Lỗi', 'Failed'), pending: tr('Chưa chạy', 'Not started'), skipped: tr('Bỏ qua', 'Skipped'),
})[s];

/** The fix-round limit of the job's workflow version. */
export const maxFixOf = (job: Job) => versionOf(job.workflowId, job.workflowVersion).nodes.find((n) => n.id === 'fix')?.maxLoops ?? 0;

export function RunTrace({ job, size = 'row' }: { job: Job; size?: 'row' | 'large' }) {
  const max = maxFixOf(job);
  return (
    <ol className={`trace trace-${size}`} aria-label={tr(`Tiến trình ${job.id}`, `Progress of ${job.id}`)}>
      {job.trace.map((s) => {
        const label = tx(stepLabels[s.step]);
        const detail = s.step === 'fix' && s.state !== 'pending' && s.state !== 'skipped' ? tr(`${s.rounds}/${max} vòng`, `${s.rounds}/${max} rounds`)
          : s.min ? tr(`${s.min} ph`, `${s.min} min`) : s.state === 'waiting' ? tr('chờ', 'waiting') : '—';
        return (
          <li key={s.step} className={`step is-${s.state}`} title={`${label}: ${stateLabel(s.state)}`}>
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
    <ul className="trace-legend" aria-label={tr('Chú thích', 'Legend')}>
      {states.map((s) => (
        <li key={s} className={`is-${s}`}><span className="bar" />{stateLabel(s)}</li>
      ))}
    </ul>
  );
}

/** The step a job is on now, in words. */
export function currentStep(job: Job) {
  const s = job.trace.find((x) => ['running', 'waiting', 'failed'].includes(x.state));
  if (!s) return job.status === 'queued' ? tr('Trong hàng đợi', 'Queued') : job.status === 'succeeded' ? tr('Hoàn tất', 'Finished') : '—';
  const label = tx(stepLabels[s.step]);
  return s.step === 'fix' ? `${label} ${s.rounds}/${maxFixOf(job)}` : label;
}
