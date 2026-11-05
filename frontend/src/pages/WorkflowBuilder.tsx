// Workflow builder (React Flow). Question: "Is this flow valid, and what does each node do?"
// Palette on the left (drag or click), canvas in the middle, the selected node's properties on the right.
// Older versions open read-only; a job always shows the version it ran with.
import { useCallback, useMemo, useState, type DragEvent } from 'react';
import { App, Alert, Button, Input, InputNumber, Modal, Segmented, Select } from 'antd';
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, Handle, MarkerType, Position, addEdge, useEdgesState, useNodesState, useReactFlow,
  type Connection, type Edge, type Node, type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { agents, jobs, people, projects } from '../data/sample';
import { latest, workflowById } from '../data/workflows';
import type { NodeType, WfEdge, WfNode, Workflow, WorkflowVersion } from '../data/types';
import { Icon } from '../components/Icon';
import { approverLabel } from '../data/access';
import { isoDay } from '../lib/format';
import { useTitle } from '../lib/useTitle';
import { tr, tx } from '../i18n';

const kinds = (): { type: NodeType; label: string; hint: string; code: string }[] => [
  { type: 'start', label: 'Start', hint: tr('Bắt đầu workflow', 'Starts the workflow'), code: 'S' },
  { type: 'agent', label: 'Agent', hint: tr('Gọi một AI agent', 'Calls an AI agent'), code: 'A' },
  { type: 'condition', label: 'Condition', hint: tr('Rẽ nhánh theo điều kiện', 'Branches on a condition'), code: '?' },
  { type: 'command', label: 'Command', hint: tr('Chạy một lệnh', 'Runs a command'), code: '$' },
  { type: 'git', label: 'Git', hint: tr('Clone, checkout, commit', 'Clone, checkout, commit'), code: 'G' },
  { type: 'test', label: 'Test', hint: tr('Chạy build và test', 'Runs build and tests'), code: 'T' },
  { type: 'approval', label: 'Approval', hint: tr('Chờ người duyệt', 'Waits for a person'), code: 'D' },
  { type: 'delay', label: 'Delay', hint: tr('Chờ một khoảng thời gian', 'Waits for a while'), code: 'W' },
  { type: 'end', label: 'End', hint: tr('Kết thúc workflow', 'Ends the workflow'), code: 'E' },
];
const kindOf = (t: NodeType) => kinds().find((k) => k.type === t)!;

type FlowNode = Node<WfNode & Record<string, unknown>>;
const sides = [{ id: 't', pos: Position.Top }, { id: 'r', pos: Position.Right }, { id: 'b', pos: Position.Bottom }, { id: 'l', pos: Position.Left }];

function FlowNodeView({ data, selected }: NodeProps<FlowNode>) {
  const k = kindOf(data.type);
  const sub = data.type === 'agent' ? agents.find((a) => a.id === data.agent)?.name ?? tr('Chưa chọn agent', 'No agent chosen')
    : data.type === 'condition' ? data.expr : data.type === 'test' || data.type === 'command' || data.type === 'git' ? data.command
    : data.type === 'approval' ? tr(`Duyệt: ${approverLabel(data.approver)}`, `Approver: ${approverLabel(data.approver)}`) : k.hint;
  return (
    <div className={`wf-node t-${data.type}${selected ? ' selected' : ''}`}>
      {data.type !== 'start' && sides.map((s) => <Handle key={`t-${s.id}`} id={`t-${s.id}`} type="target" position={s.pos} />)}
      <span className="wf-code" aria-hidden="true">{k.code}</span>
      <span className="wf-text"><span className="wf-label">{data.label}</span><span className="wf-sub">{sub}{data.maxLoops ? tr(` · tối đa ${data.maxLoops} vòng`, ` · max ${data.maxLoops} rounds`) : ''}</span></span>
      {data.type !== 'end' && sides.map((s) => <Handle key={`s-${s.id}`} id={`s-${s.id}`} type="source" position={s.pos} />)}
    </div>
  );
}
const nodeTypes = { wf: FlowNodeView };

const toFlow = (n: WfNode): FlowNode => ({ id: n.id, type: 'wf', position: { x: n.x, y: n.y }, data: { ...n } });
const edgeStyle = { markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#526077' }, style: { stroke: '#8794a8', strokeWidth: 1.5 } };
/** Leave from the side that faces the target: right/left for a node beside it, bottom/top for one above or below. */
const handlesFor = (a: WfNode, b: WfNode) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? { sourceHandle: 's-r', targetHandle: 't-l' } : { sourceHandle: 's-l', targetHandle: 't-r' };
  return dy > 0 ? { sourceHandle: 's-b', targetHandle: 't-t' } : { sourceHandle: 's-t', targetHandle: 't-b' };
};
const toEdges = (v: WorkflowVersion): Edge[] => v.edges.map((e: WfEdge, i) => {
  const a = v.nodes.find((n) => n.id === e.from)!, b = v.nodes.find((n) => n.id === e.to)!;
  return { id: `e${i}`, source: e.from, target: e.to, label: e.label, type: 'smoothstep', ...handlesFor(a, b), ...e.route, ...edgeStyle };
});

function Builder({ wf, v }: { wf: Workflow; v: WorkflowVersion }) {
  const { message } = App.useApp();
  const rf = useReactFlow();
  const nav = useNavigate();
  const isLatest = v.version === latest(wf).version;
  const [readOnly, setReadOnly] = useState(!isLatest);
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(v.nodes.map(toFlow));
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(toEdges(v));
  const [selId, setSelId] = useState<string | null>(v.nodes.find((n) => n.maxLoops)?.id ?? null);
  const [problems, setProblems] = useState<string[] | null>(null);
  const [json, setJson] = useState(false);
  const [dirty, setDirty] = useState(false);
  const sel = nodes.find((n) => n.id === selId);
  const runs = jobs.filter((j) => j.workflowId === wf.id && j.workflowVersion === v.version).length;
  const usedBy = projects.filter((p) => p.defaultWorkflow === wf.id);
  const nextVersion = latest(wf).version + 1;

  const onConnect = useCallback((c: Connection) => { setEdges((es) => addEdge({ ...c, type: 'smoothstep', ...edgeStyle }, es)); setDirty(true); }, [setEdges]);

  const add = (type: NodeType, pos?: { x: number; y: number }) => {
    if (readOnly) return;
    const id = `${type}_${Math.random().toString(36).slice(2, 6)}`;
    const k = kindOf(type);
    const p = pos ?? { x: 660, y: 40 + nodes.length * 8 };
    setNodes((ns) => [...ns, toFlow({ id, type, label: k.label, x: p.x, y: p.y, ...(type === 'agent' ? { agent: '' } : {}), ...(type === 'approval' ? { approver: 'project' } : {}), ...(type === 'condition' ? { expr: '' } : {}) })]);
    setSelId(id); setDirty(true);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/wf-node') as NodeType;
    if (type) add(type, rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
  };
  const update = (patch: Partial<WfNode>) => { setNodes((ns) => ns.map((n) => (n.id === selId ? { ...n, data: { ...n.data, ...patch } } : n))); setDirty(true); };
  const remove = () => { setNodes((ns) => ns.filter((n) => n.id !== selId)); setEdges((es) => es.filter((e) => e.source !== selId && e.target !== selId)); setSelId(null); setDirty(true); };

  const definition = useMemo(() => ({
    id: wf.id, name: wf.name.en, version: dirty ? nextVersion : v.version,
    nodes: nodes.map((n) => { const { x: _x, y: _y, ...rest } = n.data; void _x; void _y; return { ...rest, position: { x: Math.round(n.position.x), y: Math.round(n.position.y) } }; }),
    edges: edges.map((e) => ({ from: e.source, to: e.target, ...(e.label ? { label: e.label } : {}) })),
  }), [nodes, edges, dirty, wf, v, nextVersion]);

  const validate = () => {
    const out: string[] = [];
    const starts = nodes.filter((n) => n.data.type === 'start'), ends = nodes.filter((n) => n.data.type === 'end');
    if (starts.length !== 1) out.push(tr(`Cần đúng 1 node Start (đang có ${starts.length}).`, `Needs exactly one Start node (has ${starts.length}).`));
    if (!ends.length) out.push(tr('Thiếu node End.', 'Missing an End node.'));
    const reach = new Set<string>(); const stack = starts.map((s) => s.id);
    while (stack.length) { const id = stack.pop()!; if (reach.has(id)) continue; reach.add(id); edges.filter((e) => e.source === id).forEach((e) => stack.push(e.target)); }
    nodes.filter((n) => !reach.has(n.id)).forEach((n) => out.push(tr(`"${n.data.label}" không đi tới được từ Start.`, `"${n.data.label}" cannot be reached from Start.`)));
    nodes.filter((n) => n.data.type === 'agent' && !n.data.agent).forEach((n) => out.push(tr(`"${n.data.label}" chưa chọn agent.`, `"${n.data.label}" has no agent.`)));
    nodes.filter((n) => n.data.type === 'condition').forEach((n) => { const outs = edges.filter((e) => e.source === n.id); if (outs.length < 2) out.push(tr(`"${n.data.label}" cần 2 nhánh ra (đang có ${outs.length}).`, `"${n.data.label}" needs 2 outgoing branches (has ${outs.length}).`)); if (!n.data.expr) out.push(tr(`"${n.data.label}" chưa có điều kiện.`, `"${n.data.label}" has no condition.`)); });
    // a cycle must pass through a node with a loop limit
    const loopNodes = nodes.filter((n) => n.data.maxLoops).map((n) => n.id);
    const cyclic = edges.some((e) => { const seen = new Set<string>(); const st = [e.target]; while (st.length) { const id = st.pop()!; if (id === e.source) return !loopNodes.some((l) => seen.has(l) || l === e.source || l === e.target); if (seen.has(id)) continue; seen.add(id); edges.filter((x) => x.source === id).forEach((x) => st.push(x.target)); } return false; });
    if (cyclic) out.push(tr('Có vòng lặp không đi qua node nào giới hạn số vòng.', 'A loop does not pass through any node with a round limit.'));
    setProblems(out);
    if (!out.length) message.success(tr('Workflow hợp lệ', 'Workflow is valid'));
    return out.length === 0;
  };

  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb"><Link to="/workflows">Workflows</Link><Icon name="chevron" size={12} /><span>{tx(wf.name)}</span></nav>
      <div className="title-row">
        <div>
          <h1>{tx(wf.name)} <span className="pill">{dirty ? tr(`v${nextVersion} nháp`, `v${nextVersion} draft`) : `v${v.version}`}</span></h1>
          <p className="sub">
            {tr(`${nodes.length} node, ${edges.length} cạnh`, `${nodes.length} nodes, ${edges.length} edges`)} · {tr(`lưu ${isoDay(v.date)} bởi ${people[v.by].name}`, `saved ${isoDay(v.date)} by ${people[v.by].name}`)} · {tr(`${runs} job đã chạy bằng v${v.version}`, `${runs} jobs ran on v${v.version}`)} · {tr('mặc định cho', 'default for')} {usedBy.length ? usedBy.map((p) => p.name).join(', ') : '—'}
          </p>
        </div>
        <div className="title-actions">
          <Select value={v.version} onChange={(x) => nav(`/workflows/${wf.id}?v=${x}`)} style={{ width: 230 }} aria-label={tr('Phiên bản', 'Version')}
            options={[...wf.versions].reverse().map((x) => ({ value: x.version, label: `v${x.version} · ${isoDay(x.date)}${x.version === latest(wf).version ? tr(' · mới nhất', ' · latest') : ''}` }))} />
          <Button onClick={() => setJson(true)}>JSON</Button>
          <Button onClick={validate}>{tr('Kiểm tra', 'Validate')}</Button>
                    <Button type="primary" disabled={!dirty} onClick={() => { if (validate()) { setDirty(false); message.success(tr(`Đã lưu thành v${nextVersion}. Job đang chạy vẫn dùng bản cũ. (prototype)`, `Saved as v${nextVersion}. Running jobs keep their version. (prototype)`)); } }}>{tr(`Lưu thành v${nextVersion}`, `Save as v${nextVersion}`)}</Button>
        </div>
      </div>
      <p className="version-note"><strong>v{v.version}:</strong> {tx(v.note)}</p>
      {readOnly && (
        <Alert type="info" showIcon={false} className="readonly-note" message={<>
          {tr(`Đang xem v${v.version} (chỉ đọc). Job cũ chạy bằng phiên bản này vẫn hiển thị đúng flow của nó.`, `Viewing v${v.version} (read-only). Jobs that ran on it still show this flow.`)}{' '}
          <Button size="small" onClick={() => { setReadOnly(false); setDirty(true); }}>{tr(`Sửa từ bản này thành v${nextVersion}`, `Edit from this into v${nextVersion}`)}</Button>
        </>} />
      )}
      {problems && problems.length > 0 && (
        <div className="finding bad" role="alert"><strong>{tr(`${problems.length} lỗi cần sửa trước khi lưu:`, `${problems.length} problems to fix before saving:`)}</strong><ul>{problems.map((p) => <li key={p}>{p}</li>)}</ul></div>
      )}
      <div className={`builder${readOnly ? ' is-readonly' : ''}`}>
        <aside className="panel palette" aria-label={tr('Loại node', 'Node types')}>
          <h2 className="pane-h">Node</h2>
          <ul>
            {kinds().map((k) => (
              <li key={k.type}>
                <button className="palette-item" disabled={readOnly} draggable={!readOnly} onDragStart={(e) => e.dataTransfer.setData('application/wf-node', k.type)} onClick={() => add(k.type)} title={tr('Kéo vào canvas hoặc bấm để thêm', 'Drag onto the canvas or click to add')}>
                  <span className={`wf-code t-${k.type}`} aria-hidden="true">{k.code}</span>
                  <span><span className="ink">{k.label}</span><span className="line2">{k.hint}</span></span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <div className="canvas-wrap" onDrop={onDrop} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}>
          <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={(c) => { onNodesChange(c); if (c.some((x) => x.type === 'position' && x.dragging)) setDirty(true); }}
            onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeClick={(_, n) => setSelId(n.id)} onPaneClick={() => setSelId(null)}
            nodesDraggable={!readOnly} nodesConnectable={!readOnly} elementsSelectable
            fitView fitViewOptions={{ padding: 0.06 }} proOptions={{ hideAttribution: true }} deleteKeyCode={readOnly ? null : ['Delete']}>
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#d3dbe6" />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
        <aside className="panel props" aria-label={tr('Thuộc tính node', 'Node properties')}>
          {sel ? (
            <fieldset disabled={readOnly} className="props-fields">
              <h2 className="pane-h">{kindOf(sel.data.type).label}<span className="meta mono">{sel.id}</span></h2>
              <div className="field"><label htmlFor="p-label">{tr('Tên hiển thị', 'Label')}</label><Input id="p-label" value={sel.data.label} onChange={(e) => update({ label: e.target.value })} /></div>
              {sel.data.type === 'agent' && (<>
                <div className="field"><label htmlFor="p-agent">Agent</label><Select id="p-agent" disabled={readOnly} value={sel.data.agent || undefined} placeholder={tr('Chọn agent', 'Choose an agent')} onChange={(x) => update({ agent: x })} options={agents.map((a) => ({ value: a.id, label: a.name }))} /></div>
                <div className="field"><label htmlFor="p-loops">{tr('Giới hạn số vòng', 'Round limit')}</label><InputNumber id="p-loops" disabled={readOnly} min={0} max={10} value={sel.data.maxLoops ?? 0} onChange={(x) => update({ maxLoops: x ?? 0 })} style={{ width: '100%' }} /><span className="hint">{tr('0 là không lặp. Node nằm trong vòng lặp phải có giới hạn.', '0 means no loop. A node inside a loop needs a limit.')}</span></div>
              </>)}
              {sel.data.type === 'condition' && <div className="field"><label htmlFor="p-expr">{tr('Điều kiện', 'Condition')}</label><Input id="p-expr" className="mono" value={sel.data.expr} onChange={(e) => update({ expr: e.target.value })} placeholder="exit_code == 0" /><span className="hint">{tr('Nhãn nhánh ra: "Đạt" và "Lỗi".', 'Label the branches "Pass" and "Fail".')}</span></div>}
              {(sel.data.type === 'test' || sel.data.type === 'command' || sel.data.type === 'git') && <div className="field"><label htmlFor="p-cmd">{tr('Lệnh', 'Command')}</label><Input id="p-cmd" className="mono" value={sel.data.command} onChange={(e) => update({ command: e.target.value })} /><span className="hint">{tr('{project.build} và {project.test} lấy từ cấu hình project.', '{project.build} and {project.test} come from the project settings.')}</span></div>}
              {sel.data.type === 'approval' && <div className="field"><label htmlFor="p-appr">{tr('Người duyệt', 'Approver')}</label><Segmented id="p-appr" disabled={readOnly} value={sel.data.approver} onChange={(x) => update({ approver: String(x) })} options={[{ value: 'project', label: approverLabel('project') }, { value: 'admin', label: 'Admin' }]} /><span className="hint">{tr('Thành viên của project: ai được cấp quyền vào project của job đều duyệt được.', 'Project members: anyone with access to the job’s project can approve.')}</span></div>}
              {sel.data.type === 'delay' && <div className="field"><label htmlFor="p-delay">{tr('Chờ (phút)', 'Wait (minutes)')}</label><InputNumber id="p-delay" min={1} value={sel.data.delayMin ?? 5} onChange={(x) => update({ delayMin: x ?? 5 })} style={{ width: '100%' }} /></div>}
              <div className="field"><span className="label-like">{tr('Kết nối', 'Connections')}</span>
                <ul className="conn">
                  {edges.filter((e) => e.target === sel.id).map((e) => <li key={e.id}>{tr('Từ', 'From')} {nodes.find((n) => n.id === e.source)?.data.label}</li>)}
                  {edges.filter((e) => e.source === sel.id).map((e) => <li key={e.id}>{tr('Tới', 'To')} {nodes.find((n) => n.id === e.target)?.data.label}{e.label ? ` (${e.label})` : ''}</li>)}
                </ul>
              </div>
              {sel.data.type !== 'start' && !readOnly && <Button danger onClick={remove}>{tr('Xóa node', 'Delete node')}</Button>}
            </fieldset>
          ) : <p className="note">{tr('Chọn một node để xem thuộc tính. Kéo từ chấm ở cạnh node sang node khác để nối.', 'Select a node to see its properties. Drag from a dot on its edge to another node to connect.')}</p>}
        </aside>
      </div>
      <Modal open={json} onCancel={() => setJson(false)} footer={null} title={tr('Định nghĩa workflow (JSON)', 'Workflow definition (JSON)')} width={720}>
        <pre className="code-block">{JSON.stringify(definition, null, 2)}</pre>
      </Modal>
    </>
  );
}

export function WorkflowBuilder() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const wf = workflowById[id];
  useTitle(wf ? tx(wf.name) : 'Workflow');
  if (!wf) return <div className="title-row"><div><h1>{tr('Không tìm thấy workflow', 'Workflow not found')}</h1><p className="sub"><Link to="/workflows">{tr('Về danh sách', 'Back to workflows')}</Link></p></div></div>;
  const want = Number(params.get('v'));
  const v = wf.versions.find((x) => x.version === want) ?? latest(wf);
  // key: a new version or workflow starts a fresh canvas
  return <ReactFlowProvider key={`${wf.id}@${v.version}`}><Builder wf={wf} v={v} /></ReactFlowProvider>;
}
