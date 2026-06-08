import { Link, useLocation } from 'react-router-dom';
import { T } from '../../tokens';
import { Icon } from '../ui/Icon';

export function ClientsSubnav() {
  const { pathname } = useLocation();
  const onClients = pathname === '/clients' || pathname.startsWith('/clients/');
  const onComms   = pathname === '/relationships';

  const pillActive: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 13px', borderRadius: 7,
    background: T.surface, border: `1px solid ${T.line}`,
    fontSize: 12.5, fontWeight: 600, color: T.ink,
    textDecoration: 'none',
  };
  const pillInactive: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 13px', borderRadius: 7,
    background: 'transparent', border: '1px solid transparent',
    fontSize: 12.5, fontWeight: 600, color: T.muted,
    textDecoration: 'none',
  };

  return (
    <div style={{
      display: 'inline-flex', gap: 5,
      background: T.wash2, border: `1px solid ${T.line}`,
      borderRadius: 10, padding: 4,
    }}>
      <Link to="/clients" style={onClients ? pillActive : pillInactive}>
        <Icon name="users" size={13} color={onClients ? T.forest : T.muted} />
        All clients
      </Link>
      <Link to="/relationships" style={onComms ? pillActive : pillInactive}>
        <Icon name="mail" size={13} color={onComms ? T.forest : T.muted} />
        Comms
      </Link>
    </div>
  );
}
