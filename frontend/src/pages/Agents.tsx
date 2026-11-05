// Agents. Question: "What can each agent do, and with which model?" List left, config of the selected one right.
import { useEffect } from 'react';
import { App, Button, Checkbox, Form, Input, InputNumber, Select } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { agents, jobs, workflow } from '../data/sample';
import type { Agent } from '../data/types';
import { useTitle } from '../lib/useTitle';

const permText: Record<Agent['perm'], string> = { read: 'Chỉ đọc', write: 'Đọc/ghi', test: 'Đọc, chạy lệnh test' };
const allTools = ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash'];

export function Agents() {
  useTitle('Agents');
  const { id } = useParams();
  const nav = useNavigate();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const sel = agents.find((a) => a.id === id) ?? agents[0];
  useEffect(() => { form.setFieldsValue(sel); }, [sel, form]);

  const usedIn = workflow.nodes.filter((n) => n.agent === sel.id).map((n) => n.label);
  // Jobs in the last 7 days that ran a step this agent owns
  const stepFor: Record<string, string> = { 'requirement-analyzer': 'analyze', architect: 'plan', coder: 'code', tester: 'build_test', fixer: 'fix', 'code-reviewer': 'review' };
  const runs = (a: Agent) => jobs.filter((j) => j.start >= new Date(2026, 9, 30) && j.trace.some((s) => s.step === stepFor[a.id] && s.state !== 'pending' && s.state !== 'skipped')).length;

  return (
    <>
      <div className="title-row">
        <div><h1>Agents</h1><p className="sub">{agents.length} agent dùng trong {workflow.name} v{workflow.version}. Agent chỉ đọc không được sửa file.</p></div>
        <div className="title-actions"><Button>Thêm agent</Button></div>
      </div>
      <div className="split">
        <section className="panel list-pane" aria-label="Danh sách agent">
          <ul className="rows">
            {agents.map((a) => (
              <li key={a.id}>
                <button className={`inbox-item${a.id === sel.id ? ' selected' : ''}`} onClick={() => nav(`/agents/${a.id}`)} aria-current={a.id === sel.id ? 'true' : undefined}>
                  <span className="grow"><span className="line1 ink">{a.name}</span><span className="line2">{permText[a.perm]} · <span className="mono">{a.model}</span></span></span>
                  <span className="meta num" title="Số job đã chạy trong 7 ngày">{runs(a)} job</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel detail-pane" aria-labelledby="h-agent">
          <header className="detail-head">
            <div><h2 id="h-agent">{sel.name}</h2><p className="sub">{sel.role}</p></div>
            <span className="meta">Dùng ở: {usedIn.join(', ') || 'chưa dùng'}</span>
          </header>
          <Form form={form} layout="vertical" requiredMark={false} onFinish={() => message.success(`Đã lưu ${sel.name} (prototype)`)}>
            <div className="form-2">
              <Form.Item label="Model" name="model"><Select options={['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'].map((m) => ({ value: m, label: <span className="mono">{m}</span> }))} /></Form.Item>
              <Form.Item label="Số lượt tối đa" name="maxTurns" extra="Agent dừng khi hết lượt, kể cả chưa xong."><InputNumber min={1} max={200} style={{ width: '100%' }} /></Form.Item>
            </div>
            <Form.Item label="Công cụ được phép" name="tools" extra={sel.perm === 'read' ? 'Agent chỉ đọc: Edit, Write và Bash bị khóa.' : undefined}>
              <Checkbox.Group options={allTools.map((t) => ({ label: <span className="mono">{t}</span>, value: t, disabled: sel.perm === 'read' && ['Edit', 'Write', 'Bash'].includes(t) }))} />
            </Form.Item>
            <Form.Item label="System prompt" name="prompt"><Input.TextArea rows={8} className="mono" /></Form.Item>
            <div className="form-actions"><Button type="primary" htmlType="submit">Lưu</Button></div>
          </Form>
        </section>
      </div>
    </>
  );
}
