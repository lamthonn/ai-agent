// Workflow builder (React Flow). Question: "Is this flow valid, and what does each node do?"
// Palette on the left (drag or click), canvas in the middle, the selected node's properties on the right.
import { useCallback, useMemo, useState, type DragEvent } from 'react';
import { App, Button, Input, InputNumber, Modal, Segmented, Select } from 'antd';
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, Handle, MarkerType, Position, addEdge, useEdgesState, useNodesState, useReactFlow,
  type Connection, type Edge, type Node, type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { agents, jobs, people, workflow } from '../data/sample';
import type { NodeType, WfNode } from '../data/types';
import { useTitle } from '../lib/useTitle';

const kinds: { type: NodeType; label: string; hint: string; code: string }[] = [
  { type: 'start', label: 'Start', hint: 'Bắt đầu workflow', code: 'S' },
  { type: 'agent', label: 'Agent', hint: 'Gọi một AI agent', code: 'A' },
  { type: 'condition', label: 'Condition', hint: 'Rẽ nhánh theo điều kiện', code: '?' },
  { type: 'command', label: 'Command', hint: 'Chạy một lệnh', code: '$' },
  { type: 'git', label: 'Git', hint: 'Clone, checkout, commit', code: 'G' },
  { type: 'test', label: 'Test', hint: 'Chạy build và test', code: 'T' },
  { type: 'approval', label: 'Approval', hint: 'Chờ người duyệt', code: 'D' },
  { type: 'delay', label: 'Delay', hint: 'Chờ một khoảng thời gian', code: 'W' },
  { type: 'end', label: 'End', hint: 'Kết thúc workflow', code: 'E' },
];
const kindOf = (t: NodeType) => kinds.find((k) => k.type === t)!;

type FlowNode = Node<WfNode & Record<string, unknown>>;

function FlowNodeView({ data, selected }: NodeProps<FlowNode>) {
  const k = kindOf(data.type);
  const sub = data.type === 'agent' ? agents.find((a) => a.id === data.agent)?.name ?? 'Chưa chọn agent'
    : data.type === 'condition' ? data.expr : data.type === 'test' || data.type === 'command' ? data.command
    : data.type === 'approval' ? `Người duyệt: ${data.approver}` : k.hint;
  return (
    <div className={`wf-node t-${data.type}${selected ? ' selected' : ''}`}>
      {data.type !== 'start' && sides.map((s) => <Handle key={`t-${s.id}`} id={`t-${s.id}`} type="target" position={s.pos} />)}
      <span className="wf-code" aria-hidden="true">{k.code}</span>
      <span className="wf-text"><span className="wf-label">{data.label}</span><span className="wf-sub">{sub}{data.maxLoops ? ` · tối đa ${data.maxLoops} vòng` : ''}</span></span>
      {data.type !== 'end' && sides.map((s) => <Handle key={`s-${s.id}`} id={`s-${s.id}`} type="source" position={s.pos} />)}
    </div>
  );
}
const nodeTypes = { wf: FlowNodeView };
const sides = [{ id: 't', pos: Position.Top }, { id: 'r', pos: Position.Right }, { id: 'b', pos: Position.Bottom }, { id: 'l', pos: Position.Left }];

const toFlow = (n: WfNode): FlowNode => ({ id: n.id, type: 'wf', position: { x: n.x, y: n.y }, data: { ...n } });
const edgeStyle = { markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#5d5f60' }, style: { stroke: '#8a8d90', strokeWidth: 1.5 } };
/** Leave from the side that faces the target: right/left for a node beside it, bottom/top for one above or below. */
const handlesFor = (a: WfNode, b: WfNode) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? { sourceHandle: 's-r', targetHandle: 't-l' } : { sourceHandle: 's-l', targetHandle: 't-r' };
  return dy > 0 ? { sourceHandle: 's-b', targetHandle: 't-t' } : { sourceHandle: 's-t', targetHandle: 't-b' };
};
const wfNode = (id: string) => workflow.nodes.find((n) => n.id === id)!;
// The two loop-back edges are routed by hand so they never run under another node.
const edgeRoutes: Record<string, { sourceHandle: string; targetHandle: string }> = {
  'fix>build_test': { sourceHandle: 's-t', targetHandle: 't-l' },
  'review_ok>fix': { sourceHandle: 's-b', targetHandle: 't-b' },
};

function Builder() {
  const { message } = App.useApp();
  const rf = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(workflow.nodes.map(toFlow));
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(workflow.edges.map((e, i) => ({ id: `e${i}`, source: e.from, target: e.to, label: e.label, type: 'smoothstep', ...handlesFor(wfNode(e.from), wfNode(e.to)), ...edgeRoutes[`${e.from}>${e.to}`], ...edgeStyle })));
  const [selId, setSelId] = useState<string | null>('fix');
  const [problems, setProblems] = useState<string[] | null>(null);
  const [json, setJson] = useState(false);
  const [dirty, setDirty] = useState(false);
  const sel = nodes.find((n) => n.id === selId);

  const onConnect = useCallback((c: Connection) => { setEdges((es) => addEdge({ ...c, type: 'smoothstep', ...edgeStyle }, es)); setDirty(true); }, [setEdges]);

  const add = (type: NodeType, pos?: { x: number; y: number }) => {
    const id = `${type}_${Math.random().toString(36).slice(2, 6)}`;
    const k = kindOf(type);
    const p = pos ?? { x: 660, y: 40 + nodes.length * 8 };
    setNodes((ns) => [...ns, toFlow({ id, type, label: k.label, x: p.x, y: p.y, ...(type === 'agent' ? { agent: '' } : {}), ...(type === 'approval' ? { approver: 'Tech lead' } : {}), ...(type === 'condition' ? { expr: '' } : {}) })]);
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
    name: workflow.name, version: workflow.version + (dirty ? 1 : 0),
    nodes: nodes.map((n) => { const { x: _x, y: _y, ...rest } = n.data; void _x; void _y; return { ...rest, position: { x: Math.round(n.position.x), y: Math.round(n.position.y) } }; }),
    edges: edges.map((e) => ({ from: e.source, to: e.target, ...(e.label ? { label: e.label } : {}) })),
  }), [nodes, edges, dirty]);

  const validate = () => {
    const out: string[] = [];
    const starts = nodes.filter((n) => n.data.type === 'start'), ends = nodes.filter((n) => n.data.type === 'end');
    if (starts.length !== 1) out.push(`Cần đúng 1 node Start (đang có ${starts.length}).`);
    if (!ends.length) out.push('Thiếu node End.');
    const reach = new Set<string>(); const stack = starts.map((s) => s.id);
    while (stack.length) { const id = stack.pop()!; if (reach.has(id)) continue; reach.add(id); edges.filter((e) => e.source === id).forEach((e) => stack.push(e.target)); }
    nodes.filter((n) => !reach.has(n.id)).forEach((n) => out.push(`"${n.data.label}" không đi tới được từ Start.`));
    nodes.filter((n) => n.data.type === 'agent' && !n.data.agent).forEach((n) => out.push(`"${n.data.label}" chưa chọn agent.`));
    nodes.filter((n) => n.data.type === 'condition').forEach((n) => { const outs = edges.filter((e) => e.source === n.id); if (outs.length < 2) out.push(`"${n.data.label}" cần 2 nhánh ra (đang có ${outs.length}).`); if (!n.data.expr) out.push(`"${n.data.label}" chưa có điều kiện.`); });
    // a cycle must pass through a node with a loop limit
    const loopNodes = nodes.filter((n) => n.data.maxLoops).map((n) => n.id);
    const cyclic = edges.some((e) => { const seen = new Set<string>(); const st = [e.target]; while (st.length) { const id = st.pop()!; if (id === e.source) return !loopNodes.some((l) => seen.has(l) || l === e.source || l === e.target); if (seen.has(id)) continue; seen.add(id); edges.filter((x) => x.source === id).forEach((x) => st.push(x.target)); } return false; });
    if (cyclic) out.push('Có vòng lặp không đi qua node nào giới hạn số vòng.');
    setProblems(out);
    if (!out.length) message.success('Workflow hợp lệ');
  };

  return (
    <>
      <div className="title-row">
        <div>
          <h1>{workflow.name} <span className="pill">v{definition.version}{dirty ? ' (nháp)' : ''}</span></h1>
          <p className="sub">{nodes.length} node, {edges.length} cạnh · sửa lần cuối {workflow.updated} bởi {people[workflow.updatedBy].name} · {jobs.length} job đã chạy bằng v{workflow.version}</p>
        </div>
        <div className="title-actions">
          <Button onClick={() => setJson(true)}>Xem JSON</Button>
          <Button onClick={validate}>Kiểm tra</Button>
          <Button onClick={() => message.info('Chạy thử trên repo mẫu (prototype)')}>Chạy thử</Button>
          <Button type="primary" disabled={!dirty} onClick={() => { validate(); setDirty(false); message.success(`Đã lưu thành v${workflow.version + 1} (prototype)`); }}>Lưu phiên bản mới</Button>
        </div>
      </div>
      {problems && problems.length > 0 && (
        <div className="finding bad" role="alert"><strong>{problems.length} lỗi cần sửa trước khi lưu:</strong><ul>{problems.map((p) => <li key={p}>{p}</li>)}</ul></div>
      )}
      <div className="builder">
        <aside className="panel palette" aria-label="Loại node">
          <h2 className="pane-h">Node</h2>
          <ul>
            {kinds.map((k) => (
              <li key={k.type}>
                <button className="palette-item" draggable onDragStart={(e) => e.dataTransfer.setData('application/wf-node', k.type)} onClick={() => add(k.type)} title="Kéo vào canvas hoặc bấm để thêm">
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
            fitView fitViewOptions={{ padding: 0.06 }} proOptions={{ hideAttribution: true }} deleteKeyCode={['Delete']}>
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#d5d8db" />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
        <aside className="panel props" aria-label="Thuộc tính node">
          {sel ? (
            <>
              <h2 className="pane-h">{kindOf(sel.data.type).label}<span className="meta mono">{sel.id}</span></h2>
              <div className="field"><label htmlFor="p-label">Tên hiển thị</label><Input id="p-label" value={sel.data.label} onChange={(e) => update({ label: e.target.value })} /></div>
              {sel.data.type === 'agent' && (<>
                <div className="field"><label htmlFor="p-agent">Agent</label><Select id="p-agent" value={sel.data.agent || undefined} placeholder="Chọn agent" onChange={(v) => update({ agent: v })} options={agents.map((a) => ({ value: a.id, label: a.name }))} /></div>
                <div className="field"><label htmlFor="p-loops">Giới hạn số vòng</label><InputNumber id="p-loops" min={0} max={10} value={sel.data.maxLoops ?? 0} onChange={(v) => update({ maxLoops: v ?? 0 })} style={{ width: '100%' }} /><span className="hint">0 là không lặp. Node nằm trong vòng lặp phải có giới hạn.</span></div>
              </>)}
              {sel.data.type === 'condition' && <div className="field"><label htmlFor="p-expr">Điều kiện</label><Input id="p-expr" className="mono" value={sel.data.expr} onChange={(e) => update({ expr: e.target.value })} placeholder='exit_code == 0' /><span className="hint">Nhánh ra đặt nhãn "Đạt" và "Lỗi".</span></div>}
              {(sel.data.type === 'test' || sel.data.type === 'command') && <div className="field"><label htmlFor="p-cmd">Lệnh</label><Input id="p-cmd" className="mono" value={sel.data.command} onChange={(e) => update({ command: e.target.value })} /><span className="hint">{'{project.build}'} và {'{project.test}'} lấy từ cấu hình project.</span></div>}
              {sel.data.type === 'approval' && <div className="field"><label htmlFor="p-appr">Người duyệt</label><Segmented id="p-appr" value={sel.data.approver} onChange={(v) => update({ approver: String(v) })} options={['Tech lead', 'Người tạo job']} /></div>}
              {sel.data.type === 'delay' && <div className="field"><label htmlFor="p-delay">Chờ (phút)</label><InputNumber id="p-delay" min={1} value={sel.data.delayMin ?? 5} onChange={(v) => update({ delayMin: v ?? 5 })} style={{ width: '100%' }} /></div>}
              <div className="field"><span className="label-like">Kết nối</span>
                <ul className="conn">
                  {edges.filter((e) => e.target === sel.id).map((e) => <li key={e.id}>Từ {nodes.find((n) => n.id === e.source)?.data.label}</li>)}
                  {edges.filter((e) => e.source === sel.id).map((e) => <li key={e.id}>Tới {nodes.find((n) => n.id === e.target)?.data.label}{e.label ? ` (${e.label})` : ''}</li>)}
                </ul>
              </div>
              {sel.data.type !== 'start' && <Button danger onClick={remove}>Xóa node</Button>}
            </>
          ) : <p className="note">Chọn một node để sửa thuộc tính. Kéo từ chấm dưới node này sang node khác để nối.</p>}
        </aside>
      </div>
      <Modal open={json} onCancel={() => setJson(false)} footer={null} title="Định nghĩa workflow (JSON)" width={720}>
        <pre className="code-block">{JSON.stringify(definition, null, 2)}</pre>
      </Modal>
    </>
  );
}

export function WorkflowBuilder() {
  useTitle('Workflow');
  return <ReactFlowProvider><Builder /></ReactFlowProvider>;
}
