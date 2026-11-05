// Agents. Question: "What can each agent do, and with which model?" List left, config of the selected one right.
import { useEffect } from 'react';
import { App, Button, Checkbox, Form, Input, InputNumber, Select } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { agents, allJobs as jobs } from '../data/sample';
import { latest, workflows } from '../data/workflows';
import type { Agent } from '../data/types';
import { useTitle } from '../lib/useTitle';
import { tr, tx } from '../i18n';

const permText = (p: Agent['perm']) => ({ read: tr('Chỉ đọc', 'Read only'), write: tr('Đọc/ghi', 'Read/write'), test: tr('Đọc, chạy lệnh test', 'Read, run tests') })[p];
const allTools = ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash'];
const stepFor: Record<string, string> = { 'requirement-analyzer': 'analyze', architect: 'plan', coder: 'code', tester: 'build_test', fixer: 'fix', 'code-reviewer': 'review' };

export function Agents() {
  useTitle('Agents');
  const { id } = useParams();
  const nav = useNavigate();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const sel = agents.find((a) => a.id === id) ?? agents[0];
  useEffect(() => { form.setFieldsValue(sel); }, [sel, form]);

  // Where the agent sits in the current version of each workflow
  const usedIn = workflows.flatMap((w) => latest(w).nodes.filter((n) => n.agent === sel.id).map((n) => `${tx(w.name)}: ${n.label}`));
  const runs = (a: Agent) => jobs.filter((j) => j.start >= new Date(2026, 9, 30) && j.trace.some((s) => s.step === stepFor[a.id] && s.state !== 'pending' && s.state !== 'skipped')).length;

  return (
    <>
      <div className="title-row">
        <div><h1>Agents</h1><p className="sub">{tr(`${agents.length} agent dùng chung cho mọi workflow. Agent chỉ đọc không được sửa file.`, `${agents.length} agents shared by every workflow. Read-only agents cannot change files.`)}</p></div>
        <div className="title-actions"><Button>{tr('Thêm agent', 'New agent')}</Button></div>
      </div>
      <div className="split">
        <section className="panel list-pane" aria-label={tr('Danh sách agent', 'Agents')}>
          <ul className="rows">
            {agents.map((a) => (
              <li key={a.id}>
                <button className={`inbox-item${a.id === sel.id ? ' selected' : ''}`} onClick={() => nav(`/agents/${a.id}`)} aria-current={a.id === sel.id ? 'true' : undefined}>
                  <span className="grow"><span className="line1 ink">{a.name}</span><span className="line2">{permText(a.perm)} · <span className="mono">{a.model}</span></span></span>
                  <span className="meta num" title={tr('Số job đã chạy trong 7 ngày', 'Jobs run in the last 7 days')}>{runs(a)} job</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel detail-pane" aria-labelledby="h-agent">
          <header className="detail-head">
            <div><h2 id="h-agent">{sel.name}</h2><p className="sub">{tx(sel.role)}</p></div>
          </header>
          <p className="used-in"><span className="muted">{tr('Dùng ở', 'Used in')}:</span> {usedIn.join(' · ') || tr('chưa dùng', 'not used')}</p>
          <Form form={form} layout="vertical" requiredMark={false} onFinish={() => message.success(tr(`Đã lưu ${sel.name} (prototype)`, `Saved ${sel.name} (prototype)`))}>
            <div className="form-2">
              <Form.Item label="Model" name="model"><Select options={['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'].map((m) => ({ value: m, label: <span className="mono">{m}</span> }))} /></Form.Item>
              <Form.Item label={tr('Số lượt tối đa', 'Max turns')} name="maxTurns" extra={tr('Agent dừng khi hết lượt, kể cả chưa xong.', 'The agent stops when it runs out of turns, finished or not.')}><InputNumber min={1} max={200} style={{ width: '100%' }} /></Form.Item>
            </div>
            <Form.Item label={tr('Công cụ được phép', 'Allowed tools')} name="tools" extra={sel.perm === 'read' ? tr('Agent chỉ đọc: Edit, Write và Bash bị khóa.', 'Read-only agent: Edit, Write and Bash are locked.') : undefined}>
              <Checkbox.Group options={allTools.map((t) => ({ label: <span className="mono">{t}</span>, value: t, disabled: sel.perm === 'read' && ['Edit', 'Write', 'Bash'].includes(t) }))} />
            </Form.Item>
            <Form.Item label="System prompt" name="prompt"><Input.TextArea rows={8} className="mono" /></Form.Item>
            <div className="form-actions"><Button type="primary" htmlType="submit">{tr('Lưu', 'Save')}</Button></div>
          </Form>
        </section>
      </div>
    </>
  );
}
