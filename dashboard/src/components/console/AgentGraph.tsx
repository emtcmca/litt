import { useEffect, useRef, useState } from 'react';
import type { AgentObservation } from '../../types';

// ─── Node layout constants ────────────────────────────────────────────────────

const W = 760;
const H = 480;

// Source signal nodes (row 1)
const SIGNAL_NODES = [
  { id: 'gmail',    label: 'Gmail',          x: 80,  y: 50  },
  { id: 'calendar', label: 'Calendar',        x: 230, y: 50  },
  { id: 'matter',  label: 'Matter store',    x: 390, y: 50  },
  { id: 'billing', label: 'Time & billing',  x: 560, y: 50  },
];

// Coordinator node (row 2 center)
const COORD_NODE = { id: 'coordinator', label: 'Coordinator', x: 320, y: 170 };

// Sub-agent nodes (row 3)
const AGENT_NODES = [
  { id: 'deadline_agent', label: 'Deadline Monitor',      x: 60,  y: 295, sources: ['calendar', 'matter']  },
  { id: 'billing_agent',  label: 'Billing Reconciliation', x: 225, y: 295, sources: ['billing']             },
  { id: 'comms_agent',    label: 'Client Comms',          x: 420, y: 295, sources: ['matter', 'gmail']     },
  { id: 'anomaly_agent',  label: 'Anomaly Escalation',    x: 595, y: 295, sources: ['billing', 'matter']   },
];

// Output nodes (row 4)
const OUTPUT_NODES = [
  { id: 'audit', label: 'Audit log',  x: 200, y: 420 },
  { id: 'brief', label: 'Your Brief', x: 460, y: 420 },
];

type NodeId = string;

// ─── Color helpers ────────────────────────────────────────────────────────────

const AGENT_TO_NODE: Record<string, string> = {
  coordinator: 'coordinator',
  deadline_agent: 'deadline_agent',
  billing_agent: 'billing_agent',
  comms_agent: 'comms_agent',
  anomaly_agent: 'anomaly_agent',
};

function nodeColor(nodeId: string, activeNodes: Set<NodeId>, selectedNode: string | null): string {
  if (selectedNode === nodeId) return '#1D9E75';
  if (activeNodes.has(nodeId)) return '#5DCAA5';
  return '#253832';
}

function nodeBorder(nodeId: string, activeNodes: Set<NodeId>, selectedNode: string | null): string {
  if (selectedNode === nodeId) return '#1D9E75';
  if (activeNodes.has(nodeId)) return '#5DCAA5';
  if (['gmail', 'calendar', 'matter', 'billing'].includes(nodeId)) return 'rgba(158,225,199,.2)';
  if (['audit', 'brief'].includes(nodeId)) return 'rgba(158,225,199,.2)';
  return 'rgba(93,202,165,.35)';
}

// ─── SVG edge helpers ─────────────────────────────────────────────────────────

function midY(y1: number, y2: number): number {
  return (y1 + y2) / 2;
}

function edgePath(x1: number, y1: number, x2: number, y2: number): string {
  const my = midY(y1, y2);
  return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
}

// ─── AgentGraph ───────────────────────────────────────────────────────────────

interface AgentGraphProps {
  observations: AgentObservation[];
  playbackIndex: number;
  selectedNode: string | null;
  onSelectNode: (id: string | null) => void;
}

export function AgentGraph({ observations, playbackIndex, selectedNode, onSelectNode }: AgentGraphProps) {
  const [heartbeatIdx, setHeartbeatIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRunning = playbackIndex > 0 && playbackIndex < observations.length;

  // Derive active nodes from observations up to playbackIndex
  const visible = observations.slice(0, playbackIndex + 1);
  const activeNodes = new Set<NodeId>();
  const handoffPairs = new Set<string>(); // "from→to"

  visible.forEach(obs => {
    const agentNode = AGENT_TO_NODE[obs.agent_name];
    if (agentNode) activeNodes.add(agentNode);
    if (obs.observation_type === 'TOOL_CALL') {
      activeNodes.add('audit');
    }
    if (obs.observation_type === 'RESULT') {
      activeNodes.add('brief');
    }
    if (obs.observation_type === 'ROUTE_HANDOFF') {
      const h = obs.data?.handoff as Record<string, string> | undefined;
      if (h?.from && h?.to) handoffPairs.add(`${h.from}→${h.to}`);
    }
    // Light up source nodes when agent reads
    const agentDef = AGENT_NODES.find(a => a.id === obs.agent_name);
    if (agentDef && obs.observation_type === 'SIGNAL_RECEIVED') {
      agentDef.sources.forEach(s => activeNodes.add(s));
    }
  });

  // Idle heartbeat
  useEffect(() => {
    if (isRunning) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setHeartbeatIdx(i => (i + 1) % (AGENT_NODES.length + 2));
    }, 900);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRunning]);

  function idleHighlight(id: string): boolean {
    if (isRunning || observations.length > 0) return false;
    const order = [COORD_NODE.id, ...AGENT_NODES.map(a => a.id), 'audit', 'brief'];
    return order[heartbeatIdx % order.length] === id;
  }

  function getBg(id: string): string {
    if (idleHighlight(id)) return 'rgba(93,202,165,.15)';
    return nodeColor(id, activeNodes, selectedNode);
  }

  function getBorder(id: string): string {
    if (idleHighlight(id)) return '#5DCAA5';
    return nodeBorder(id, activeNodes, selectedNode);
  }

  const nodeStyle = (id: string, w = 100, h = 32): React.CSSProperties => ({
    position: 'absolute',
    background: getBg(id),
    border: `1.5px solid ${getBorder(id)}`,
    borderRadius: 6,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 500,
    color: activeNodes.has(id) || selectedNode === id ? '#9FE1CB' : 'rgba(158,225,199,.65)',
    cursor: 'pointer',
    transition: 'background 0.25s, border-color 0.25s, color 0.25s',
    textAlign: 'center', lineHeight: 1.2,
    padding: '0 4px',
    width: w, height: h,
    userSelect: 'none',
    zIndex: 2,
  });

  function cx(x: number, w: number): number { return x - w / 2; }

  return (
    <div style={{ position: 'relative', width: W, height: H, flexShrink: 0 }}>
      {/* SVG edges */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}
      >
        {/* Signal nodes → Coordinator */}
        {SIGNAL_NODES.map(sn => (
          <path
            key={`sig-coord-${sn.id}`}
            d={edgePath(sn.x, sn.y + 16, COORD_NODE.x, COORD_NODE.y - 16)}
            stroke={activeNodes.has(sn.id) ? 'rgba(93,202,165,.55)' : 'rgba(93,202,165,.15)'}
            strokeWidth={1.5} fill="none"
          />
        ))}

        {/* Coordinator → sub-agents */}
        {AGENT_NODES.map(an => (
          <path
            key={`coord-agent-${an.id}`}
            d={edgePath(COORD_NODE.x, COORD_NODE.y + 18, an.x, an.y - 16)}
            stroke={activeNodes.has(an.id) ? 'rgba(93,202,165,.6)' : 'rgba(93,202,165,.2)'}
            strokeWidth={1.5} fill="none"
          />
        ))}

        {/* Sub-agents → Audit */}
        {AGENT_NODES.map(an => (
          <path
            key={`agent-audit-${an.id}`}
            d={edgePath(an.x, an.y + 16, OUTPUT_NODES[0].x, OUTPUT_NODES[0].y - 16)}
            stroke={activeNodes.has('audit') ? 'rgba(93,202,165,.4)' : 'rgba(93,202,165,.1)'}
            strokeWidth={1} fill="none" strokeDasharray="4 3"
          />
        ))}

        {/* Coordinator → Brief */}
        <path
          d={edgePath(COORD_NODE.x + 60, COORD_NODE.y + 10, OUTPUT_NODES[1].x, OUTPUT_NODES[1].y - 16)}
          stroke={activeNodes.has('brief') ? 'rgba(93,202,165,.6)' : 'rgba(93,202,165,.15)'}
          strokeWidth={1.5} fill="none"
        />

        {/* Gmail ↔ Comms (teal dashed, two-way) */}
        <path
          d={`M ${SIGNAL_NODES[0].x} ${SIGNAL_NODES[0].y + 16} L ${AGENT_NODES[2].x} ${AGENT_NODES[2].y - 16}`}
          stroke="rgba(93,202,165,.35)" strokeWidth={1.5} fill="none" strokeDasharray="5 3"
        />

        {/* ROUTE_HANDOFF edges — gold dashed */}
        {[...handoffPairs].map(pair => {
          const [from, to] = pair.split('→');
          const fn = AGENT_NODES.find(a => a.id === from);
          const tn = AGENT_NODES.find(a => a.id === to);
          if (!fn || !tn) return null;
          return (
            <path
              key={`handoff-${pair}`}
              d={`M ${fn.x} ${fn.y} L ${tn.x} ${tn.y}`}
              stroke="#A98435" strokeWidth={2} fill="none" strokeDasharray="6 3"
            />
          );
        })}
      </svg>

      {/* Signal source nodes */}
      {SIGNAL_NODES.map(sn => (
        <div
          key={sn.id}
          style={{ ...nodeStyle(sn.id, 106, 30), top: sn.y - 15, left: cx(sn.x, 106) }}
          onClick={() => onSelectNode(selectedNode === sn.id ? null : sn.id)}
        >
          {sn.label}
        </div>
      ))}

      {/* "Signals in" label */}
      <div style={{ position: 'absolute', top: 12, left: 0, fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(158,225,199,.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Signals in
      </div>

      {/* Coordinator node */}
      <div
        style={{
          ...nodeStyle(COORD_NODE.id, 130, 38),
          top: COORD_NODE.y - 19, left: cx(COORD_NODE.x, 130),
          fontWeight: 700, fontSize: 11,
          border: `2px solid ${getBorder(COORD_NODE.id)}`,
        }}
        onClick={() => onSelectNode(selectedNode === COORD_NODE.id ? null : COORD_NODE.id)}
      >
        Coordinator
      </div>

      {/* Sub-agent nodes */}
      {AGENT_NODES.map(an => (
        <div
          key={an.id}
          style={{ ...nodeStyle(an.id, 120, 36), top: an.y - 18, left: cx(an.x, 120) }}
          onClick={() => onSelectNode(selectedNode === an.id ? null : an.id)}
        >
          {an.label}
        </div>
      ))}

      {/* Output nodes */}
      {OUTPUT_NODES.map(on => (
        <div
          key={on.id}
          style={{
            ...nodeStyle(on.id, 100, 30),
            top: on.y - 15, left: cx(on.x, 100),
            background: activeNodes.has(on.id) ? 'rgba(29,158,117,.15)' : '#14221F',
            border: `1px solid ${activeNodes.has(on.id) ? 'rgba(29,158,117,.5)' : 'rgba(158,225,199,.12)'}`,
          }}
          onClick={() => onSelectNode(selectedNode === on.id ? null : on.id)}
        >
          {on.label}
        </div>
      ))}

      {/* "On the record" label */}
      <div style={{ position: 'absolute', top: OUTPUT_NODES[0].y + 20, left: 0, fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(158,225,199,.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        On the record
      </div>

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 6, right: 0,
        display: 'flex', gap: 10,
        fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(158,225,199,.45)',
      }}>
        <span style={{ borderBottom: '1.5px dashed #A98435', paddingBottom: 1 }}>handoff</span>
        <span style={{ borderBottom: '1.5px dashed rgba(93,202,165,.5)', paddingBottom: 1 }}>inbox channel</span>
      </div>
    </div>
  );
}
