import { T } from '../tokens';
import { Icon } from '../components/ui/Icon';

// Phase 2 replaces this stub with the full Overview page.
export function Overview() {
  return (
    <div style={{
      overflowY: 'auto',
      display: 'grid',
      placeItems: 'center',
      minHeight: '100%',
      padding: 40,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <span style={{
          width: 48, height: 48, borderRadius: 12,
          background: T.wash2, border: `1px solid ${T.line}`,
          display: 'grid', placeItems: 'center',
          margin: '0 auto 14px',
        }}>
          <Icon name="grid" size={22} color={T.gold} />
        </span>
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, color: T.ink }}>Overview</h2>
        <p style={{ margin: '8px 0 0', fontSize: 13.5, color: T.muted, lineHeight: 1.5 }}>
          Building now — Phase 2.
        </p>
      </div>
    </div>
  );
}
