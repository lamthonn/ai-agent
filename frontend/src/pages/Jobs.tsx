// Jobs list. Question: "Which job do I open?" Tabs by state, a search, and the table.
import { useMemo, useState } from 'react';
import { App, Alert, Button, Form, Input, InputNumber, Modal, Select, Table, Tabs, Upload } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { refresh } from '../data/live';
import { jobs, projectById, projects, people } from '../data/sample';
import { latest, workflowById, workflows } from '../data/workflows';
import { budgetState, fmtAmount, toTokens, usedToday, useBudget } from '../data/budget';
import { canSee, isAdmin, useMe } from '../data/access';
import type { Job, JobStatus } from '../data/types';
import { StatusPill, WorkflowRef } from '../components/StatusPill';
import { currentStep, RunTrace } from '../components/RunTrace';
import { Icon } from '../components/Icon';
import { duration, int, usd, when } from '../lib/format';
import { useTitle } from '../lib/useTitle';
import { tr, tx } from '../i18n';

export function Jobs() {
  useTitle('Jobs');
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') ?? 'all');
  const [q, setQ] = useState('');
  // The filters live in the URL (?p=…&w=…), so a reload or a shared link keeps them. Own keys: ?project= and ?workflow= belong to the New-job dialog.
  const project = params.get('p') ?? undefined;
  const flow = params.get('w') ?? undefined;
  const patch = (changes: Record<string, string | undefined>) => setParams((cur) => { const n = new URLSearchParams(cur); for (const [k, v] of Object.entries(changes)) { if (v) n.set(k, v); else n.delete(k); } return n; });
  const setProject = (v?: string) => patch({ p: v });
  const setFlow = (v?: string) => patch({ w: v });
  const me = useMe();
  const visible = useMemo(() => jobs.filter((j) => canSee(me, j.project)), [me]);
  const myProjects = projects.filter((p) => canSee(me, p.id));

  const tabs: { key: string; label: string; match: (s: JobStatus) => boolean }[] = [
    { key: 'all', label: tr('Tất cả', 'All'), match: () => true },
    { key: 'active', label: tr('Đang chạy', 'Running'), match: (s) => s === 'running' || s === 'queued' },
    { key: 'approval', label: tr('Chờ duyệt', 'Awaiting approval'), match: (s) => s === 'approval' },
    { key: 'failed', label: tr('Lỗi', 'Failed'), match: (s) => s === 'failed' },
    { key: 'done', label: tr('Hoàn tất', 'Finished'), match: (s) => s === 'succeeded' || s === 'cancelled' },
  ];

  const scoped = useMemo(() => visible.filter((j) => (!project || j.project === project) && (!flow || j.workflowId === flow) && (!q || `${j.id} ${j.title} ${j.branch}`.toLowerCase().includes(q.toLowerCase()))), [q, project, flow, visible]);
  const rows = scoped.filter((j) => tabs.find((t) => t.key === tab)!.match(j.status));

  const columns: ColumnsType<Job> = [
    { title: 'Job', key: 'job', render: (_, j) => (<div><Link to={`/jobs/${j.id}`} className="mono">{j.id}</Link> <span className="ink">{j.title}</span><span className="sub">{projectById[j.project].name}</span></div>) },
    { title: 'Workflow', key: 'w', width: 170, render: (_, j) => <span onClick={(e) => e.stopPropagation()}><WorkflowRef job={j} /></span> },
    { title: tr('Trạng thái', 'Status'), key: 's', width: 140, render: (_, j) => <StatusPill status={j.status} /> },
    { title: tr('Tiến trình', 'Progress'), key: 't', width: 200, render: (_, j) => <><RunTrace job={j} /><span className="sub">{currentStep(j)}</span></> },
    { title: tr('Thời gian chạy', 'Run time'), key: 'm', width: 120, align: 'right', className: 'num', sorter: (a, b) => a.minutes - b.minutes, render: (_, j) => (j.minutes ? duration(j.minutes) : '—') },
    { title: tr('Chi phí', 'Cost'), key: 'c', width: 96, align: 'right', className: 'num', sorter: (a, b) => a.cost - b.cost, render: (_, j) => (j.cost ? usd(j.cost) : '—') },
    { title: tr('Bắt đầu', 'Started'), key: 'st', width: 130, align: 'right', className: 'num', render: (_, j) => <>{when(j.start)}<span className="sub">{people[j.by].name}</span></> },
  ];

  return (
    <>
      <div className="title-row">
        <div><h1>Jobs</h1><p className="sub">{isAdmin(me) ? tr('Mỗi job chạy một phiên bản workflow cố định trên branch riêng, không đụng branch gốc.', 'Each job runs one fixed workflow version on its own branch and never touches the base branch.') : tr(`Job trong ${myProjects.length} project bạn được cấp quyền: ${myProjects.map((p) => p.name).join(', ') || 'chưa có'}.`, `Jobs in the ${myProjects.length} projects you can access: ${myProjects.map((p) => p.name).join(', ') || 'none yet'}.`)}</p></div>
        <div className="title-actions"><Button type="primary" icon={<Icon name="plus" />} onClick={() => patch({ new: '1' })}>{tr('Tạo job', 'New job')}</Button></div>
      </div>
      <Tabs activeKey={tab} onChange={setTab} items={tabs.map((t) => ({ key: t.key, label: <span>{t.label} <span className="tab-count num">{scoped.filter((j) => t.match(j.status)).length}</span></span> }))} />
      <div className="filters">
        <Input allowClear prefix={<Icon name="search" size={14} />} placeholder={tr('Tìm theo mã, tên hoặc branch', 'Search by ID, title or branch')} value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 280 }} aria-label={tr('Tìm job', 'Search jobs')} />
        <Select allowClear placeholder={tr('Tất cả project', 'All projects')} value={project} onChange={setProject} style={{ width: 190 }} options={myProjects.map((p) => ({ value: p.id, label: p.name }))} aria-label={tr('Lọc theo project', 'Filter by project')} />
        <Select allowClear placeholder={tr('Tất cả workflow', 'All workflows')} value={flow} onChange={setFlow} style={{ width: 190 }} options={workflows.map((w) => ({ value: w.id, label: tx(w.name) }))} aria-label={tr('Lọc theo workflow', 'Filter by workflow')} />
        <span className="spacer" />
        <span className="meta num">{int(rows.length)} job</span>
      </div>
      <Table<Job> rowKey="id" columns={columns} dataSource={rows} size="middle" onRow={(j) => ({ onClick: (e) => { if (!(e.target as HTMLElement).closest('a')) nav(`/jobs/${j.id}`); }, className: 'clickable' })}
        pagination={{ pageSize: 15, showTotal: (t, [a, b]) => `${a}–${b} / ${t}`, showSizeChanger: false }}
        locale={{ emptyText: <div className="empty">{tr('Không có job nào khớp bộ lọc.', 'No jobs match these filters.')}</div> }} scroll={{ x: 1000 }} />
      <NewJobModal open={params.get('new') === '1'} onClose={() => patch({ new: undefined, project: undefined, workflow: undefined })} onCreated={(id) => { patch({ new: undefined, project: undefined, workflow: undefined }); nav(`/jobs/${id}`); }} initial={{ project: params.get('project') ?? undefined, workflow: params.get('workflow') ?? undefined }} />
    </>
  );
}

function NewJobModal({ open, onClose, onCreated, initial }: { open: boolean; onClose: () => void; onCreated: (id: string) => void; initial: { project?: string; workflow?: string } }) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const budget = useBudget();
  const me = useMe();
  const projectId = Form.useWatch('project', form);
  const flowId = Form.useWatch('workflow', form);
  const p = projectId ? projectById[projectId] : undefined;
  const wf = flowId ? workflowById[flowId] : undefined;
  const [busy, setBusy] = useState(false);
  const loadFile = (file: File) => { void file.text().then((t) => form.setFieldsValue({ requirement: t })); return false; };

  const spent = usedToday(budget), state = budgetState(spent, budget.daily, budget.warnAt);
  const pLimit = projectId ? budget.projects[projectId] : null, pSpent = projectId ? usedToday(budget, projectId) : 0;
  const blocked = budget.enabled && (state === 'over' || (pLimit != null && pSpent >= pLimit));

  return (
    <Modal open={open} onCancel={onClose} title={tr('Tạo job', 'New job')} okText={blocked && budget.action === 'queue' ? tr('Tạo và xếp hàng', 'Create and queue') : tr('Tạo và chạy', 'Create and run')} cancelText={tr('Hủy', 'Cancel')} width={640} destroyOnHidden confirmLoading={busy}
      onOk={() => form.validateFields().then(async (v) => {
        setBusy(true);
        try {
          const limitTokens = v.jobLimit ? Math.round(budget.unit === 'usd' ? toTokens(v.jobLimit) : v.jobLimit * 1_000_000) : undefined;
          const r = await api<{ id: string }>('/jobs', { body: { title: v.title, projectId: v.project, workflowId: v.workflow, requirement: v.requirement, tokenLimit: limitTokens } });
          message.success(tr(`Đã tạo ${r.id}. Worker sẽ nhận job khi rảnh.`, `Created ${r.id}. A worker picks it up when free.`));
          await refresh(); onCreated(r.id);
        } catch (e) { message.error((e as Error).message); } finally { setBusy(false); }
      })}>
      <Form form={form} layout="vertical" initialValues={{ maxFix: 3, cases: 'all', ...initial }}
        onValuesChange={(c) => { if (c.project && !form.isFieldTouched('workflow')) form.setFieldsValue({ workflow: projectById[c.project].defaultWorkflow }); }}>
        <Form.Item label={tr('Tên job', 'Job title')} name="title" rules={[{ required: true, message: tr('Nhập tên job', 'Enter a title') }]}><Input placeholder={tr('Ví dụ: Thêm API quản lý người dùng', 'e.g. Add a user management API')} /></Form.Item>
        <div className="form-2">
          <Form.Item label="Project" name="project" rules={[{ required: true, message: tr('Chọn project', 'Choose a project') }]} extra={isAdmin(me) ? undefined : tr('Chỉ các project bạn được cấp quyền.', 'Only projects you can access.')}><Select placeholder={tr('Chọn project', 'Choose a project')} options={projects.filter((x) => canSee(me, x.id)).map((x) => ({ value: x.id, label: x.name }))} /></Form.Item>
          <Form.Item label="Workflow" name="workflow" rules={[{ required: true, message: tr('Chọn workflow', 'Choose a workflow') }]}
            extra={wf ? `${tr('Chạy', 'Runs')} v${latest(wf).version}${p && p.defaultWorkflow === wf.id ? tr(' · mặc định của project', ' · project default') : ''}` : tr('Chọn project để lấy workflow mặc định', 'Pick a project to get its default')}>
            <Select disabled={!p} placeholder={tr('Chọn project trước', 'Choose a project first')} options={workflows.map((w) => ({ value: w.id, label: tx(w.name) }))} />
          </Form.Item>
        </div>
        {wf && <p className="note flow-desc">{tx(wf.description)}</p>}
        <Form.Item label={tr('Yêu cầu', 'Requirement')} name="requirement" rules={[{ required: true, message: tr('Nhập yêu cầu cho agent', 'Describe what the agent should do') }]}
          extra={<>{tr('Viết rõ phạm vi và tiêu chí nghiệm thu. ', 'Say what is in scope and how it is accepted. ')}<Upload beforeUpload={loadFile} showUploadList={false} accept=".md,.txt"><a>{tr('Nạp từ file .md/.txt', 'Load from a .md/.txt file')}</a></Upload></>}>
          <Input.TextArea rows={7} />
        </Form.Item>
        <div className="form-2">
          <Form.Item label={budget.unit === 'usd' ? tr('Hạn mức cho job này (USD)', 'Limit for this job (USD)') : tr('Hạn mức cho job này (triệu token)', 'Limit for this job (million tokens)')} name="jobLimit" extra={tr(`Để trống: dùng mức chung ${fmtAmount(budget, budget.perJob)}`, `Empty: the workspace limit, ${fmtAmount(budget, budget.perJob)}`)}><InputNumber min={0.1} step={budget.unit === 'usd' ? 0.5 : 0.1} style={{ width: '100%' }} /></Form.Item>
        </div>
        {p && <p className="note">Build: <code>{p.build}</code> · Test: <code>{p.test}</code></p>}
        {budget.enabled && (
          <Alert type={blocked ? 'warning' : 'info'} showIcon={false} className="budget-alert"
            message={<>
              {tr('Hôm nay đã dùng', 'Used today')} <strong className="num">{fmtAmount(budget, spent)}</strong> / {fmtAmount(budget, budget.daily)}
              {p && pLimit != null && <> · {p.name}: <strong className="num">{fmtAmount(budget, pSpent)}</strong> / {fmtAmount(budget, pLimit)}</>}
              {blocked && <> — {budget.action === 'queue' ? tr('job sẽ vào hàng đợi tới ngày mai.', 'the job will be queued until tomorrow.') : budget.action === 'pause' ? tr('job mới bị chặn.', 'new jobs are blocked.') : tr('chỉ cảnh báo, job vẫn chạy.', 'warning only; the job still runs.')}</>}
            </>} />
        )}
      </Form>
    </Modal>
  );
}
