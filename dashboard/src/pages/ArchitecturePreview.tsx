import type { CSSProperties, ReactNode } from 'react';
import { T } from '../tokens';
import { Icon, type IconName } from '../components/ui/Icon';

const inkSubtle = 'rgba(44,44,42,.66)';
const connector = 'rgba(20,34,31,.34)';
const tealLine = 'rgba(29,158,117,.55)';
const goldLine = 'rgba(169,132,53,.58)';

type Tone = 'forest' | 'teal' | 'gold' | 'danger' | 'neutral' | 'dark';

const toneMeta: Record<Tone, { fg: string; bg: string; border: string }> = {
  forest: { fg: T.forest, bg: 'rgba(20,34,31,.07)', border: 'rgba(20,34,31,.18)' },
  teal: { fg: T.teal, bg: 'rgba(29,158,117,.10)', border: 'rgba(29,158,117,.24)' },
  gold: { fg: T.gold, bg: 'rgba(169,132,53,.11)', border: 'rgba(169,132,53,.28)' },
  danger: { fg: T.danger, bg: T.dangerSoft, border: 'rgba(155,45,35,.24)' },
  neutral: { fg: T.muted, bg: T.wash2, border: T.line },
  dark: { fg: T.brass, bg: T.forest, border: 'rgba(214,193,129,.28)' },
};

interface ChipProps {
  children: ReactNode;
  tone?: Tone;
  mono?: boolean;
}

function Chip({ children, tone = 'neutral', mono = false }: ChipProps) {
  const meta = toneMeta[tone];
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      height: 26,
      borderRadius: 999,
      padding: '0 12px',
      border: `1px solid ${meta.border}`,
      background: meta.bg,
      color: meta.fg,
      fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
      fontSize: 13,
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

interface MiniTagProps {
  children: ReactNode;
  tone?: Tone;
}

function MiniTag({ children, tone = 'neutral' }: MiniTagProps) {
  const meta = toneMeta[tone];
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      borderRadius: 5,
      padding: '3px 7px',
      border: `1px solid ${meta.border}`,
      background: meta.bg,
      color: meta.fg,
      fontFamily: 'var(--font-mono)',
      fontSize: 10.5,
      fontWeight: 600,
      lineHeight: 1,
      letterSpacing: '.01em',
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

interface CardProps {
  title: string;
  subtitle?: string;
  icon: IconName;
  tone?: Tone;
  x: number;
  y: number;
  w: number;
  h: number;
  tags?: Array<{ text: string; tone?: Tone }>;
  children?: ReactNode;
  dark?: boolean;
}

function Card({ title, subtitle, icon, tone = 'neutral', x, y, w, h, tags = [], children, dark = false }: CardProps) {
  const meta = toneMeta[tone];
  const color = dark ? T.brass : meta.fg;
  return (
    <div style={{
      position: 'absolute',
      left: x,
      top: y,
      width: w,
      height: h,
      boxSizing: 'border-box',
      borderRadius: 18,
      border: dark ? `1px solid ${T.forestLine}` : `1px solid ${meta.border}`,
      background: dark ? T.forest : 'rgba(255,255,255,.88)',
      boxShadow: dark ? '0 22px 60px rgba(20,34,31,.20)' : '0 18px 46px rgba(20,20,18,.08)',
      padding: 18,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          display: 'grid',
          placeItems: 'center',
          background: dark ? 'rgba(214,193,129,.12)' : meta.bg,
          border: `1px solid ${dark ? 'rgba(214,193,129,.22)' : meta.border}`,
          flexShrink: 0,
        }}>
          <Icon name={icon} size={19} color={color} stroke={1.8} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.12, color: dark ? T.brass : T.ink }}>{title}</div>
          {subtitle && (
            <div style={{
              marginTop: 3,
              fontSize: 12.5,
              fontFamily: 'var(--font-mono)',
              color: dark ? 'rgba(214,193,129,.70)' : T.faint,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {tags.map(tag => <MiniTag key={tag.text} tone={tag.tone}>{tag.text}</MiniTag>)}
        </div>
      )}
      <div style={{
        marginTop: 'auto',
        display: 'grid',
        gap: 5,
        color: dark ? 'rgba(251,250,246,.80)' : inkSubtle,
        fontSize: 13,
        lineHeight: 1.34,
      }}>
        {children}
      </div>
    </div>
  );
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <span style={{ width: 5, height: 5, borderRadius: 999, background: 'currentColor', opacity: .45, marginTop: 7, flexShrink: 0 }} />
      <span>{children}</span>
    </div>
  );
}

function SectionLabel({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <div style={{
      position: 'absolute',
      left: x,
      top: y,
      fontSize: 12,
      fontFamily: 'var(--font-mono)',
      fontWeight: 600,
      letterSpacing: '.06em',
      textTransform: 'uppercase',
      color: T.faint,
    }}>
      {children}
    </div>
  );
}

function Line({
  d,
  stroke = connector,
  dashed = false,
  width = 2,
}: {
  d: string;
  stroke?: string;
  dashed?: boolean;
  width?: number;
}) {
  return (
    <path
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={width}
      strokeLinecap="round"
      strokeDasharray={dashed ? '8 8' : undefined}
      markerEnd="url(#arrow)"
    />
  );
}

function FooterLegend() {
  const item = (label: string, tone: Tone, sample: 'solid' | 'dash' | 'gate' | 'lock') => {
    const meta = toneMeta[tone];
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {sample === 'lock' ? (
          <span style={{ width: 28, height: 20, borderRadius: 999, display: 'grid', placeItems: 'center', background: meta.bg, border: `1px solid ${meta.border}` }}>
            <Icon name="lock" size={11} color={meta.fg} />
          </span>
        ) : (
          <svg width="32" height="16" viewBox="0 0 32 16" aria-hidden="true">
            <path
              d="M3 8H29"
              fill="none"
              stroke={meta.fg}
              strokeWidth={sample === 'gate' ? 4 : 2.5}
              strokeLinecap="round"
              strokeDasharray={sample === 'dash' ? '5 5' : undefined}
            />
          </svg>
        )}
        <span style={{ fontSize: 12.5, color: T.muted }}>{label}</span>
      </div>
    );
  };

  return (
    <div style={{
      position: 'absolute',
      left: 72,
      right: 72,
      bottom: 34,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderTop: `1px solid ${T.soft}`,
      paddingTop: 18,
    }}>
      <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
        {item('deterministic route/tool call', 'forest', 'solid')}
        {item('Gemini language task', 'teal', 'dash')}
        {item('attorney approval gate', 'gold', 'gate')}
        {item('no direct agent write path', 'danger', 'lock')}
      </div>
      <div style={{ fontSize: 12.5, color: T.faint, fontFamily: 'var(--font-mono)' }}>
        firms/strand-okafor | demo date 2026-06-25 | Track 1 submission artifact
      </div>
    </div>
  );
}

const fullScreen: CSSProperties = {
  width: '100vw',
  height: '100vh',
  margin: 0,
  overflow: 'hidden',
  background: T.paper,
  fontFamily: 'var(--font-sans)',
};

export function ArchitecturePreview() {
  return (
    <main style={fullScreen}>
      <div style={{
        width: 1920,
        height: 1080,
        position: 'relative',
        overflow: 'hidden',
        background: `
          linear-gradient(180deg, rgba(255,255,255,.86), rgba(251,250,246,.96)),
          radial-gradient(circle at 78% 12%, rgba(214,193,129,.20), transparent 30%),
          radial-gradient(circle at 8% 82%, rgba(29,158,117,.12), transparent 29%),
          ${T.paper}
        `,
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'linear-gradient(rgba(20,20,18,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(20,20,18,.035) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          maskImage: 'linear-gradient(180deg, rgba(0,0,0,.7), rgba(0,0,0,.18))',
          pointerEvents: 'none',
        }} />

        <header style={{
          position: 'absolute',
          left: 72,
          right: 72,
          top: 46,
          height: 112,
          display: 'flex',
          justifyContent: 'space-between',
          gap: 44,
          alignItems: 'flex-start',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
              <div style={{
                width: 58,
                height: 58,
                borderRadius: 18,
                background: T.forest,
                color: T.brass,
                display: 'grid',
                placeItems: 'center',
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: '-.04em',
                boxShadow: '0 16px 40px rgba(20,34,31,.24)',
              }}>
                Li
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: 48, lineHeight: 1, letterSpacing: '-.035em', color: T.ink }}>Litt architecture</h1>
                <p style={{ margin: '10px 0 0', fontSize: 18, lineHeight: 1.35, color: T.muted }}>
                  Autonomous operations agent for small law firms
                </p>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap', maxWidth: 830 }}>
            <Chip tone="gold">Track 1: net-new agents</Chip>
            <Chip tone="forest" mono>Google ADK</Chip>
            <Chip tone="teal" mono>Gemini 2.5 Pro via Vertex AI</Chip>
            <Chip tone="forest" mono>MCP-compatible adapters</Chip>
            <Chip tone="neutral" mono>Cloud Run</Chip>
            <Chip tone="neutral" mono>Firestore</Chip>
          </div>
        </header>

        <SectionLabel x={82} y={186}>Scoped inputs</SectionLabel>
        <SectionLabel x={430} y={186}>ADK orchestration</SectionLabel>
        <SectionLabel x={784} y={186}>Specialist agents</SectionLabel>
        <SectionLabel x={1236} y={186}>Write boundary</SectionLabel>
        <SectionLabel x={1570} y={186}>Durable outputs</SectionLabel>

        <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} width="1920" height="1080" viewBox="0 0 1920 1080" aria-hidden="true">
          <defs>
            <marker id="arrow" markerWidth="9" markerHeight="9" refX="7.5" refY="4.5" orient="auto">
              <path d="M0,0 L9,4.5 L0,9 Z" fill={connector} />
            </marker>
          </defs>
          <Line d="M360 278 C405 278 402 455 432 455" />
          <Line d="M360 415 C400 415 405 455 432 455" />
          <Line d="M360 552 C405 552 400 455 432 455" />
          <Line d="M360 690 C402 690 406 455 432 455" />
          <Line d="M704 455 C745 455 746 286 786 286" />
          <Line d="M704 455 C745 455 746 429 786 429" />
          <Line d="M704 455 C745 455 746 572 786 572" />
          <Line d="M704 455 C745 455 746 715 786 715" />
          <Line d="M1184 286 C1214 286 1210 294 1238 294" />
          <Line d="M1184 429 C1214 429 1210 294 1238 294" />
          <Line d="M1184 572 C1214 572 1210 294 1238 294" />
          <Line d="M1184 715 C1214 715 1210 294 1238 294" />
          <Line d="M1376 435 C1394 435 1394 512 1410 512" stroke={goldLine} width={3} />
          <Line d="M1376 294 C1410 294 1412 672 1442 672" />
          <Line d="M1508 294 C1538 294 1538 284 1568 284" />
          <Line d="M1508 672 C1538 672 1538 284 1568 284" />
          <Line d="M1508 672 C1538 672 1538 454 1568 454" />
          <Line d="M1508 435 C1538 435 1538 624 1568 624" stroke={goldLine} width={3} />
          <Line d="M985 251 C1035 205 1088 814 1128 814" stroke={tealLine} dashed />
          <Line d="M985 536 C1040 554 1078 816 1128 814" stroke={tealLine} dashed />
          <Line d="M570 535 C598 758 1014 810 1128 814" stroke={tealLine} dashed />
        </svg>

        <Card
          title="Gmail"
          subtitle="MCP-compatible adapter"
          icon="mail"
          tone="forest"
          x={72}
          y={218}
          w={288}
          h={128}
          tags={[{ text: 'read-only', tone: 'teal' }, { text: 'threads + commitments' }]}
        >
          <Bullet>Email body is data, never instructions.</Bullet>
        </Card>

        <Card
          title="Google Calendar"
          subtitle="MCP-compatible adapter"
          icon="clock"
          tone="forest"
          x={72}
          y={356}
          w={288}
          h={128}
          tags={[{ text: 'read-only', tone: 'teal' }, { text: 'hearings + dates' }]}
        >
          <Bullet>Events feed deadline cadence checks.</Bullet>
        </Card>

        <Card
          title="Matter store"
          subtitle="Firestore demo corpus"
          icon="book"
          tone="neutral"
          x={72}
          y={494}
          w={288}
          h={128}
          tags={[{ text: 'matters' }, { text: 'clients' }, { text: 'time' }]}
        >
          <Bullet>State is tenant-scoped by firm_id.</Bullet>
        </Card>

        <Card
          title="LEDES export"
          subtitle="e-billing output"
          icon="dollar"
          tone="gold"
          x={72}
          y={632}
          w={288}
          h={120}
          tags={[{ text: 'approved entries only', tone: 'gold' }]}
        >
          <Bullet>Exports run after attorney gates.</Bullet>
        </Card>

        <Card
          title="Coordinator"
          subtitle="ADK orchestration hub"
          icon="refresh"
          tone="dark"
          dark
          x={432}
          y={350}
          w={272}
          h={230}
          tags={[
            { text: 'classify_signal()', tone: 'dark' },
            { text: 'SignalType enum', tone: 'dark' },
            { text: 'Python routing table', tone: 'dark' },
          ]}
        >
          <Bullet>Routes signals with a fixed rulebook.</Bullet>
          <Bullet>No model chooses agents.</Bullet>
        </Card>

        <div style={{
          position: 'absolute',
          left: 408,
          top: 602,
          width: 320,
          boxSizing: 'border-box',
          borderRadius: 18,
          padding: '16px 18px',
          background: 'rgba(20,34,31,.06)',
          border: '1px dashed rgba(20,34,31,.25)',
          color: T.forest,
          fontSize: 15,
          lineHeight: 1.4,
        }}>
          <strong style={{ fontWeight: 700 }}>Deterministic/probabilistic boundary:</strong>
          <br />
          Python owns routing, math, state, gates, and writes. Gemini handles only language extraction and drafts.
        </div>

        <Card
          title="Deadline Monitor"
          subtitle="deadline_agent"
          icon="shield"
          tone="danger"
          x={786}
          y={218}
          w={398}
          h={128}
          tags={[{ text: 'Python cadence', tone: 'forest' }, { text: 'Gemini extraction', tone: 'teal' }]}
        >
          <Bullet>Computes due-date pressure and conflicts.</Bullet>
          <Bullet>Escalates unconfirmed HARD_LEGAL dates.</Bullet>
        </Card>

        <Card
          title="Billing Reconciliation"
          subtitle="billing_agent"
          icon="dollar"
          tone="gold"
          x={786}
          y={361}
          w={398}
          h={128}
          tags={[{ text: '7 scrubber rules', tone: 'forest' }, { text: 'budget math', tone: 'gold' }]}
        >
          <Bullet>Blocks unsafe narratives before billing.</Bullet>
          <Bullet>Write-downs and write-offs require reasons.</Bullet>
        </Card>

        <Card
          title="Client Comms"
          subtitle="comms_agent"
          icon="mail"
          tone="teal"
          x={786}
          y={504}
          w={398}
          h={128}
          tags={[{ text: 'FactPackets', tone: 'forest' }, { text: 'Gemini drafts', tone: 'teal' }]}
        >
          <Bullet>Drafts are source-backed and checked.</Bullet>
          <Bullet>No client message sends without approval.</Bullet>
        </Card>

        <Card
          title="Anomaly Escalation"
          subtitle="anomaly_agent"
          icon="alert"
          tone="danger"
          x={786}
          y={647}
          w={398}
          h={128}
          tags={[{ text: '13 detectors', tone: 'forest' }, { text: 'severity x confidence', tone: 'danger' }]}
        >
          <Bullet>Flags reconstruction risk, duplicates, and gaps.</Bullet>
          <Bullet>Dismissal requires attorney reason.</Bullet>
        </Card>

        <Card
          title="Gemini via Vertex"
          subtitle="probabilistic work only"
          icon="chart"
          tone="teal"
          x={1128}
          y={814}
          w={382}
          h={118}
          tags={[{ text: 'date extraction', tone: 'teal' }, { text: 'drafts', tone: 'teal' }, { text: 'brief narrative', tone: 'teal' }]}
        >
          <Bullet>Human-readable language tasks only.</Bullet>
        </Card>

        <div style={{
          position: 'absolute',
          left: 1210,
          top: 224,
          width: 18,
          height: 528,
          borderRadius: 999,
          background: 'linear-gradient(180deg, rgba(155,45,35,.20), rgba(169,132,53,.20), rgba(20,34,31,.20))',
          border: '1px solid rgba(20,20,18,.08)',
        }} />
        <div style={{
          position: 'absolute',
          left: 1170,
          top: 772,
          width: 420,
          textAlign: 'center',
          fontSize: 13,
          color: T.danger,
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          letterSpacing: '.02em',
        }}>
          no direct agent writes to Firestore
        </div>

        <Card
          title="Tool layer"
          subtitle="only write path"
          icon="lock"
          tone="forest"
          x={1238}
          y={224}
          w={270}
          h={150}
          tags={[{ text: 'idempotency_key', tone: 'forest' }, { text: 'expected_status', tone: 'forest' }]}
        >
          <Bullet>Business rules run before writes.</Bullet>
        </Card>

        <Card
          title="Human gates"
          subtitle="approval boundary"
          icon="users"
          tone="gold"
          x={1238}
          y={394}
          w={270}
          h={150}
          tags={[{ text: 'AUTO_SAFE' }, { text: 'REVIEW', tone: 'gold' }, { text: 'ESCALATION', tone: 'danger' }, { text: 'BLOCKED', tone: 'forest' }]}
        >
          <Bullet>Attorneys approve legal action.</Bullet>
        </Card>

        <Card
          title="Audit log"
          subtitle="CREATE-only record"
          icon="shield"
          tone="dark"
          dark
          x={1238}
          y={564}
          w={270}
          h={150}
          tags={[{ text: 'before_state', tone: 'dark' }, { text: 'after_state', tone: 'dark' }]}
        >
          <Bullet>Records actor, tier, and before/after state.</Bullet>
        </Card>

        <div style={{
          position: 'absolute',
          left: 1218,
          top: 724,
          width: 304,
          textAlign: 'center',
          color: T.forest,
          fontSize: 16,
          fontWeight: 700,
          lineHeight: 1.35,
        }}>
          Agents propose. Tools enforce. Attorneys approve. Firestore records.
        </div>

        <Card
          title="Firestore"
          subtitle="firms/{firm_id}/..."
          icon="grid"
          tone="forest"
          x={1568}
          y={224}
          w={280}
          h={140}
          tags={[{ text: 'agent_runs' }, { text: 'audit_log' }, { text: 'deadlines' }]}
        >
          <Bullet>Durable legal state and tenant isolation.</Bullet>
        </Card>

        <Card
          title="Observability"
          subtitle="agent run timeline"
          icon="chart"
          tone="teal"
          x={1568}
          y={394}
          w={280}
          h={140}
          tags={[{ text: 'tool calls', tone: 'forest' }, { text: 'confidence', tone: 'teal' }, { text: 'evidence' }]}
        >
          <Bullet>Judges can inspect what each agent did.</Bullet>
        </Card>

        <Card
          title="Attorney UI"
          subtitle="decision surfaces"
          icon="check"
          tone="gold"
          x={1568}
          y={564}
          w={280}
          h={140}
          tags={[{ text: 'Brief', tone: 'gold' }, { text: 'Resolve Panel' }, { text: 'Ledger' }]}
        >
          <Bullet>Daily Closeout Brief ranks what needs judgment.</Bullet>
        </Card>

        <div style={{
          position: 'absolute',
          left: 1568,
          top: 736,
          width: 280,
          borderRadius: 18,
          padding: '16px 18px',
          boxSizing: 'border-box',
          background: T.surface,
          border: `1px solid ${T.line}`,
          boxShadow: '0 14px 34px rgba(20,20,18,.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.forest, fontWeight: 700, fontSize: 16 }}>
            <Icon name="book" size={16} color={T.forest} />
            Daily Closeout ritual
          </div>
          <p style={{ margin: '8px 0 0', color: T.muted, fontSize: 13.5, lineHeight: 1.4 }}>
            Find risk, ask for judgment, record the decision, and prove what happened.
          </p>
        </div>

        <FooterLegend />
      </div>
    </main>
  );
}
