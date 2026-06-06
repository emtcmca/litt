import { useState } from 'react';
import type { AgentObservation } from '../../types';
import { ToolChip } from './ToolChip';

// ─── Tool registry entry shape (matches GET /api/tools) ──────────────────────

export interface ToolEntry {
  name: string;
  agent: string;
  kind: string;
  description: string;
  write_collection: string | null;
  audit_tier: string;
  tags: string[];
}

// ─── Boundary stat across a run ──────────────────────────────────────────────

function BoundaryStat({ observations }: { observations: AgentObservation[] }) {
  const toolCalls = observations.filter(o => o.observation_type === 'TOOL_CALL');
  const det = toolCalls.filter(o => (o.data?.tool as Record<string, string> | undefined)?.kind !== 'gemini').length;
  const llm = toolCalls.filter(o => (o.data?.tool as Record<string, string> | undefined)?.kind === 'gemini').length;

  return (
    <div style={{
      background: '#14221F', border: '1px solid rgba(158,225,199,.12)',
      borderRadius: 8, padding: '10px 14px',
    }}>
      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(158,225,199,.5)', marginBottom: 8 }}>
        Deterministic / Probabilistic boundary
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#1D9E75' }}>{det}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)' }}>deterministic</div>
        </div>
        <div style={{ width: 1, background: 'rgba(158,225,199,.1)' }} />
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-ramp-blue-400, #4A90D9)' }}>{llm}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)' }}>Gemini calls</div>
        </div>
        <div style={{ width: 1, background: 'rgba(158,225,199,.1)' }} />
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,.7)' }}>{toolCalls.length}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)' }}>total tool calls</div>
        </div>
      </div>
    </div>
  );
}

// ─── Tool call card ───────────────────────────────────────────────────────────

function ToolCallCard({ obs }: { obs: AgentObservation }) {
  const tool = obs.data?.tool as Record<string, string | null> | undefined;
  if (!tool) return null;

  return (
    <div style={{ background: 'var(--color-background-secondary)', borderRadius: 8, padding: '12px 14px', marginTop: 8 }}>
      <div style={{ marginBottom: 8 }}>
        <ToolChip name={tool.name ?? '?'} kind={tool.kind ?? 'unknown'} />
      </div>
      {tool.signature && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)', marginBottom: 2 }}>SIGNATURE</div>
          <code style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>{tool.signature}</code>
        </div>
      )}
      {tool.result && (
        <div>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)', marginBottom: 2 }}>RESULT</div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{tool.result}</div>
        </div>
      )}
    </div>
  );
}

// ─── Cross-agent handoff card ─────────────────────────────────────────────────

function HandoffCard({ obs }: { obs: AgentObservation }) {
  const h = obs.data?.handoff as Record<string, string> | undefined;
  if (!h) return null;

  return (
    <div style={{
      background: 'rgba(169,132,53,.06)', border: '1px solid rgba(169,132,53,.25)',
      borderRadius: 8, padding: '12px 14px', marginTop: 8,
    }}>
      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#A98435', marginBottom: 8 }}>
        Cross-agent hand-off
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{h.from}</span>
        <span style={{ color: '#A98435' }}>→</span>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)', fontWeight: 600 }}>{h.to}</span>
      </div>
      {h.entity_id && (
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)' }}>entity: {h.entity_id}</div>
      )}
      {h.reason && (
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>{h.reason}</div>
      )}
    </div>
  );
}

// ─── Node tool catalog ────────────────────────────────────────────────────────

function NodeTools({ agentName, tools }: { agentName: string; tools: ToolEntry[] }) {
  const agentTools = tools.filter(t => t.agent === agentName);
  const kindCounts = agentTools.reduce<Record<string, number>>((acc, t) => {
    acc[t.kind] = (acc[t.kind] ?? 0) + 1;
    return acc;
  }, {});

  if (agentTools.length === 0) return null;

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {Object.entries(kindCounts).map(([kind, n]) => (
          <ToolChip key={kind} name={`${n} ${kind}`} kind={kind} />
        ))}
      </div>
      <div style={{ display: 'grid', gap: 4 }}>
        {agentTools.map(t => (
          <div key={t.name} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)', minWidth: 0 }}>{t.name}</span>
            <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', lineHeight: 1.4, flex: 1 }}>{t.description.slice(0, 60)}{t.description.length > 60 ? '…' : ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Inspector ────────────────────────────────────────────────────────────────

type InspectorTab = 'log' | 'tools';

export interface InspectorProps {
  observations: AgentObservation[];
  selectedObs: AgentObservation | null;
  selectedAgent: string | null;
  tools: ToolEntry[];
  playbackIndex: number;
}

export function Inspector({
  observations,
  selectedObs,
  selectedAgent,
  tools,
  playbackIndex,
}: InspectorProps) {
  const [tab, setTab] = useState<InspectorTab>('log');
  const visible = observations.slice(0, playbackIndex + 1);

  const tabStyle = (active: boolean): React.CSSProperties => ({
    background: 'none', border: 'none', cursor: 'pointer',
    padding: '8px 12px 6px',
    fontSize: 12, fontWeight: active ? 600 : 400,
    color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
    borderBottom: active ? '2px solid #1D9E75' : '2px solid transparent',
  });

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      background: 'var(--color-background-primary)',
      border: '1px solid var(--color-border-tertiary)',
      borderRadius: 10, overflow: 'hidden', height: '100%',
    }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border-tertiary)', padding: '0 4px' }}>
        <button style={tabStyle(tab === 'log')}   onClick={() => setTab('log')}>Log</button>
        <button style={tabStyle(tab === 'tools')} onClick={() => setTab('tools')}>Tools</button>
        {selectedAgent && (
          <span style={{ marginLeft: 8, alignSelf: 'center', fontSize: 10, fontFamily: 'var(--font-mono)', color: '#1D9E75', fontWeight: 600 }}>
            {selectedAgent}
          </span>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
        {/* Boundary stat — always show on log tab when there are observations */}
        {tab === 'log' && visible.length > 0 && (
          <BoundaryStat observations={visible} />
        )}

        {/* Selected step detail */}
        {tab === 'log' && selectedObs && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-tertiary)', marginBottom: 4 }}>
              Selected step
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text-primary)', marginBottom: 4 }}>{selectedObs.description}</div>
            {selectedObs.observation_type === 'TOOL_CALL' && <ToolCallCard obs={selectedObs} />}
            {selectedObs.observation_type === 'ROUTE_HANDOFF' && <HandoffCard obs={selectedObs} />}
          </div>
        )}

        {/* Observation log */}
        {tab === 'log' && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-tertiary)', marginBottom: 6 }}>
              {visible.length} observations
            </div>
            <div style={{ display: 'grid', gap: 4 }}>
              {[...visible].reverse().map(obs => {
                const isSelected = selectedObs?.observation_id === obs.observation_id;
                return (
                  <div
                    key={obs.observation_id}
                    style={{
                      fontSize: 11, padding: '4px 8px', borderRadius: 4,
                      background: isSelected ? 'var(--color-background-tertiary)' : 'transparent',
                      border: isSelected ? '1px solid var(--color-border-secondary)' : '1px solid transparent',
                      color: 'var(--color-text-secondary)', lineHeight: 1.4,
                    }}
                  >
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-tertiary)', marginRight: 6 }}>
                      {obs.agent_name}
                    </span>
                    {obs.description.slice(0, 80)}{obs.description.length > 80 ? '…' : ''}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tool catalog */}
        {tab === 'tools' && (
          <div>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-tertiary)', marginBottom: 8 }}>
              Tool registry — {tools.length} tools
            </div>
            {selectedAgent ? (
              <NodeTools agentName={selectedAgent} tools={tools} />
            ) : (
              (['billing_agent', 'deadline_agent', 'comms_agent', 'anomaly_agent', 'coordinator'] as const).map(agent => {
                const agentTools = tools.filter(t => t.agent === agent);
                if (agentTools.length === 0) return null;
                return (
                  <div key={agent} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 6 }}>
                      {agent}
                    </div>
                    <NodeTools agentName={agent} tools={tools} />
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
