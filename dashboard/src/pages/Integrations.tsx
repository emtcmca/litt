import { useState } from 'react';
import { T } from '../tokens';
import { Icon, type IconName } from '../components/ui/Icon';

interface Integration {
  id: string;
  name: string;
  via: string;
  status: 'connected' | 'ready' | 'available';
  detail: string;
  sync: string;
  scope: string;
  direction: 'read-only' | 'write-gated' | 'export-only' | 'available';
  tools: string[];
  demoState: string;
}

const INTEGRATIONS: Integration[] = [
  { id: 'gmail', name: 'Gmail', via: 'MCP adapter', status: 'connected',
    detail: 'Reads email threads for deadline extraction and client silence detection',
    sync: 'Synced 4:58 PM',
    scope: 'gmail.readonly',
    direction: 'read-only',
    tools: ['scan_inbox', 'extract_commitments', 'build_fact_packet'],
    demoState: 'Fixture adapter active · OAuth path documented' },

  { id: 'calendar', name: 'Google Calendar', via: 'MCP adapter', status: 'connected',
    detail: 'Ingests court dates and hearing events for deadline computation',
    sync: 'Synced 4:58 PM',
    scope: 'calendar.events.readonly',
    direction: 'read-only',
    tools: ['ingest_calendar_events', 'compute_days_remaining'],
    demoState: 'Fixture adapter active · OAuth path documented' },

  { id: 'ledes', name: 'LEDES 1998B export', via: 'tool layer', status: 'ready',
    detail: 'Generates compliant LEDES 1998B invoice file from approved time entries',
    sync: 'Last export May 27',
    scope: 'approved billing entries',
    direction: 'export-only',
    tools: ['export_ledes', 'validate_line_items'],
    demoState: 'Ready after attorney approval' },

  { id: 'clio', name: 'Clio', via: 'practice management adapter', status: 'available',
    detail: 'Matter and contact sync — maps Clio matters to Litt matter schema',
    sync: 'Not connected',
    scope: 'matters · contacts',
    direction: 'available',
    tools: ['sync_matters', 'sync_contacts'],
    demoState: 'Production adapter planned for v1.1' },
];

const STATUS_META: Record<string, { label: string; color: string }> = {
  connected: { label: 'Connected', color: T.teal },
  ready:     { label: 'Ready',     color: T.gold },
  available: { label: 'Available', color: T.faint },
};

const ICON_MAP: Record<string, IconName> = {
  gmail: 'mail', calendar: 'clock', ledes: 'dollar', clio: 'grid',
};

function directionColor(d: Integration['direction']): string {
  if (d === 'read-only')   return T.teal;
  if (d === 'export-only') return T.gold;
  if (d === 'write-gated') return T.danger;
  return T.faint;
}

export function Integrations() {
  const [connected, setConnected] = useState<Record<string, boolean>>({});

  return (
    <div style={{ overflowY: 'auto', padding: '24px 30px 60px', height: '100%' }}>
      <div style={{ maxWidth: 920, margin: '0 auto', display: 'grid', gap: 18 }}>

        {/* header */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-.02em', color: T.ink }}>Integrations</h1>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.04em', color: T.gold, background: `${T.gold}1a`, border: `1px solid ${T.gold}44`, borderRadius: 5, padding: '2px 7px', fontFamily: 'var(--font-mono)' }}>Connected systems</span>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 14.5, color: T.muted, lineHeight: 1.5, maxWidth: '64ch' }}>
            Where Litt reads from and writes to. Every connection runs through an MCP adapter with least-privilege scopes — read-only where reading is all that's needed, and never a credential Litt doesn't require.
          </p>
        </div>

        {/* integration tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {INTEGRATIONS.map(it => {
            const isOn = connected[it.id] || it.status !== 'available';
            const st   = connected[it.id] ? STATUS_META.connected : STATUS_META[it.status];
            const iconName = ICON_MAP[it.id] ?? 'plug';
            const dc = directionColor(it.direction);
            return (
              <div key={it.id} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: '16px 18px', display: 'grid', gap: 10 }}>
                {/* icon + name + status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <span style={{ width: 38, height: 38, borderRadius: 10, background: isOn ? 'rgba(29,158,117,.08)' : T.wash2, border: `1px solid ${isOn ? 'rgba(29,158,117,.2)' : T.line}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <Icon name={iconName} size={18} color={isOn ? T.teal : T.faint} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: T.ink }}>{it.name}</div>
                    <span style={{ fontSize: 10.5, color: T.faint, fontFamily: 'var(--font-mono)' }}>{it.via}</span>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: `${st.color}14`, border: `1px solid ${st.color}40` }}>
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: st.color }} />
                    <span style={{ fontSize: 10, fontWeight: 600, color: st.color, fontFamily: 'var(--font-mono)' }}>{st.label}</span>
                  </span>
                </div>

                {/* detail */}
                <p style={{ margin: 0, fontSize: 12.5, color: T.muted, lineHeight: 1.45 }}>{it.detail}</p>

                {/* scope + direction */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: T.muted, background: T.wash2, border: `1px solid ${T.soft}`, borderRadius: 4, padding: '2px 7px' }}>
                    {it.scope}
                  </span>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, color: dc, background: `${dc}10`, border: `1px solid ${dc}33`, borderRadius: 4, padding: '2px 7px' }}>
                    {it.direction}
                  </span>
                </div>

                {/* tool chips */}
                {it.tools.length > 0 && (
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {it.tools.map(t => (
                      <span key={t} style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: T.faint, background: T.wash2, border: `1px solid ${T.soft}`, borderRadius: 4, padding: '1px 6px' }}>
                        {t}()
                      </span>
                    ))}
                  </div>
                )}

                {/* footer: sync time + demo state + connect action */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 9, borderTop: `1px solid ${T.soft}` }}>
                  <div>
                    <span style={{ fontSize: 10.5, color: T.faint, fontFamily: 'var(--font-mono)', display: 'block' }}>{connected[it.id] ? 'Synced just now' : it.sync}</span>
                    <span style={{ fontSize: 10, color: T.faint, fontFamily: 'var(--font-mono)', fontStyle: 'italic' }}>{it.demoState}</span>
                  </div>
                  {it.status === 'available' && !connected[it.id]
                    ? (
                      <button onClick={() => setConnected(c => ({ ...c, [it.id]: true }))} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: T.forest, color: T.brass, border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-sans)', flexShrink: 0 }}>
                        <Icon name="plug" size={12} color={T.brass} />Connect
                      </button>
                    )
                    : (
                      <span style={{ fontSize: 10.5, color: T.teal, display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                        <Icon name="check" size={11} color={T.teal} stroke={2.4} />
                        {it.status === 'ready' ? 'export ready' : 'least-privilege'}
                      </span>
                    )}
                </div>
              </div>
            );
          })}
        </div>

        {/* MCP boundary panel */}
        <div style={{
          background: T.surface,
          border: `1px solid ${T.line}`,
          borderRadius: 14,
          padding: '20px 24px',
          display: 'grid',
          gap: 16,
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: T.ink, marginBottom: 4 }}>
              How Litt connects without overreaching
            </div>
          </div>

          {/* Four-step flow */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {[
              { label: 'External system', sub: 'Gmail · Calendar' },
              { label: 'MCP adapter', sub: 'gmail.readonly' },
              { label: 'Deterministic tool', sub: 'Tool layer enforces' },
              { label: 'Audit record', sub: 'CREATE-only log' },
            ].map((step, i) => (
              <>
                <div key={step.label} style={{
                  background: T.wash2,
                  border: `1px solid ${T.soft}`,
                  borderRadius: 10,
                  padding: '12px 14px',
                  minWidth: 160,
                  flex: '1 1 160px',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.ink }}>{step.label}</div>
                  <div style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: T.faint, marginTop: 2 }}>{step.sub}</div>
                </div>
                {i < 3 && (
                  <span key={`arrow-${i}`} style={{ fontSize: 18, color: T.gold, flexShrink: 0, alignSelf: 'center' }}>→</span>
                )}
              </>
            ))}
          </div>

          {/* Explanatory copy */}
          <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.6, maxWidth: '64ch' }}>
            Gmail and Calendar are read-only in the demo path. Agents gather context through adapters, but any state change must pass through Litt's tool layer and create an audit event. No external system receives a write without attorney approval.
          </p>
        </div>

      </div>
    </div>
  );
}
