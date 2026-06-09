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
}

const INTEGRATIONS: Integration[] = [
  { id: 'gmail',    name: 'Gmail',               via: 'MCP adapter',   status: 'connected', detail: 'Read-only · deadline & contact extraction', sync: 'Synced 4:58 PM' },
  { id: 'calendar', name: 'Google Calendar',      via: 'MCP adapter',   status: 'connected', detail: 'Deadline & hearing ingestion',               sync: 'Synced 4:58 PM' },
  { id: 'ledes',    name: 'LEDES 1998B export',   via: 'e-billing',     status: 'ready',     detail: 'Approved entries → compliant invoice file',   sync: 'Last export May 27' },
  { id: 'clio',     name: 'Clio',                 via: 'practice mgmt', status: 'available', detail: 'Matter & contact sync',                       sync: 'Not connected' },
];

const STATUS_META: Record<string, { label: string; color: string }> = {
  connected: { label: 'Connected', color: T.teal },
  ready:     { label: 'Ready',     color: T.gold },
  available: { label: 'Available', color: T.faint },
};

const ICON_MAP: Record<string, IconName> = {
  gmail: 'mail', calendar: 'clock', ledes: 'dollar', clio: 'grid',
};

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
            return (
              <div key={it.id} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: '16px 18px', display: 'grid', gap: 11 }}>
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
                <p style={{ margin: 0, fontSize: 12.5, color: T.muted, lineHeight: 1.45 }}>{it.detail}</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 9, borderTop: `1px solid ${T.soft}` }}>
                  <span style={{ fontSize: 10.5, color: T.faint, fontFamily: 'var(--font-mono)' }}>{connected[it.id] ? 'Synced just now' : it.sync}</span>
                  {it.status === 'available' && !connected[it.id]
                    ? (
                      <button onClick={() => setConnected(c => ({ ...c, [it.id]: true }))} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: T.forest, color: T.brass, border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
                        <Icon name="plug" size={12} color={T.brass} />Connect
                      </button>
                    )
                    : (
                      <span style={{ fontSize: 10.5, color: T.teal, display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-mono)' }}>
                        <Icon name="check" size={11} color={T.teal} stroke={2.4} />
                        {it.status === 'ready' ? 'export ready' : 'least-privilege'}
                      </span>
                    )}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
