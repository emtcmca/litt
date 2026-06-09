import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { T } from '../../tokens';
import { Icon } from '../ui/Icon';
import { Mono } from '../ui/Mono';
import type { IconName } from '../ui/Icon';

const FIRM_NAME = 'Strand & Okafor';
const DEMO_DATE_DISPLAY = 'Jun 25, 2026';
const LAST_SWEEP = '5:00 PM';

interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: IconName;
  star?: boolean;
  count?: number;
}

interface NavSection {
  group: string | null;
  items: NavItem[];
}

const NAV: NavSection[] = [
  { group: null, items: [
    { id: 'overview', label: 'Overview',  path: '/',      icon: 'grid' },
    { id: 'brief',    label: 'Brief',     path: '/brief', icon: 'clock', star: true },
  ]},
  { group: 'Watch', items: [
    { id: 'clients',   label: 'Clients',   path: '/clients',    icon: 'users',  count: 4 },
    { id: 'deadlines', label: 'Deadlines', path: '/deadlines',  icon: 'shield', count: 1 },
    { id: 'budgets',   label: 'Budgets',   path: '/budgets',    icon: 'chart',  count: 1 },
    { id: 'anomalies', label: 'Anomalies', path: '/anomalies',  icon: 'alert',  count: 1 },
  ]},
  { group: 'Collect', items: [
    { id: 'collect', label: 'Billing & WIP', path: '/collect', icon: 'dollar', count: 2 },
  ]},
  { group: 'Prove', items: [
    { id: 'agents', label: 'Agent console', path: '/agents', icon: 'refresh' },
    { id: 'record', label: 'Audit ledger',  path: '/ledger', icon: 'book'    },
  ]},
  { group: 'Tune', items: [
    { id: 'policy',       label: 'Policy & autonomy', path: '/policy',       icon: 'sliders' },
    { id: 'integrations', label: 'Integrations',      path: '/integrations', icon: 'plug'    },
  ]},
];

const USERS = [
  { id: 'marcus-okafor', name: 'Marcus Okafor', initials: 'MO', role: 'Managing Partner', scope: 'firm_admin' },
  { id: 'dana-strand',   name: 'Dana Strand',   initials: 'DS', role: 'Attorney',         scope: 'attorney',  you: true },
  { id: 'priya-nair',    name: 'Priya Nair',    initials: 'PN', role: 'Paralegal',        scope: 'staff'      },
];

const BORDER = 'rgba(214,193,129,.14)';

function UserAvatar({ initials, scope, size = 26 }: { initials: string; scope: string; size?: number }) {
  const isFirmAdmin = scope === 'firm_admin';
  return (
    <span style={{
      width: size, height: size, borderRadius: 999,
      background: isFirmAdmin ? T.brass : 'rgba(214,193,129,.18)',
      color:      isFirmAdmin ? T.forest : T.brass,
      display: 'grid', placeItems: 'center',
      fontSize: size * 0.41, fontWeight: 700, flexShrink: 0,
      fontFamily: 'var(--font-mono)',
    }}>
      {initials}
    </span>
  );
}

export function ConsoleRail() {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeUser, setActiveUser] = useState(() => USERS.find(u => u.you) ?? USERS[0]);

  const isActive = (path: string) => {
    if (path === '/clients') return pathname === '/clients' || pathname.startsWith('/clients/');
    return pathname === path;
  };

  return (
    <nav style={{
      width: 232, minWidth: 232,
      background: T.forest,
      borderRight: `1px solid rgba(214,193,129,.18)`,
      display: 'flex', flexDirection: 'column',
      height: '100%', overflowY: 'auto', overflowX: 'hidden',
    }}>

      {/* brand */}
      <div style={{ padding: '18px 18px 14px', borderBottom: `1px solid ${BORDER}` }}>
        <img src="/icons-logo/litt_logo_main_no_tagline.png" alt="Litt" style={{ height: 28, display: 'block' }} />
        <Mono style={{ fontSize: 10.5, color: '#9DA89A', marginTop: 6 }}>{FIRM_NAME}</Mono>
      </div>

      {/* nav */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '12px 12px',
        display: 'grid', gap: 16, alignContent: 'start',
      }}>
        {NAV.map((sec, i) => (
          <div key={i} style={{ display: 'grid', gap: 3 }}>
            {sec.group && (
              <Mono style={{
                fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.12em',
                color: '#7E8A7C', padding: '4px 10px 2px', display: 'block',
              }}>
                {sec.group}
              </Mono>
            )}
            {sec.items.map(it => {
              const on = isActive(it.path);
              const star = !!(it.star && !on);
              return (
                <Link
                  key={it.id}
                  to={it.path}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', textAlign: 'left',
                    padding: '8px 10px', borderRadius: 8,
                    border: star ? '1px solid rgba(214,193,129,.4)' : '1px solid transparent',
                    fontSize: 13, fontWeight: on || it.star ? 600 : 500,
                    fontFamily: 'var(--font-sans)',
                    background: on ? T.brass : (star ? 'rgba(214,193,129,.08)' : 'transparent'),
                    color: on ? T.forest : '#D8D3C3',
                    textDecoration: 'none',
                    transition: 'background .15s',
                  }}
                >
                  <Icon name={it.icon} size={15} color={on ? T.forest : (star ? T.brass : '#B7B2A2')} />
                  <span style={{ flex: 1 }}>{it.label}</span>
                  {star && (
                    <Mono style={{ fontSize: 9, color: T.auditAccent, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                      ready
                    </Mono>
                  )}
                  {it.count != null && (
                    <Mono style={{
                      fontSize: 10.5,
                      color: on ? T.forest : T.danger,
                      background: on ? 'rgba(20,34,31,.12)' : 'rgba(155,45,35,.16)',
                      borderRadius: 999, padding: '1px 6px', fontWeight: 600,
                    }}>
                      {it.count}
                    </Mono>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* system status */}
      <div style={{ padding: '12px 16px', borderTop: `1px solid ${BORDER}`, display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span className="litt-pulse" style={{
            width: 6, height: 6, borderRadius: 999,
            background: T.auditAccent,
            boxShadow: `0 0 6px ${T.auditAccent}`,
            display: 'inline-block',
          }} />
          <Mono style={{ fontSize: 10.5, color: '#9DA89A' }}>Demo systems ready</Mono>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Mono style={{ fontSize: 10, color: '#7E8A7C' }}>Last sweep</Mono>
          <Mono style={{ fontSize: 10, color: T.brass }}>{LAST_SWEEP}</Mono>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Mono style={{ fontSize: 10, color: '#7E8A7C' }}>Integrations</Mono>
          <Mono style={{ fontSize: 10, color: T.brass }}>2 connected</Mono>
        </div>
        {/* demo date anchor */}
        <Mono style={{ fontSize: 10, color: T.brass, marginTop: 2 }}>Demo date: {DEMO_DATE_DISPLAY}</Mono>
      </div>

      {/* user switcher */}
      <div style={{ position: 'relative', padding: '12px 14px', borderTop: `1px solid ${BORDER}` }}>
        {menuOpen && (
          <div style={{
            position: 'absolute', bottom: '100%', left: 12, right: 12, marginBottom: 6,
            background: '#1C2E2A',
            border: `1px solid rgba(214,193,129,.22)`,
            borderRadius: 10, overflow: 'hidden',
            boxShadow: '0 12px 30px rgba(0,0,0,.4)',
          }}>
            {USERS.map(u => (
              <button
                key={u.id}
                onClick={() => { setActiveUser(u); setMenuOpen(false); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                  padding: '9px 11px',
                  background: u.id === activeUser.id ? 'rgba(214,193,129,.1)' : 'transparent',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <UserAvatar initials={u.initials} scope={u.scope} size={24} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 12, color: '#EFEBDB', fontWeight: 500 }}>{u.name}</span>
                  <Mono style={{ fontSize: 9.5, color: '#9DA89A' }}>
                    {u.role}{u.scope === 'firm_admin' ? ' · sets firm policy' : ''}
                  </Mono>
                </span>
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setMenuOpen(v => !v)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 9,
            background: 'transparent',
            border: `1px solid rgba(214,193,129,.18)`,
            borderRadius: 9, padding: '8px 10px', cursor: 'pointer',
          }}
        >
          <UserAvatar initials={activeUser.initials} scope={activeUser.scope} size={26} />
          <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <span style={{ display: 'block', fontSize: 12.5, color: '#EFEBDB', fontWeight: 500 }}>
              {activeUser.name}
            </span>
            <Mono style={{ fontSize: 9.5, color: '#9DA89A' }}>{activeUser.role}</Mono>
          </span>
          <Icon name="chevronD" size={13} color="#9DA89A" />
        </button>
      </div>
    </nav>
  );
}
