// Workflows. Question: "Which flows exist, which projects use them, and which version is live?"
import { useState } from 'react';
import { App, Button, Form, Input, Modal, Select } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { allJobs as jobs, NOW, people, projects, stepLabels } from '../data/sample';
import { latest, workflows } from '../data/workflows';
import { Icon } from '../components/Icon';
import { isoDay } from '../lib/format';
import { useTitle } from '../lib/useTitle';
import { tr, tx } from '../i18n';

export function Workflows() {
  useTitle('Workflows');
  const nav = useNavigate();
  const { message } = App.useApp();
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm();
  const since = new Date(NOW.getTime() - 13 * 86_400_000);

  return (
    <>
      <div className="title-row">
        <div><h1>Workflows</h1><p className="sub">{tr(`${workflows.length} workflow. Mỗi project có một workflow mặc định; khi tạo job có thể chọn workflow khác.`, `${workflows.length} workflows. Each project has a default; a job can pick another when it is created.`)}</p></div>
        <div className="title-actions"><Button type="primary" icon={<Icon name="plus" />} onClick={() => setCreating(true)}>{tr('Tạo workflow', 'New workflow')}</Button></div>
      </div>

      <ul className="flow-list">
        {workflows.map((w) => {
          const v = latest(w);
          const runs = jobs.filter((j) => j.workflowId === w.id);
          const recent = runs.filter((j) => j.start >= since);
          const byVersion = w.versions.map((x) => ({ v: x.version, n: runs.filter((j) => j.workflowVersion === x.version).length }));
          const usedBy = projects.filter((p) => p.defaultWorkflow === w.id);
          return (
            <li key={w.id} className="panel flow-card">
              <div className="flow-main">
                <h2><Link to={`/workflows/${w.id}`}>{tx(w.name)}</Link> <span className="pill">v{v.version}</span></h2>
                <p className="muted">{tx(w.description)}</p>
                <ol className="flow-steps" aria-label={tr('Các bước', 'Steps')}>
                  {v.steps.map((s) => <li key={s}>{tx(stepLabels[s])}</li>)}
                </ol>
              </div>
              <dl className="flow-facts">
                <div><dt>{tr('Mặc định cho', 'Default for')}</dt><dd>{usedBy.length ? <ul className="plain-list">{usedBy.map((p) => <li key={p.id}>{p.name}</li>)}</ul> : <span className="muted">{tr('Chưa project nào', 'No project')}</span>}</dd></div>
                <div><dt>{tr('Job 14 ngày', 'Jobs, 14 days')}</dt><dd className="num">{recent.length}<span className="sub">{byVersion.filter((x) => x.n).map((x) => `v${x.v}: ${x.n}`).join(' · ') || tr('chưa chạy', 'not run yet')}</span></dd></div>
                <div><dt>{tr('Sửa lần cuối', 'Last changed')}</dt><dd className="num">{isoDay(v.date)}<span className="sub">{people[v.by].name}</span></dd></div>
              </dl>
              <div className="flow-actions">
                <Button onClick={() => nav(`/workflows/${w.id}`)}>{tr('Mở builder', 'Open builder')}</Button>
              </div>
            </li>
          );
        })}
      </ul>

      <Modal open={creating} title={tr('Tạo workflow', 'New workflow')} okText={tr('Tạo và mở builder', 'Create and open builder')} cancelText={tr('Hủy', 'Cancel')} onCancel={() => setCreating(false)} destroyOnHidden
        onOk={() => form.validateFields().then((v) => { setCreating(false); message.success(tr('Đã tạo bản nháp (prototype)', 'Draft created (prototype)')); nav(`/workflows/${v.from}`); })}>
        <Form form={form} layout="vertical" requiredMark={false} initialValues={{ from: 'ai-coding' }}>
          <Form.Item label={tr('Tên', 'Name')} name="name" rules={[{ required: true, message: tr('Nhập tên', 'Enter a name') }]}><Input placeholder={tr('Ví dụ: Viết test cho code cũ', 'e.g. Add tests to legacy code')} /></Form.Item>
          <Form.Item label={tr('Bắt đầu từ', 'Start from')} name="from" extra={tr('Bản sao phiên bản mới nhất; sửa trong builder rồi lưu thành v1.', 'A copy of the latest version; edit it in the builder and save as v1.')}>
            <Select options={workflows.map((w) => ({ value: w.id, label: `${tx(w.name)} v${latest(w).version}` }))} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
