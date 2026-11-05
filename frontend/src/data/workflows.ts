// Workflows and their versions. A job keeps the version it ran with, so editing a workflow never changes the
// history. Coordinates are for the builder canvas; `route` pins the side an edge leaves and enters by.
import type { StepId, Workflow, WorkflowVersion } from './types';

const R = (sourceHandle: string, targetHandle: string) => ({ route: { sourceHandle, targetHandle } });

const codingNodesV3: WorkflowVersion['nodes'] = [
  { id: 'start', type: 'start', label: 'Bắt đầu', x: 0, y: 0 },
  { id: 'analyze', type: 'agent', label: 'Phân tích yêu cầu', agent: 'requirement-analyzer', x: 220, y: 0 },
  { id: 'plan', type: 'agent', label: 'Lập kế hoạch', agent: 'architect', x: 440, y: 0 },
  { id: 'approve_plan', type: 'approval', label: 'Duyệt kế hoạch', approver: 'project', x: 440, y: 120 },
  { id: 'code', type: 'agent', label: 'Viết code', agent: 'coder', x: 220, y: 120 },
  { id: 'build_test', type: 'test', label: 'Build & test', command: '{project.build} && {project.test}', x: 0, y: 120 },
  { id: 'build_ok', type: 'condition', label: 'Build & test đạt?', expr: 'exit_code == 0', x: 0, y: 240 },
  { id: 'fix', type: 'agent', label: 'Sửa lỗi', agent: 'fixer', maxLoops: 3, x: -220, y: 240 },
  { id: 'review', type: 'agent', label: 'Review code', agent: 'code-reviewer', x: 0, y: 360 },
  { id: 'review_ok', type: 'condition', label: 'Review đạt?', expr: 'review.verdict == "pass"', x: 220, y: 360 },
  { id: 'approve_merge', type: 'approval', label: 'Duyệt merge', approver: 'project', x: 440, y: 360 },
  { id: 'end', type: 'end', label: 'Báo cáo & kết thúc', x: 440, y: 480 },
];
const codingEdgesV3: WorkflowVersion['edges'] = [
  { from: 'start', to: 'analyze' }, { from: 'analyze', to: 'plan' }, { from: 'plan', to: 'approve_plan' },
  { from: 'approve_plan', to: 'code' }, { from: 'code', to: 'build_test' }, { from: 'build_test', to: 'build_ok' },
  { from: 'build_ok', to: 'review', label: 'Đạt' }, { from: 'build_ok', to: 'fix', label: 'Lỗi' },
  { from: 'fix', to: 'build_test', ...R('s-t', 't-l') }, { from: 'review', to: 'review_ok' },
  { from: 'review_ok', to: 'approve_merge', label: 'Đạt' }, { from: 'review_ok', to: 'fix', label: 'Không đạt', ...R('s-b', 't-b') },
  { from: 'approve_merge', to: 'end' },
];
const allSteps: StepId[] = ['analyze', 'plan', 'approve_plan', 'code', 'build_test', 'fix', 'review', 'approve_merge', 'end'];

export const workflows: Workflow[] = [
  {
    id: 'ai-coding',
    name: { vi: 'AI Coding đầy đủ', en: 'Full AI coding' },
    description: { vi: 'Phân tích, lập kế hoạch có duyệt, viết code, test, sửa lỗi, review, duyệt merge', en: 'Analyse, plan with approval, code, test, fix, review, approve merge' },
    versions: [
      { version: 2, date: '2026-10-14', by: 'ma', note: { vi: 'Thêm bước Review code trước khi duyệt merge', en: 'Added code review before merge approval' }, steps: allSteps,
        nodes: codingNodesV3.filter((n) => n.id !== 'review_ok').map((n) => (n.id === 'fix' ? { ...n, maxLoops: 2 } : n)),
        edges: [...codingEdgesV3.filter((e) => e.from !== 'review_ok' && e.to !== 'review_ok'), { from: 'review', to: 'approve_merge' }] },
      { version: 3, date: '2026-10-29', by: 'ma', note: { vi: 'Review không đạt quay về Sửa lỗi; tăng vòng sửa từ 2 lên 3', en: 'Failed review goes back to Fix; fix rounds raised from 2 to 3' }, steps: allSteps,
        nodes: codingNodesV3, edges: codingEdgesV3 },
    ],
  },
  {
    id: 'quick-fix',
    name: { vi: 'Sửa lỗi nhanh', en: 'Quick fix' },
    description: { vi: 'Cho bug nhỏ: bỏ bước lập kế hoạch và duyệt kế hoạch, vẫn duyệt merge', en: 'For small bugs: no planning or plan approval, merge is still approved' },
    versions: [
      { version: 1, date: '2026-10-08', by: 'ma', note: { vi: 'Bản đầu tiên', en: 'First version' }, steps: ['analyze', 'code', 'build_test', 'fix', 'approve_merge', 'end'],
        nodes: [], edges: [] },
      { version: 2, date: '2026-10-21', by: 'ma', note: { vi: 'Thêm Review code', en: 'Added code review' }, steps: ['analyze', 'code', 'build_test', 'fix', 'review', 'approve_merge', 'end'],
        nodes: [
          { id: 'start', type: 'start', label: 'Bắt đầu', x: 0, y: 0 },
          { id: 'analyze', type: 'agent', label: 'Đọc bug report', agent: 'requirement-analyzer', x: 220, y: 0 },
          { id: 'code', type: 'agent', label: 'Sửa code', agent: 'coder', x: 440, y: 0 },
          { id: 'build_test', type: 'test', label: 'Build & test', command: '{project.build} && {project.test}', x: 440, y: 120 },
          { id: 'build_ok', type: 'condition', label: 'Build & test đạt?', expr: 'exit_code == 0', x: 220, y: 120 },
          { id: 'fix', type: 'agent', label: 'Sửa lỗi', agent: 'fixer', maxLoops: 2, x: 0, y: 120 },
          { id: 'review', type: 'agent', label: 'Review code', agent: 'code-reviewer', x: 220, y: 240 },
          { id: 'approve_merge', type: 'approval', label: 'Duyệt merge', approver: 'project', x: 440, y: 240 },
          { id: 'end', type: 'end', label: 'Báo cáo & kết thúc', x: 440, y: 360 },
        ],
        edges: [
          { from: 'start', to: 'analyze' }, { from: 'analyze', to: 'code' }, { from: 'code', to: 'build_test' }, { from: 'build_test', to: 'build_ok' },
          { from: 'build_ok', to: 'fix', label: 'Lỗi' }, { from: 'fix', to: 'build_test', ...R('s-b', 't-b') },
          { from: 'build_ok', to: 'review', label: 'Đạt' }, { from: 'review', to: 'approve_merge' }, { from: 'approve_merge', to: 'end' },
        ] },
    ],
  },
  {
    id: 'review-only',
    name: { vi: 'Chỉ review', en: 'Review only' },
    description: { vi: 'Review một branch có sẵn do người viết, không sửa code', en: 'Review an existing branch written by a person; no code changes' },
    versions: [
      { version: 1, date: '2026-11-03', by: 'lt', note: { vi: 'Bản đầu tiên', en: 'First version' }, steps: ['build_test', 'review', 'end'],
        nodes: [
          { id: 'start', type: 'start', label: 'Bắt đầu', x: 0, y: 0 },
          { id: 'checkout', type: 'git', label: 'Checkout branch', command: 'git checkout {job.branch}', x: 220, y: 0 },
          { id: 'build_test', type: 'test', label: 'Build & test', command: '{project.build} && {project.test}', x: 440, y: 0 },
          { id: 'review', type: 'agent', label: 'Review code', agent: 'code-reviewer', x: 440, y: 120 },
          { id: 'end', type: 'end', label: 'Gửi nhận xét', x: 220, y: 120 },
        ],
        edges: [{ from: 'start', to: 'checkout' }, { from: 'checkout', to: 'build_test' }, { from: 'build_test', to: 'review' }, { from: 'review', to: 'end' }] },
    ],
  },
  {
    id: 'test-cases',
    name: { vi: 'Kiểm thử theo test case', en: 'Run test cases' },
    description: { vi: 'Chạy các test case có sẵn trên app trong sandbox; ca lỗi được ghi vào file bug. Không sửa code, không cần duyệt', en: 'Runs the existing test cases against the app in a sandbox; failed cases go to the bug file. No code changes, no approval' },
    versions: [
      { version: 1, date: '2026-11-05', by: 'ma', note: { vi: 'Bản đầu tiên', en: 'First version' }, steps: ['prepare', 'run_cases', 'log_bugs', 'end'],
        nodes: [
          { id: 'start', type: 'start', label: 'Bắt đầu', x: 0, y: 0 },
          { id: 'prepare', type: 'command', label: 'Chuẩn bị môi trường', command: '{project.build} && {project.run}', x: 220, y: 0 },
          { id: 'run_cases', type: 'agent', label: 'Chạy test case', agent: 'test-runner', x: 440, y: 0 },
          { id: 'cases_ok', type: 'condition', label: 'Tất cả đạt?', expr: 'cases.failed == 0', x: 440, y: 120 },
          { id: 'log_bugs', type: 'command', label: 'Ghi ca lỗi vào file bug', command: 'sheet.append({project.bugs}, cases.failed)', x: 220, y: 120 },
          { id: 'end', type: 'end', label: 'Báo cáo & kết thúc', x: 440, y: 240 },
        ],
        edges: [
          { from: 'start', to: 'prepare' }, { from: 'prepare', to: 'run_cases' }, { from: 'run_cases', to: 'cases_ok' },
          { from: 'cases_ok', to: 'end', label: 'Đạt' }, { from: 'cases_ok', to: 'log_bugs', label: 'Có lỗi' }, { from: 'log_bugs', to: 'end' },
        ] },
    ],
  },
];
// v1 of quick-fix predates the builder's saved layout; it shows v2's canvas minus the review node.
const qf = workflows[1].versions;
qf[0].nodes = qf[1].nodes.filter((n) => n.id !== 'review').map((n) => (n.id === 'approve_merge' ? { ...n, x: 220, y: 240 } : n));
qf[0].edges = [...qf[1].edges.filter((e) => e.from !== 'review' && e.to !== 'review'), { from: 'build_ok', to: 'approve_merge', label: 'Đạt' }];

export const workflowById: Record<string, Workflow> = Object.fromEntries(workflows.map((w) => [w.id, w]));
export const latest = (w: Workflow) => w.versions[w.versions.length - 1];
export const versionOf = (id: string, v: number) => workflowById[id].versions.find((x) => x.version === v)!;
