// Sample data for the prototype. Every total on screen is computed from these rows.
// The clock is fixed so the screens read the same on every load: Thursday 05/11/2026, 14:20.
// Replace with API calls when the ASP.NET Core backend exists (see CHECKLIST.md).
import type { Agent, Approval, Job, Person, Project, StepId, TraceStep, Worker } from './types';
import { versionOf } from './workflows';

export const NOW = new Date(2026, 10, 5, 14, 20);

export const people: Record<string, Person> = {
  ma: { id: 'ma', name: 'Nguyễn Minh Anh', short: 'MA', hue: 190, role: { vi: 'Tech lead', en: 'Tech lead' } },
  tq: { id: 'tq', name: 'Trần Quốc Huy', short: 'QH', hue: 30, role: { vi: 'Backend .NET', en: '.NET backend' } },
  lt: { id: 'lt', name: 'Lê Thu Trang', short: 'TT', hue: 320, role: { vi: 'Frontend', en: 'Frontend' } },
};
export const me = people.ma;

export const projects: Project[] = [
  { id: 'qlkho', name: 'QLKho', repo: 'git.codes.tech/kho/QLKho.git', branch: 'develop', stack: 'ASP.NET Core 8', build: 'dotnet build', test: 'dotnet test', owner: 'tq', defaultWorkflow: 'ai-coding' },
  { id: 'hddt', name: 'HoaDonDienTu-API', repo: 'git.codes.tech/hddt/HoaDonDienTu-API.git', branch: 'main', stack: 'ASP.NET Core 8', build: 'dotnet build', test: 'dotnet test', owner: 'tq', defaultWorkflow: 'ai-coding' },
  { id: 'web', name: 'CongThongTin-Web', repo: 'git.codes.tech/web/CongThongTin-Web.git', branch: 'main', stack: 'React 18 + Vite', build: 'npm run build', test: 'npm test -- --run', owner: 'lt', defaultWorkflow: 'ai-coding' },
  { id: 'runtime', name: 'AgentRuntime', repo: 'git.codes.tech/ai/AgentRuntime.git', branch: 'main', stack: 'Python 3.12', build: 'uv sync', test: 'pytest -q', owner: 'ma', defaultWorkflow: 'quick-fix' },
];
export const projectById = Object.fromEntries(projects.map((p) => [p.id, p]));

export const agents: Agent[] = [
  { id: 'requirement-analyzer', name: 'Requirement Analyzer', role: { vi: 'Đọc tài liệu yêu cầu, xác định phạm vi và tiêu chí nghiệm thu', en: 'Reads the requirement, sets scope and acceptance criteria' }, model: 'claude-sonnet-5-5', perm: 'read', tools: ['Read', 'Grep', 'Glob'], maxTurns: 20,
    prompt: 'Bạn phân tích tài liệu yêu cầu cho một job lập trình.\n- Liệt kê mục tiêu, phạm vi, tiêu chí nghiệm thu.\n- Ghi lại điểm chưa rõ thành câu hỏi cho người duyệt.\n- Không sửa file nào.' },
  { id: 'architect', name: 'Architect', role: { vi: 'Phân tích codebase, lập kế hoạch và danh sách file sẽ sửa', en: 'Studies the codebase, writes the plan and the files to change' }, model: 'claude-opus-5-5', perm: 'read', tools: ['Read', 'Grep', 'Glob'], maxTurns: 30,
    prompt: 'Bạn lập kế hoạch triển khai dựa trên phân tích yêu cầu và codebase.\n- Nêu các file dự kiến thay đổi và lý do.\n- Chia bước nhỏ, mỗi bước kiểm chứng được.\n- Nêu rủi ro và phần cần người duyệt.' },
  { id: 'coder', name: 'Coding Agent', role: { vi: 'Sửa code theo kế hoạch đã duyệt, viết test đi kèm', en: 'Changes code to the approved plan, with tests' }, model: 'claude-sonnet-5-5', perm: 'write', tools: ['Read', 'Edit', 'Write', 'Grep', 'Glob', 'Bash'], maxTurns: 60,
    prompt: 'Bạn thực hiện kế hoạch đã được duyệt trên branch của job.\n- Tuân thủ convention hiện có của repository.\n- Viết hoặc cập nhật test cho hành vi mới.\n- Không chạm vào file ngoài kế hoạch.' },
  { id: 'tester', name: 'Testing Agent', role: { vi: 'Chạy build và test, tóm tắt lỗi', en: 'Runs build and tests, summarises failures' }, model: 'claude-sonnet-5-5', perm: 'test', tools: ['Read', 'Bash'], maxTurns: 15,
    prompt: 'Bạn chạy lệnh build và test được cấu hình cho project.\n- Lưu stdout, stderr và exit code.\n- Tóm tắt từng test lỗi kèm file và dòng.' },
  { id: 'fixer', name: 'Fix Agent', role: { vi: 'Đọc lỗi build/test và sửa, có giới hạn số vòng', en: 'Reads build/test failures and fixes them, within a round limit' }, model: 'claude-sonnet-5-5', perm: 'write', tools: ['Read', 'Edit', 'Grep', 'Bash'], maxTurns: 30,
    prompt: 'Bạn sửa lỗi từ kết quả build/test hoặc review.\n- Tìm nguyên nhân trước khi sửa.\n- Mỗi vòng chỉ sửa những gì lỗi chỉ ra.\n- Không sửa test để test qua.' },
  { id: 'code-reviewer', name: 'Code Reviewer', role: { vi: 'Review diff, tìm bug và thay đổi ngoài phạm vi', en: 'Reviews the diff for bugs and out-of-scope changes' }, model: 'claude-opus-5-5', perm: 'read', tools: ['Read', 'Grep', 'Glob'], maxTurns: 20,
    prompt: 'Bạn review Git diff của job.\n- Tìm bug, lỗ hổng bảo mật, thay đổi ngoài phạm vi.\n- Kết luận Đạt hoặc Không đạt kèm lý do.' },
];

// Labels for every step a trace can show; each workflow version lists the ones it has.
export const stepLabels: Record<StepId, { vi: string; en: string }> = {
  analyze: { vi: 'Phân tích', en: 'Analyse' },
  plan: { vi: 'Kế hoạch', en: 'Plan' },
  approve_plan: { vi: 'Duyệt KH', en: 'Plan OK' },
  code: { vi: 'Viết code', en: 'Code' },
  build_test: { vi: 'Build & test', en: 'Build & test' },
  fix: { vi: 'Sửa lỗi', en: 'Fix' },
  review: { vi: 'Review', en: 'Review' },
  approve_merge: { vi: 'Duyệt merge', en: 'Merge OK' },
  end: { vi: 'Báo cáo', en: 'Report' },
};

// Seeded generator for the history, so every load shows the same numbers.
let seed = 20261105;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)];

const titles: Record<string, string[]> = {
  qlkho: ['Thêm bộ lọc kho theo chi nhánh', 'Cảnh báo tồn kho dưới định mức', 'Phiếu chuyển kho giữa chi nhánh', 'Xuất Excel danh sách vật tư', 'Kiểm kê định kỳ theo vị trí kệ', 'Sửa lỗi làm tròn đơn giá nhập', 'Phân quyền thủ kho theo kho'],
  hddt: ['Ký số hóa đơn bằng HSM', 'Gửi email hóa đơn cho khách', 'Tra cứu hóa đơn theo mã tra cứu', 'Điều chỉnh hóa đơn sai thông tin', 'Đồng bộ trạng thái với cơ quan thuế', 'Thêm mẫu hóa đơn bán hàng'],
  web: ['Trang đăng nhập bằng mã OTP', 'Bộ lọc nâng cao trang hóa đơn', 'Sửa lỗi bảng trên màn hình nhỏ', 'Thêm trang thông báo hệ thống', 'Tối ưu tải danh sách khách hàng'],
  runtime: ['Lưu log tool call vào artifact', 'Retry khi API trả lỗi 529', 'Ghi Git diff sau mỗi vòng sửa', 'Giới hạn token cho mỗi node'],
};

/** A finished run's trace, keeping only the steps its workflow version has. */
const doneTrace = (steps: StepId[], fix: number, plan: number, code: number, test: number, review: number): TraceStep[] => {
  const all: TraceStep[] = [
    { step: 'analyze', state: 'done', min: 2 },
    { step: 'plan', state: 'done', min: plan },
    { step: 'approve_plan', state: 'done', min: 0 },
    { step: 'code', state: 'done', min: code },
    { step: 'build_test', state: 'done', min: test * (fix + 1) },
    { step: 'fix', state: fix ? 'done' : 'skipped', min: fix * 4, rounds: fix },
    { step: 'review', state: 'done', min: review },
    { step: 'approve_merge', state: 'done', min: 0 },
    { step: 'end', state: 'done', min: 1 },
  ];
  return all.filter((s) => steps.includes(s.step));
};

type RawJob = Omit<Job, 'minutes' | 'tokens' | 'cost' | 'branch' | 'end'>;
const raw: RawJob[] = [];

// 38 historical jobs, 23/10 to 04/11 (weekends quiet): JOB-0106 … JOB-0143.
// Full AI coding ran v2 until v3 was saved on 29/10; AgentRuntime uses Quick fix v2.
const perDay: [string, number][] = [['2026-10-23', 3], ['2026-10-24', 4], ['2026-10-25', 0], ['2026-10-26', 0], ['2026-10-27', 4], ['2026-10-28', 5], ['2026-10-29', 3], ['2026-10-30', 4], ['2026-10-31', 3], ['2026-11-01', 1], ['2026-11-02', 0], ['2026-11-03', 5], ['2026-11-04', 6]];
let n = 106;
for (const [day, count] of perDay) {
  for (let i = 0; i < count; i++) {
    const p = pick(projects);
    const [y, m, d] = day.split('-').map(Number);
    const start = new Date(y, m - 1, d, 9 + Math.floor((i * 8) / count), Math.floor(rnd() * 60));
    const workflowId = p.defaultWorkflow;
    const workflowVersion = workflowId === 'ai-coding' ? (start < new Date(2026, 9, 29) ? 2 : 3) : 2;
    const v = versionOf(workflowId, workflowVersion);
    const maxFix = v.nodes.find((x) => x.id === 'fix')?.maxLoops ?? 3;
    const r = rnd();
    const fix = Math.min(maxFix, r < 0.5 ? 0 : r < 0.8 ? 1 : r < 0.93 ? 2 : 3);
    const roll = rnd();
    const status: Job['status'] = n === 143 ? 'cancelled' : fix === maxFix && roll < 0.45 ? 'failed' : roll < 0.04 ? 'cancelled' : 'succeeded';
    const plan = 3 + Math.floor(rnd() * 4), code = 6 + Math.floor(rnd() * 12), test = 2 + Math.floor(rnd() * 3), review = 2 + Math.floor(rnd() * 3);
    let trace = doneTrace(v.steps, fix, plan, code, test, review);
    if (status === 'failed') trace = trace.map((s) => (['review', 'approve_merge', 'end'].includes(s.step) ? { ...s, state: 'pending', min: 0 } : s.step === 'fix' ? { ...s, state: 'failed' } : s));
    if (status === 'cancelled') trace = trace.map((s, k) => (k > 2 ? { ...s, state: 'pending', min: 0, rounds: 0 } : s));
    raw.push({ id: `JOB-0${n}`, title: pick(titles[p.id]), project: p.id, by: p.owner, status, start, trace, fix: status === 'cancelled' ? 0 : fix, workflowId, workflowVersion });
    n++;
  }
}

// Today's eight jobs, written out by hand: the ones the screens talk about.
const at = (h: number, m: number) => new Date(2026, 10, 5, h, m);
const T = (steps: StepId[], list: Partial<Record<StepId, Partial<TraceStep>>>): TraceStep[] =>
  steps.map((s) => ({ step: s, state: 'pending', min: 0, ...list[s] }) as TraceStep);
const full = versionOf('ai-coding', 3).steps, quick = versionOf('quick-fix', 2).steps;
const AC = { workflowId: 'ai-coding', workflowVersion: 3 }, QF = { workflowId: 'quick-fix', workflowVersion: 2 };

raw.push(
  { id: 'JOB-0144', title: 'Sửa lỗi hiển thị ngày trên Safari', project: 'web', by: 'lt', status: 'succeeded', start: at(8, 42), fix: 1, ...QF, trace: doneTrace(quick, 1, 0, 7, 3, 2) },
  { id: 'JOB-0145', title: 'Báo cáo nhập xuất tồn theo tháng', project: 'qlkho', by: 'tq', status: 'succeeded', start: at(9, 15), fix: 0, ...AC, trace: doneTrace(full, 0, 5, 16, 4, 3) },
  { id: 'JOB-0146', title: 'Kiểm tra mã số thuế khi tạo khách hàng', project: 'hddt', by: 'tq', status: 'queued', start: at(14, 12), fix: 0, ...AC,
    note: { vi: 'Chờ sandbox trống: sbx-01 và sbx-02 đang chạy, sbx-03 đang bảo trì', en: 'Waiting for a sandbox: sbx-01 and sbx-02 are busy, sbx-03 is in maintenance' }, trace: T(full, {}) },
  { id: 'JOB-0147', title: 'Giới hạn thời gian chạy cho sandbox', project: 'runtime', by: 'ma', status: 'running', start: at(13, 50), fix: 1, ...AC,
    trace: T(full, { analyze: { state: 'done', min: 2 }, plan: { state: 'done', min: 4 }, approve_plan: { state: 'done', min: 0 }, code: { state: 'done', min: 11 }, build_test: { state: 'running', min: 6 }, fix: { state: 'done', min: 4, rounds: 1 } }) },
  { id: 'JOB-0148', title: 'Đồng bộ tồn kho theo lô', project: 'qlkho', by: 'tq', status: 'failed', start: at(10, 31), fix: 3, ...AC,
    note: { vi: 'Hết 3/3 lần sửa, 2 test trong InventoryLotTests vẫn lỗi', en: 'Used 3 of 3 fix rounds; 2 tests in InventoryLotTests still fail' },
    trace: T(full, { analyze: { state: 'done', min: 3 }, plan: { state: 'done', min: 6 }, approve_plan: { state: 'done', min: 0 }, code: { state: 'done', min: 19 }, build_test: { state: 'done', min: 16 }, fix: { state: 'failed', min: 21, rounds: 3 } }) },
  { id: 'JOB-0149', title: 'Phân trang server-side cho trang tra cứu hóa đơn', project: 'web', by: 'lt', status: 'approval', approval: 'merge', start: at(11, 20), fix: 1, waitingSince: at(12, 6), ...AC,
    trace: T(full, { analyze: { state: 'done', min: 2 }, plan: { state: 'done', min: 4 }, approve_plan: { state: 'done', min: 0 }, code: { state: 'done', min: 14 }, build_test: { state: 'done', min: 8 }, fix: { state: 'done', min: 5, rounds: 1 }, review: { state: 'done', min: 3 }, approve_merge: { state: 'waiting', min: 0 } }) },
  { id: 'JOB-0150', title: 'Xuất hóa đơn hàng loạt ra PDF', project: 'hddt', by: 'tq', status: 'approval', approval: 'plan', start: at(13, 33), fix: 0, waitingSince: at(13, 41), ...AC,
    trace: T(full, { analyze: { state: 'done', min: 3 }, plan: { state: 'done', min: 5 }, approve_plan: { state: 'waiting', min: 0 } }) },
  { id: 'JOB-0151', title: 'Thêm API quản lý người dùng', project: 'qlkho', by: 'tq', status: 'running', start: at(13, 58), fix: 0, ...AC,
    trace: T(full, { analyze: { state: 'done', min: 2 }, plan: { state: 'done', min: 5 }, approve_plan: { state: 'done', min: 0 }, code: { state: 'running', min: 13 } }) },
);

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30).replace(/-[^-]*$/, '');

// Derived fields: active minutes (approval waits excluded), tokens, cost, branch.
export const jobs: Job[] = raw.map((j) => {
  const minutes = j.trace.reduce((a, s) => a + s.min, 0);
  const tokens = minutes * 9_400 + j.fix * 21_000;
  const cost = Math.round((tokens / 1_000_000) * 3.6 * 100) / 100;
  const branch = j.id === 'JOB-0151' ? 'feature/ai-user-management' : `ai/${j.id.toLowerCase()}-${slug(j.title)}`;
  const end = ['succeeded', 'failed', 'cancelled'].includes(j.status) ? new Date(j.start.getTime() + minutes * 60_000) : null;
  return { ...j, minutes, tokens, cost, branch, end };
}).reverse(); // newest first

export const jobById: Record<string, Job> = Object.fromEntries(jobs.map((j) => [j.id, j]));

export const workers: Worker[] = [
  { id: 'sbx-01', image: 'agent-sandbox:dotnet8', state: 'busy', job: 'JOB-0151', cpu: 0.62, mem: 3.1, memMax: 6 },
  { id: 'sbx-02', image: 'agent-sandbox:python312', state: 'busy', job: 'JOB-0147', cpu: 0.41, mem: 1.8, memMax: 4 },
  { id: 'sbx-03', image: 'agent-sandbox:dotnet8', state: 'maintenance', job: null, cpu: 0, mem: 0, memMax: 6, note: { vi: 'Cập nhật image .NET 8.0.11, xong khoảng 15:00', en: 'Updating the .NET 8.0.11 image, done around 15:00' } },
];

export const approvals: Approval[] = [
  { id: 'APR-0091', job: 'JOB-0150', kind: 'plan', requested: at(13, 41), status: 'pending' },
  { id: 'APR-0090', job: 'JOB-0149', kind: 'merge', requested: at(12, 6), status: 'pending' },
  { id: 'APR-0089', job: 'JOB-0145', kind: 'merge', requested: at(9, 48), status: 'approved', by: 'ma', decided: at(10, 2) },
  { id: 'APR-0088', job: 'JOB-0145', kind: 'plan', requested: at(9, 22), status: 'approved', by: 'ma', decided: at(9, 24) },
  { id: 'APR-0087', job: 'JOB-0144', kind: 'merge', requested: at(9, 0), status: 'approved', by: 'lt', decided: at(9, 3) },
];

// The facts the screens state in words, checked against the rows.
console.assert(jobs.length === 46, 'expected 46 jobs', jobs.length);
console.assert(jobById['JOB-0148'].trace.find((s) => s.step === 'fix')!.rounds === 3, 'JOB-0148 used 3 of 3 fixes');
console.assert(workers.filter((w) => w.state === 'busy').length === jobs.filter((j) => j.status === 'running').length, 'one busy sandbox per running job');
console.assert(approvals.filter((a) => a.status === 'pending').every((a) => jobById[a.job].status === 'approval'), 'pending approvals match jobs waiting');
console.assert(jobs.every((j) => j.trace.length === versionOf(j.workflowId, j.workflowVersion).steps.length), 'every trace matches its workflow version');
