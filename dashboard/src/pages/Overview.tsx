import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { T } from '../tokens';
import { Icon } from '../components/ui/Icon';
import { Mono } from '../components/ui/Mono';
import { getBrief } from '../api';
import type { BriefResponse, BriefSections } from '../types';
import type { IconName } from '../components/ui/Icon';

const FIRM_ID    = 'strand-okafor';
const ATTORNEY_ID = 'dana-strand';

// ── greet() — translated from litt-core.js ──────────────────────────────────
const _greetCache: Record<string, string> = {};

function greet(name: string, hour: number): string {
  let bucket: string;
  let pool: string[];
  if (hour < 5)        { bucket = 'overnight'; pool = ["It's late, {n}.", "Still up, {n}? It'll keep until morning.", "Go home, {n} — Litt has the watch.", "Past midnight, {n}. This can wait."]; }
  else if (hour < 8)   { bucket = 'early';     pool = ["Early start, {n}.", "Up early, {n}.", "Ahead of the day, {n}."]; }
  else if (hour < 12)  { bucket = 'morning';   pool = ["Good morning, {n}.", "Morning, {n}.", "Morning, {n} — let's get ahead of it."]; }
  else if (hour < 17)  { bucket = 'afternoon'; pool = ["Good afternoon, {n}.", "Afternoon, {n}.", "Afternoon, {n} — let's keep it tidy."]; }
  else if (hour < 21)  { bucket = 'evening';   pool = ["Good evening, {n}.", "Evening, {n}.", "Evening, {n} — let's close out.", "Time to close out, {n}."]; }
  else                 { bucket = 'night';     pool = ["Winding down, {n}?", "Late one, {n}.", "Still going, {n}? Almost there.", "Long day, {n}. Let's wrap it."]; }
  if (!_greetCache[bucket]) {
    _greetCache[bucket] = pool[Math.floor(Math.random() * pool.length)];
  }
  return _greetCache[bucket].replace('{n}', name);
}

function formatGeneratedAt(iso: string): { date: string; time: string; hour: number } {
  const d   = new Date(iso);
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const hour  = d.getHours();
  const min   = d.getMinutes();
  const ampm  = hour >= 12 ? 'PM' : 'AM';
  const h12   = hour % 12 || 12;
  return {
    date:  `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`,
    time:  `${h12}:${String(min).padStart(2, '0')} ${ampm}`,
    hour,
  };
}

// ── Book card colors ─────────────────────────────────────────────────────────
const BOOK_COLOR: Record<string, string> = {
  deadlines: '#185FA5',
  billing:   '#1D9E75',
  budgets:   '#A98435',
  comms:     '#5F6F66',
  anomalies: '#9B2D23',
};

interface BookCard {
  id:       string;
  name:     string;
  icon:     IconName;
  path:     string;
  color:    string;
  total:    number;
  needsYou: number;
  line:     string;
}

function deriveBooksFromSections(s: BriefSections): BookCard[] {
  const dl = s.deadlines;
  const te = s.time_entries;
  const br = s.budget_risks;
  const cs = s.client_silence;
  const an = s.anomalies;
  const ib = s.inbox_items;

  // Deadlines
  const dlUnconfirmed = dl.items.filter(i => i.is_unconfirmed).length;
  const hlItems = dl.items.filter(i => i.classification === 'HARD_LEGAL' && i.is_unconfirmed);
  const dlNearest = hlItems.length > 0 ? Math.min(...hlItems.map(i => i.days_out)) : null;
  const dlLine = dlUnconfirmed > 0 && dlNearest != null
    ? `${dlUnconfirmed} unconfirmed HARD_LEGAL · nearest ${dlNearest}d`
    : `${dl.count} tracked`;

  // Billing & WIP
  const teBlocked     = te.items.filter(i => i.has_block).length;
  const teHeldAmt     = te.items.filter(i => i.has_block).reduce((s, i) => s + i.amount, 0);
  const teLine = teBlocked > 0
    ? `$${Math.round(teHeldAmt).toLocaleString()} held · ${teBlocked} scrubber block`
    : `${te.count} entries · $${Math.round(te.total_wip_usd).toLocaleString()} WIP`;

  // Budgets
  const brOver  = br.items.filter(i => i.alert_status === 'WARN' || i.alert_status === 'CRITICAL').length;
  const brWorse = br.items.length > 0 ? br.items.reduce((mx, i) => i.utilization_pct > mx.utilization_pct ? i : mx, br.items[0]) : null;
  const brLine  = brOver > 0 && brWorse
    ? `${brOver} client${brOver !== 1 ? 's' : ''} over 75% · ${brWorse.client_name.split(' ')[0]} ${brWorse.utilization_pct}%`
    : `${br.count} clients · all within budget`;

  // Clients & comms
  const csCount = cs.count;
  const ibCount = ib.count;
  const csLine  = csCount > 0
    ? `${csCount} silent matter${csCount !== 1 ? 's' : ''} · ${ibCount} awaiting reply`
    : ibCount > 0 ? `${ibCount} awaiting reply` : 'All clients current';

  // Anomalies
  const anElevated = an.items.filter(i => i.risk_level === 'ELEVATED' || i.risk_level === 'CRITICAL').length;
  const anLine = anElevated > 0 ? `${anElevated} elevated` : `${an.count} tracked · none critical`;

  return [
    { id: 'deadlines', name: 'Deadlines',      icon: 'shield', path: '/deadlines',     color: BOOK_COLOR.deadlines, total: dl.count,           needsYou: dlUnconfirmed, line: dlLine },
    { id: 'billing',   name: 'Billing & WIP',  icon: 'dollar', path: '/collect',       color: BOOK_COLOR.billing,   total: te.count,           needsYou: teBlocked,     line: teLine },
    { id: 'budgets',   name: 'Budgets',         icon: 'chart',  path: '/budgets',       color: BOOK_COLOR.budgets,   total: br.count,           needsYou: brOver,        line: brLine },
    { id: 'comms',     name: 'Clients & comms', icon: 'mail',   path: '/relationships', color: BOOK_COLOR.comms,     total: csCount + ibCount,  needsYou: ibCount,       line: csLine },
    { id: 'anomalies', name: 'Anomalies',        icon: 'alert', path: '/anomalies',     color: BOOK_COLOR.anomalies, total: an.count,           needsYou: anElevated,    line: anLine },
  ];
}

// ── Component ────────────────────────────────────────────────────────────────

export function Overview() {
  const navigate = useNavigate();
  const [brief, setBrief] = useState<BriefResponse | null>(null);
  const [error, setError] = useState(false);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    getBrief(FIRM_ID, ATTORNEY_ID)
      .then(setBrief)
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100%', padding: 40 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: T.danger, fontSize: 14 }}>Could not load brief. Is the backend running?</p>
        </div>
      </div>
    );
  }

  if (!brief) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
        <Mono style={{ fontSize: 12, color: T.muted }}>Loading…</Mono>
      </div>
    );
  }

  const { date, time, hour } = formatGeneratedAt(brief.generated_at);
  const firstName = brief.attorney_name.split(' ')[0];
  const greeting  = greet(firstName, hour);
  const books     = deriveBooksFromSections(brief.sections);
  const needsYou  = books.reduce((s, b) => s + b.needsYou, 0);

  return (
    <div style={{ overflowY: 'auto', padding: '30px 34px 60px' }}>
      <div style={{ maxWidth: 880, margin: '0 auto', display: 'grid', gap: 22 }}>

        {/* header */}
        <div>
          <Mono style={{ fontSize: 12, color: T.muted }}>
            {date} · {time} · operations overview
          </Mono>
          <h1 style={{ margin: '6px 0 0', fontSize: 30, fontWeight: 500, letterSpacing: '-.02em', color: T.ink }}>
            {greeting}
          </h1>
          <p style={{ margin: '9px 0 0', fontSize: 16, lineHeight: 1.55, color: '#3C3B35', maxWidth: '56ch' }}>
            Litt is watching everything.{' '}
            <strong style={{ color: T.ink, fontWeight: 600 }}>
              {needsYou} item{needsYou !== 1 ? 's' : ''}
            </strong>
            {' '}across your books need your judgment — the rest is handled and on the record.
          </p>
          <button
            onClick={() => navigate('/brief')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 16,
              background: T.forest, color: T.brass,
              fontWeight: 600, fontSize: 14, padding: '12px 20px',
              borderRadius: 10, border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Open the Brief <Icon name="arrow" size={14} color={T.brass} />
          </button>
        </div>

        {/* the books */}
        <div>
          <div style={{ marginBottom: 15 }}>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: '-.015em', color: T.ink }}>The Books</h2>
            <p style={{ margin: '3px 0 0', fontSize: 13.5, color: T.muted }}>What Litt is watching across your matters.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
            {books.map(b => (
              <BookCardEl key={b.id} book={b} onClick={() => navigate(b.path)} />
            ))}
          </div>
        </div>

        {/* system row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <button
            onClick={() => navigate('/agents')}
            style={{
              textAlign: 'left', background: T.audit, border: 'none',
              borderRadius: 13, padding: '15px 16px', cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="refresh" size={14} color={T.auditAccent} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#EFEBDB' }}>Agents</span>
              <Mono style={{ marginLeft: 'auto', fontSize: 10, color: T.auditMuted }}>see them work →</Mono>
            </div>
            <p style={{ margin: '7px 0 0', fontSize: 12, color: T.auditMuted, lineHeight: 1.4 }}>
              4 sub-agents + a deterministic router · last sweep {time}
            </p>
          </button>
          <button
            onClick={() => navigate('/policy')}
            style={{
              textAlign: 'left', background: T.surface, border: `1px solid ${T.line}`,
              borderRadius: 13, padding: '15px 16px', cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="sliders" size={14} color={T.gold} />
              <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>Policy & autonomy</span>
              <Mono style={{ marginLeft: 'auto', fontSize: 10, color: T.faint }}>tune →</Mono>
            </div>
            <p style={{ margin: '7px 0 0', fontSize: 12, color: T.muted, lineHeight: 1.4 }}>
              Everything legal is gated to you. Widen Litt's autonomy when you're ready.
            </p>
          </button>
          <button
            onClick={() => navigate('/integrations')}
            style={{
              textAlign: 'left', background: T.surface, border: `1px solid ${T.line}`,
              borderRadius: 13, padding: '15px 16px', cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="plug" size={14} color={T.gold} />
              <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>Integrations</span>
              <Mono style={{ marginLeft: 'auto', fontSize: 10, color: T.faint }}>manage →</Mono>
            </div>
            <p style={{ margin: '7px 0 0', fontSize: 12, color: T.muted, lineHeight: 1.4 }}>
              Gmail & Calendar connected via MCP · LEDES export ready
            </p>
          </button>
        </div>

      </div>
    </div>
  );
}

// ── Book card sub-component ─────────────────────────────────────────────────

function BookCardEl({ book, onClick }: { book: BookCard; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const c = book.color;
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        textAlign: 'left', background: T.surface,
        border: `1px solid ${hovered ? c + '66' : T.line}`,
        borderRadius: 13, padding: '15px 16px', cursor: 'pointer',
        transition: 'border-color .15s, transform .06s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
        <span style={{
          width: 28, height: 28, borderRadius: 8,
          background: c + '14', border: `1px solid ${c}33`,
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}>
          <Icon name={book.icon} size={15} color={c} />
        </span>
        <span style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{book.name}</span>
        {book.needsYou > 0 && (
          <Mono style={{
            marginLeft: 'auto', fontSize: 10, color: T.danger,
            background: 'rgba(155,45,35,.1)',
            border: '1px solid rgba(155,45,35,.24)',
            borderRadius: 999, padding: '1px 7px', fontWeight: 600,
          }}>
            {book.needsYou} needs you
          </Mono>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
        <span style={{ fontSize: 24, fontWeight: 600, color: T.ink }}>{book.total}</span>
        <Mono style={{ fontSize: 10.5, color: T.faint }}>tracked</Mono>
      </div>
      <p style={{ margin: '4px 0 0', fontSize: 12, color: T.muted, lineHeight: 1.4 }}>{book.line}</p>
    </button>
  );
}
