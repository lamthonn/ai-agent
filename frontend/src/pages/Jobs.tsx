// Jobs list. Question: "Which job do I open?" Tabs by state, a search, and the table.
import { useMemo, useState } from 'react';
import { App, Button, Form, Input, InputNumber, Modal, Select, Table, Tabs, Upload } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { jobs, projectById, projects, people } from '../data/sample';
import type { Job, JobStatus } from '../data/types';
import { StatusPill } from '../components/StatusPill';
import { currentStep, RunTrace } from '../components/RunTrace';
import { Icon } from '../components/Icon';
import { duration, int, usd, when } from '../lib/format';
import { useTitle } from '../lib/useTitle';

const tabs: { key: string; label: string; match: (s: JobStatus) => boolean }[] = [
  { key: 'all', label: 'Tất cả', match: () => true },
  { key: 'active', label: 'Đang chạy', match: (s) => s === 'running' || s === 'queued' },
  { key: 'approval', label: 'Chờ duyệt', match: (s) => s === 'approval' },
  { key: 'failed', label: 'Lỗi', match: (s) => s === 'failed' },
  { key: 'done', label: 'Hoàn tất', match: (s) => s === 'succeeded' || s === 'cancelled' },
];

export function Jobs() {
  useTitle('Jobs');
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') ?? 'all');
  const [q, setQ] = useState('');
  const [project, setProject] = useState<string | undefined>();

  const scoped = useMemo(() => jobs.filter((j) => (!project || j.project === project) && (!q || `${j.id} ${j.title} ${j.branch}`.toLowerCase().includes(q.toLowerCase()))), [q, project]);
  const rows = scoped.filter((j) => tabs.find((t) => t.key === tab)!.match(j.status));

  const columns: ColumnsType<Job> = [
    { title: 'Job', key: 'job', render: (_, j) => (<div><Link to={`/jobs/${j.id}`} className="mono">{j.id}</Link> <span className="ink">{j.title}</span></div>) },
    { title: 'Project', key: 'p', width: 160, render: (_, j) => projectById[j.project].name },
    { title: 'Trạng thái', key: 's', width: 120, render: (_, j) => <StatusPill status={j.status} /> },
    { title: 'Tiến trình', key: 't', width: 220, render: (_, j) => <><RunTrace job={j} /><span className="sub">{currentStep(j)}</span></> },
    { title: 'Thời gian chạy', key: 'm', width: 120, align: 'right', className: 'num', sorter: (a, b) => a.minutes - b.minutes, render: (_, j) => (j.minutes ? duration(j.minutes) : '—') },
    { title: 'Chi phí', key: 'c', width: 100, align: 'right', className: 'num', sorter: (a, b) => a.cost - b.cost, render: (_, j) => (j.cost ? usd(j.cost) : '—') },
    { title: 'Bắt đầu', key: 'st', width: 130, align: 'right', className: 'num', render: (_, j) => <>{when(j.start)}<span className="sub">{people[j.by].name}</span></> },
  ];

  return (
    <>
      <div className="title-row">
        <div><h1>Jobs</h1><p className="sub">Mỗi job chạy AI Coding Workflow v3 trên branch riêng, không đụng branch gốc.</p></div>
        <div className="title-actions"><Button type="primary" icon={<Icon name="plus" />} onClick={() => setParams({ new: '1' })}>Tạo job</Button></div>
      </div>
      <Tabs activeKey={tab} onChange={setTab} items={tabs.map((t) => ({ key: t.key, label: <span>{t.label} <span className="tab-count num">{scoped.filter((j) => t.match(j.status)).length}</span></span> }))} />
      <div className="filters">
        <Input allowClear prefix={<Icon name="search" size={14} />} placeholder="Tìm theo mã, tên hoặc branch" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 300 }} aria-label="Tìm job" />
        <Select allowClear placeholder="Tất cả project" value={project} onChange={setProject} style={{ width: 200 }} options={projects.map((p) => ({ value: p.id, label: p.name }))} aria-label="Lọc theo project" />
        <span className="spacer" />
        <span className="meta num">{int(rows.length)} job</span>
      </div>
      <Table<Job> rowKey="id" columns={columns} dataSource={rows} size="middle" onRow={(j) => ({ onClick: (e) => { if (!(e.target as HTMLElement).closest('a')) nav(`/jobs/${j.id}`); }, className: 'clickable' })}
        pagination={{ pageSize: 15, showTotal: (t, [a, b]) => `${a}–${b} / ${t}`, showSizeChanger: false }}
        locale={{ emptyText: <div className="empty">Không có job nào khớp bộ lọc.</div> }} scroll={{ x: 1000 }} />
      <NewJobModal open={params.get('new') === '1'} onClose={() => setParams({})} />
    </>
  );
}

function NewJobModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const projectId = Form.useWatch('project', form);
  const p = projectId ? projectById[projectId] : undefined;
  return (
    <Modal open={open} onCancel={onClose} title="Tạo job" okText="Tạo và chạy" cancelText="Hủy" width={620} destroyOnHidden
      onOk={() => form.validateFields().then(() => { message.success('Đã tạo JOB-0152 (bản prototype, chưa gọi API)'); onClose(); })}>
      <Form form={form} layout="vertical" requiredMark={false} initialValues={{ maxFix: 3, workflow: 'ai-coding' }}>
        <Form.Item label="Tên job" name="title" rules={[{ required: true, message: 'Nhập tên job' }]}><Input placeholder="Ví dụ: Thêm API quản lý người dùng" /></Form.Item>
        <div className="form-2">
          <Form.Item label="Project" name="project" rules={[{ required: true, message: 'Chọn project' }]}><Select options={projects.map((x) => ({ value: x.id, label: x.name }))} /></Form.Item>
          <Form.Item label="Workflow" name="workflow"><Select options={[{ value: 'ai-coding', label: 'AI Coding Workflow v3' }]} /></Form.Item>
        </div>
        <Form.Item label="Tài liệu yêu cầu" name="req" rules={[{ required: true, message: 'Đính kèm tài liệu yêu cầu' }]} extra="Markdown, TXT, DOCX hoặc PDF, tối đa 10 MB." valuePropName="fileList" getValueFromEvent={(e) => e?.fileList}>
          <Upload beforeUpload={() => false} maxCount={1} accept=".md,.txt,.docx,.pdf"><Button>Chọn file</Button></Upload>
        </Form.Item>
        <div className="form-2">
          <Form.Item label="Branch" name="branch" extra={p ? `Tạo từ ${p.branch}` : undefined}><Input placeholder="Tự đặt nếu để trống" className="mono" /></Form.Item>
          <Form.Item label="Số lần sửa tối đa" name="maxFix"><InputNumber min={0} max={5} style={{ width: '100%' }} /></Form.Item>
        </div>
        {p && <p className="note">Build: <code>{p.build}</code> · Test: <code>{p.test}</code></p>}
      </Form>
    </Modal>
  );
}
