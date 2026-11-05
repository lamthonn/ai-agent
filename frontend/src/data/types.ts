export type StepId = 'analyze' | 'plan' | 'approve_plan' | 'code' | 'build_test' | 'fix' | 'review' | 'approve_merge' | 'end';
export type StepState = 'done' | 'running' | 'waiting' | 'failed' | 'pending' | 'skipped';
export type JobStatus = 'queued' | 'running' | 'approval' | 'succeeded' | 'failed' | 'cancelled';

export interface Person { id: string; name: string; short: string; hue: number; role: string }
export interface Project { id: string; name: string; repo: string; branch: string; stack: string; build: string; test: string; owner: string }
export interface Agent { id: string; name: string; role: string; model: string; perm: 'read' | 'write' | 'test'; tools: string[]; maxTurns: number; prompt: string }

export type NodeType = 'start' | 'agent' | 'condition' | 'command' | 'git' | 'test' | 'approval' | 'delay' | 'end';
export interface WfNode { id: string; type: NodeType; label: string; x: number; y: number; agent?: string; command?: string; expr?: string; approver?: string; maxLoops?: number; delayMin?: number }
export interface WfEdge { from: string; to: string; label?: string }
export interface Workflow { id: string; name: string; version: number; updated: string; updatedBy: string; nodes: WfNode[]; edges: WfEdge[] }

export interface TraceStep { step: StepId; state: StepState; min: number; rounds?: number }
export interface Job {
  id: string; title: string; project: string; by: string; status: JobStatus; start: Date; end: Date | null;
  trace: TraceStep[]; fix: number; minutes: number; tokens: number; cost: number; branch: string; workflow: string;
  approval?: 'plan' | 'merge'; waitingSince?: Date; note?: string;
}
export interface Worker { id: string; image: string; state: 'busy' | 'idle' | 'maintenance'; job: string | null; cpu: number; mem: number; memMax: number; note?: string }
export interface Approval { id: string; job: string; kind: 'plan' | 'merge'; requested: Date; status: 'pending' | 'approved' | 'rejected'; by?: string; decided?: Date }
