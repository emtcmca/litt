import { T } from '../../tokens';

const CHIPS = [
  { color: T.gold,    label: 'Track 1',               sub: 'Net-new autonomous agent'   },
  { color: T.forest,  label: 'ADK',                   sub: 'Coordinator + 4 sub-agents' },
  { color: T.forest,  label: 'MCP adapters',          sub: 'Gmail · Calendar · read-only' },
  { color: T.teal,    label: 'Gemini via Vertex',     sub: 'Drafts + extraction only'   },
  { color: '#5F6F66', label: 'Cloud Run + Firestore', sub: 'Audit trail · append-only'  },
] as const;

export function JudgeProofStrip() {
  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8,
      padding: '10px 26px 12px',
      background: T.surface,
      borderBottom: `1px solid ${T.soft}`,
    }}>
      {CHIPS.map(chip => (
        <div key={chip.label} style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 10px',
          borderRadius: 999,
          border: `1px solid ${chip.color}33`,
          background: `${chip.color}0d`,
        }}>
          <span style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            background: chip.color,
            flexShrink: 0,
          }} />
          <span style={{
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            color: chip.color,
            letterSpacing: '.02em',
          }}>
            {chip.label}
          </span>
          <span style={{
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            color: T.muted,
            marginLeft: 2,
          }}>
            {chip.sub}
          </span>
        </div>
      ))}
    </div>
  );
}
