// Detail content for the jobs the screens open most: log, diff, test results, plan.
// Other jobs get a short generated log from their trace.
import type { Job } from './types';
import { projectById, stepLabels } from './sample';
import { tr, tx } from '../i18n';

export interface LogLine { t: string; node: string; level: 'info' | 'warn' | 'error'; msg: string }
export interface TestResult { total: number; passed: number; failed: { name: string; file: string; message: string }[]; skipped: number; duration: string }
export interface PlanFile { path: string; change: 'Thêm' | 'Sửa'; why: string }
export interface Plan { goal: string; criteria: string[]; files: PlanFile[]; steps: string[]; risks: string[]; questions: string[] }
export interface DiffStat { path: string; add: number; del: number }
export interface JobContent { log: LogLine[]; diff?: string; diffStat?: DiffStat[]; tests?: TestResult; review?: string; plan?: Plan; command?: string }

const tests149: TestResult = { total: 148, passed: 148, skipped: 0, get duration() { return tr('42 giây', '42 s'); }, failed: [] };
const diffStat149 = [
  { path: 'src/pages/TraCuuHoaDon/TraCuuHoaDon.tsx', add: 64, del: 31 },
  { path: 'src/api/invoices.ts', add: 22, del: 6 },
  { path: 'src/hooks/usePagedQuery.ts', add: 48, del: 0 },
  { path: 'src/pages/TraCuuHoaDon/TraCuuHoaDon.test.tsx', add: 57, del: 4 },
];
const review149 = 'Đạt. Không có thay đổi ngoài phạm vi. Gợi ý (không chặn): debounce ô tìm kiếm 300 ms để giảm số lần gọi API.';

export function contentFor(job: Job): JobContent {
  const p = projectById[job.project];
  if (job.id === 'JOB-0149') return { log: genericLog(job), diffStat: diffStat149, tests: tests149, review: review149 };
  return { log: genericLog(job), tests: job.status === 'succeeded' ? { total: 0, passed: 0, failed: [], skipped: 0, duration: '—' } as TestResult : undefined, command: `${p.build} && ${p.test}` };
}

function genericLog(job: Job): LogLine[] {
  const out: LogLine[] = [];
  let t = job.start.getTime();
  const fmt = (ms: number) => new Date(ms).toTimeString().slice(0, 8);
  for (const s of job.trace) {
    if (s.state === 'pending' || s.state === 'skipped') continue;
    const label = tx(stepLabels[s.step]);
    const msg = s.state === 'waiting' ? tr(`${label}: đang chờ người duyệt`, `${label}: waiting for approval`) : s.state === 'running' ? tr(`${label}: đang chạy (${s.min} phút)`, `${label}: running (${s.min} min)`) : tr(`${label}: xong sau ${s.min} phút${s.rounds ? `, ${s.rounds} vòng` : ''}`, `${label}: done in ${s.min} min${s.rounds ? `, ${s.rounds} rounds` : ''}`);
    out.push({ t: fmt(t), node: s.step, level: s.state === 'failed' ? 'error' : 'info', msg });
    t += s.min * 60_000;
  }
  return out;
}
