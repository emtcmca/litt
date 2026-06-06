import { NavLink } from 'react-router-dom';

// Rail constants
const RAIL_BG     = '#111C19';
const RAIL_BORDER = 'rgba(255,255,255,0.06)';
const SEC_LABEL   = 'rgba(93,202,165,0.45)'; // teal-200 at 45%
const ITEM_REST   = 'rgba(255,255,255,0.55)';
const ITEM_HOVER  = 'rgba(255,255,255,0.85)';
const ITEM_ACTIVE_BG     = 'rgba(93,202,165,0.10)';
const ITEM_ACTIVE_BORDER = '#5DCAA5';
const ITEM_ACTIVE_COLOR  = '#9FE1CB';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  badge?: number;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

interface ConsoleRailProps {
  badges?: Record<string, number>;
}

function NavItemRow({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      style={({ isActive }) => ({
        display:         'flex',
        alignItems:      'center',
        gap:             8,
        padding:         '6px 14px 6px 12px',
        borderLeft:      `2px solid ${isActive ? ITEM_ACTIVE_BORDER : 'transparent'}`,
        background:      isActive ? ITEM_ACTIVE_BG : 'transparent',
        color:           isActive ? ITEM_ACTIVE_COLOR : ITEM_REST,
        textDecoration:  'none',
        fontSize:        13,
        fontWeight:      isActive ? 600 : 400,
        letterSpacing:   0,
        cursor:          'pointer',
        borderRadius:    '0 4px 4px 0',
        marginRight:     8,
        transition:      'color 0.12s, background 0.12s',
        whiteSpace:      'nowrap',
        overflow:        'hidden',
        textOverflow:    'ellipsis',
      })}
    >
      <span style={{ fontSize: 13, flexShrink: 0 }}>{item.icon}</span>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {item.label}
      </span>
      {item.badge != null && item.badge > 0 && (
        <span style={{
          flexShrink:    0,
          background:    '#5DCAA5',
          color:         '#04342C',
          borderRadius:  8,
          padding:       '1px 5px',
          fontSize:      9,
          fontWeight:    700,
          fontFamily:    'var(--font-mono)',
          lineHeight:    1.4,
        }}>
          {item.badge}
        </span>
      )}
    </NavLink>
  );
}

export function ConsoleRail({ badges = {} }: ConsoleRailProps) {
  const sections: NavSection[] = [
    {
      label: 'Watch',
      items: [
        { label: 'Brief',         path: '/',              icon: '◈' },
        { label: 'Deadlines',     path: '/deadlines',     icon: '⊙', badge: badges.deadlines },
        { label: 'Relationships', path: '/relationships', icon: '↔', badge: badges.relationships },
      ],
    },
    {
      label: 'Collect',
      items: [
        { label: 'Billing',       path: '/collect',       icon: '▤' },
        { label: 'Anomalies',     path: '/anomalies',     icon: '◎', badge: badges.anomalies },
        { label: 'Budgets',       path: '/budgets',       icon: '▦' },
      ],
    },
    {
      label: 'Prove',
      items: [
        { label: 'Agents',        path: '/agents',        icon: '⬡' },
        { label: 'Audit Ledger',  path: '/ledger',        icon: '⊞' },
      ],
    },
    {
      label: 'Tune',
      items: [
        { label: 'Policy',        path: '/policy',        icon: '⊛' },
        { label: 'Integrations',  path: '/integrations',  icon: '⊕' },
      ],
    },
  ];

  return (
    <nav style={{
      width:          220,
      minWidth:       220,
      background:     RAIL_BG,
      borderRight:    `1px solid ${RAIL_BORDER}`,
      display:        'flex',
      flexDirection:  'column',
      overflowY:      'auto',
      overflowX:      'hidden',
      height:         '100%',
    }}>
      {/* Logo / firm wordmark */}
      <div style={{
        padding:      '18px 16px 14px',
        borderBottom: `1px solid ${RAIL_BORDER}`,
      }}>
        <div style={{
          fontSize:      14,
          fontWeight:    700,
          color:         '#9FE1CB',
          letterSpacing: '-0.02em',
          lineHeight:    1,
        }}>
          litt
        </div>
        <div style={{
          fontSize:      10,
          fontFamily:    'var(--font-mono)',
          color:         'rgba(159,225,203,0.45)',
          marginTop:     3,
          letterSpacing: '0.04em',
        }}>
          Strand & Okafor
        </div>
      </div>

      {/* Nav sections */}
      <div style={{ flex: 1, paddingTop: 8, paddingBottom: 8 }}>
        {sections.map((sec, si) => (
          <div key={sec.label} style={{ marginBottom: si < sections.length - 1 ? 4 : 0 }}>
            <div style={{
              padding:       '10px 16px 4px',
              fontSize:      9,
              fontFamily:    'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color:         SEC_LABEL,
              userSelect:    'none',
            }}>
              {sec.label}
            </div>
            {sec.items.map(item => (
              <NavItemRow key={item.path} item={item} />
            ))}
          </div>
        ))}
      </div>

      {/* User chip */}
      <div style={{
        padding:      '10px 14px',
        borderTop:    `1px solid ${RAIL_BORDER}`,
        display:      'flex',
        alignItems:   'center',
        gap:          8,
      }}>
        <div style={{
          width:        28,
          height:       28,
          borderRadius: '50%',
          background:   'rgba(93,202,165,0.15)',
          border:       `1px solid rgba(93,202,165,0.25)`,
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'center',
          fontSize:     11,
          fontWeight:   700,
          color:        '#9FE1CB',
          flexShrink:   0,
        }}>
          DS
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: ITEM_HOVER, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Dana Strand
          </div>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: SEC_LABEL, marginTop: 1 }}>
            attorney
          </div>
        </div>
      </div>
    </nav>
  );
}
