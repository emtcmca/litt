import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { MatterSummary, TimerCaptureRequest, TimerNormalizeRequest } from '../types';
import { captureTimerEntry, getMatters, normalizeNarrative } from '../api';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'litt_timer_state';

const C = {
  forest:     '#14221F',
  brass:      '#D6C181',
  teal:       '#1D9E75',
  tealSoft:   'rgba(29,158,117,.12)',
  danger:     '#9B2D23',
  dangerSoft: '#F3DED7',
  gold:       '#A98435',
  paper:      'var(--color-background-primary)',
  surface:    '#FFFFFF',
  ink:        'var(--color-text-primary)',
  muted:      'var(--color-text-secondary)',
  line:       'var(--color-border-tertiary)',
  soft:       'rgba(0,0,0,0.06)',
} as const;

// ---------------------------------------------------------------------------
// State types
// ---------------------------------------------------------------------------

type TimerStatus = 'idle' | 'running' | 'confirming' | 'done';

interface TimerState {
  status: TimerStatus;
  matterId: string | null;
  matterName: string | null;
  clientId: string | null;
  description: string;
  startedAtEpochMs: number | null;
  elapsedMsAccumulated: number;
  normalizedNarrative: string | null;
  usedGemini: boolean;
  idempotencyKey: string | null;
}

const IDLE_STATE: TimerState = {
  status: 'idle',
  matterId: null,
  matterName: null,
  clientId: null,
  description: '',
  startedAtEpochMs: null,
  elapsedMsAccumulated: 0,
  normalizedNarrative: null,
  usedGemini: false,
  idempotencyKey: null,
};

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

function loadTimerState(): TimerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return IDLE_STATE;
    return { ...IDLE_STATE, ...JSON.parse(raw) };
  } catch {
    return IDLE_STATE;
  }
}

function saveTimerState(state: TimerState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage unavailable — continue without persistence
  }
}

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

function computeElapsedMs(state: TimerState): number {
  if (state.status === 'running' && state.startedAtEpochMs != null) {
    return state.elapsedMsAccumulated + (Date.now() - state.startedAtEpochMs);
  }
  return state.elapsedMsAccumulated;
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function computeHoursLabel(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60000));
  const hours = Math.ceil(minutes / 6) * 6 / 60;
  return `${hours.toFixed(1)} hrs`;
}

function generateKey(): string {
  return `timer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TimerHUDProps {
  firmId: string;
  attorneyId: string;
}

export function TimerHUD({ firmId, attorneyId }: TimerHUDProps) {
  const [state, setState] = useState<TimerState>(loadTimerState);
  const [displayMs, setDisplayMs] = useState(() => computeElapsedMs(loadTimerState()));
  const [expanded, setExpanded] = useState(() => loadTimerState().status !== 'idle');

  const [matters, setMatters] = useState<MatterSummary[] | null>(null);
  const [mattersLoading, setMattersLoading] = useState(false);
  const [mattersError, setMattersError] = useState(false);

  const [normalizing, setNormalizing] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [descError, setDescError] = useState(false);
  const [doneEntryId, setDoneEntryId] = useState<string | null>(null);

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // Persist state to localStorage on every change
  useEffect(() => { saveTimerState(state); }, [state]);

  // Tick interval
  useEffect(() => {
    if (state.status !== 'running') return;
    const id = setInterval(() => setDisplayMs(computeElapsedMs(stateRef.current)), 1000);
    return () => clearInterval(id);
  }, [state.status]);

  // Sync displayMs when state changes
  useEffect(() => {
    setDisplayMs(computeElapsedMs(state));
  }, [state.status, state.elapsedMsAccumulated, state.startedAtEpochMs]);

  // Auto-dismiss done state after 3 seconds
  useEffect(() => {
    if (state.status !== 'done') return;
    const id = setTimeout(() => {
      setState(IDLE_STATE);
      setExpanded(false);
      setDoneEntryId(null);
    }, 3000);
    return () => clearTimeout(id);
  }, [state.status]);

  const loadMatters = useCallback(async () => {
    if (matters !== null || mattersLoading) return;
    setMattersLoading(true);
    setMattersError(false);
    try {
      setMatters(await getMatters(firmId));
    } catch {
      setMattersError(true);
    } finally {
      setMattersLoading(false);
    }
  }, [firmId, matters, mattersLoading]);

  function handleIdleClick() {
    setExpanded(true);
    loadMatters();
  }

  function handleMatterChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const selected = matters?.find(m => m.id === e.target.value) ?? null;
    setState(prev => ({
      ...prev,
      matterId: selected?.id ?? null,
      matterName: selected?.name ?? null,
      clientId: selected?.client_id ?? null,
    }));
  }

  function handleStart() {
    if (!state.matterId) return;
    setState(prev => ({
      ...prev,
      status: 'running',
      startedAtEpochMs: Date.now(),
      elapsedMsAccumulated: 0,
      idempotencyKey: generateKey(),
    }));
  }

  async function handleStop() {
    if (!state.description.trim()) {
      setDescError(true);
      return;
    }
    setDescError(false);

    const elapsedMs = computeElapsedMs(stateRef.current);
    const sessionMinutes = Math.max(1, Math.round(elapsedMs / 60000));

    setState(prev => ({
      ...prev,
      status: 'confirming',
      elapsedMsAccumulated: elapsedMs,
      startedAtEpochMs: null,
      normalizedNarrative: null,
      usedGemini: false,
    }));
    setNormalizing(true);

    try {
      const req: TimerNormalizeRequest = {
        firm_id: firmId,
        attorney_id: attorneyId,
        matter_id: state.matterId!,
        matter_name: state.matterName!,
        raw_description: state.description,
        session_minutes: sessionMinutes,
      };
      const result = await normalizeNarrative(req);
      setState(prev => ({
        ...prev,
        normalizedNarrative: result.normalized_narrative,
        usedGemini: result.used_gemini,
      }));
    } catch {
      setState(prev => ({
        ...prev,
        normalizedNarrative: prev.description,
        usedGemini: false,
      }));
    } finally {
      setNormalizing(false);
    }
  }

  async function handleConfirm() {
    const sessionMinutes = Math.max(1, Math.round(state.elapsedMsAccumulated / 60000));
    setCaptureError(null);
    setCapturing(true);
    try {
      const req: TimerCaptureRequest = {
        firm_id: firmId,
        matter_id: state.matterId!,
        attorney_id: attorneyId,
        session_minutes: sessionMinutes,
        narrative: state.normalizedNarrative || state.description,
        used_gemini: state.usedGemini,
        idempotency_key: state.idempotencyKey ?? generateKey(),
      };
      const result = await captureTimerEntry(req);
      if (result.success) {
        setDoneEntryId(result.entity_id);
        setState({ ...IDLE_STATE, status: 'done' });
      } else {
        setCaptureError(result.message || 'Save failed');
      }
    } catch (err) {
      setCaptureError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setCapturing(false);
    }
  }

  function handleDiscard() {
    const elapsed = computeElapsedMs(stateRef.current);
    if (elapsed > 5000) {
      if (!window.confirm(`Discard ${formatElapsed(elapsed)} of recorded time?`)) return;
    }
    setState(IDLE_STATE);
    setExpanded(false);
    setDescError(false);
    setCaptureError(null);
  }

  // ---------------------------------------------------------------------------
  // Shared layout styles
  // ---------------------------------------------------------------------------

  const base: CSSProperties = {
    position: 'fixed',
    bottom: 24,
    right: 24,
    zIndex: 9999,
    fontFamily: "'IBM Plex Sans', sans-serif",
    fontSize: 13,
  };

  const card: CSSProperties = {
    background: C.paper,
    border: `1px solid ${C.line}`,
    borderRadius: 10,
    boxShadow: '0 4px 24px rgba(0,0,0,0.14)',
    width: 300,
    overflow: 'hidden',
  };

  const btnBase: CSSProperties = {
    fontFamily: "'IBM Plex Sans', sans-serif",
    fontSize: 12,
    fontWeight: 600,
    border: 'none',
    borderRadius: 6,
    padding: '7px 14px',
    cursor: 'pointer',
  };

  // ---------------------------------------------------------------------------
  // DONE state
  // ---------------------------------------------------------------------------

  if (state.status === 'done') {
    return (
      <div style={base}>
        <div style={{ ...card, background: C.teal, border: 'none', padding: '14px 16px' }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
            ✓ Entry created
          </div>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginBottom: 2 }}>
            {doneEntryId} · PENDING
          </div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>
            Appears in next sweep
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // IDLE — pill button only
  // ---------------------------------------------------------------------------

  if (state.status === 'idle' && !expanded) {
    return (
      <div style={base}>
        <button
          onClick={handleIdleClick}
          style={{
            ...btnBase,
            background: C.forest,
            color: '#fff',
            borderRadius: 20,
            padding: '10px 18px',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            boxShadow: '0 2px 12px rgba(0,0,0,0.22)',
          }}
        >
          ▶ Start Timer
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // IDLE expanded — matter select + start
  // ---------------------------------------------------------------------------

  if (state.status === 'idle' && expanded) {
    return (
      <div style={base}>
        <div style={card}>
          <div style={{ padding: '12px 14px 10px', borderBottom: `1px solid ${C.soft}` }}>
            <div style={{ fontWeight: 700, color: C.forest, fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              New Time Entry
            </div>
          </div>
          <div style={{ padding: '12px 14px' }}>
            {mattersError ? (
              <div style={{ fontSize: 12, color: C.danger, marginBottom: 10 }}>
                Unable to load matters.{' '}
                <button onClick={() => { setMattersError(false); setMatters(null); loadMatters(); }}
                  style={{ ...btnBase, padding: '2px 8px', background: 'transparent', color: C.danger, textDecoration: 'underline', fontWeight: 400 }}>
                  Retry
                </button>
              </div>
            ) : (
              <select
                value={state.matterId ?? ''}
                onChange={handleMatterChange}
                disabled={mattersLoading}
                style={{
                  width: '100%',
                  fontSize: 13,
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  padding: '7px 10px',
                  border: `1px solid ${C.line}`,
                  borderRadius: 6,
                  background: C.surface,
                  color: state.matterId ? C.ink : C.muted,
                  marginBottom: 10,
                  appearance: 'none',
                }}
              >
                <option value="">{mattersLoading ? 'Loading matters…' : 'Select a matter…'}</option>
                {(matters ?? []).map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            )}
            <textarea
              placeholder="Brief description (required before stopping)"
              value={state.description}
              onChange={e => setState(prev => ({ ...prev, description: e.target.value }))}
              rows={2}
              style={{
                width: '100%',
                fontSize: 12,
                fontFamily: "'IBM Plex Sans', sans-serif",
                padding: '7px 10px',
                border: `1px solid ${C.line}`,
                borderRadius: 6,
                resize: 'none',
                marginBottom: 10,
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <button onClick={handleDiscard}
                style={{ ...btnBase, background: 'transparent', color: C.muted, fontWeight: 400, fontSize: 12 }}>
                Cancel
              </button>
              <button
                onClick={handleStart}
                disabled={!state.matterId || mattersLoading}
                style={{
                  ...btnBase,
                  background: state.matterId ? C.forest : C.soft,
                  color: state.matterId ? '#fff' : C.muted,
                  cursor: state.matterId ? 'pointer' : 'not-allowed',
                }}
              >
                Start ▶
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RUNNING state
  // ---------------------------------------------------------------------------

  if (state.status === 'running') {
    return (
      <div style={base}>
        <div style={card}>
          <div style={{ padding: '10px 14px 8px', background: C.forest, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{
                display: 'inline-block',
                width: 8, height: 8,
                borderRadius: '50%',
                background: '#EF4444',
                animation: 'litt-pulse 1.4s ease-in-out infinite',
              }} />
              <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em' }}>
                RECORDING
              </span>
            </div>
            <button onClick={handleDiscard}
              style={{ ...btnBase, background: 'transparent', color: 'rgba(255,255,255,0.5)', padding: '2px 6px', fontWeight: 400, fontSize: 11 }}>
              Discard
            </button>
          </div>
          <div style={{ padding: '10px 14px' }}>
            <div style={{ color: C.brass, fontSize: 12, fontWeight: 600, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {state.matterName}
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 30, fontWeight: 700, color: C.forest, letterSpacing: '0.02em', marginBottom: 10 }}>
              {formatElapsed(displayMs)}
            </div>
            <div>
              <textarea
                placeholder="What are you working on?"
                value={state.description}
                onChange={e => { setState(prev => ({ ...prev, description: e.target.value })); setDescError(false); }}
                rows={2}
                style={{
                  width: '100%',
                  fontSize: 12,
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  padding: '7px 10px',
                  border: `1px solid ${descError ? C.danger : C.line}`,
                  borderRadius: 6,
                  resize: 'none',
                  marginBottom: 4,
                  boxSizing: 'border-box',
                }}
              />
              {descError && (
                <div style={{ fontSize: 11, color: C.danger, marginBottom: 6 }}>
                  Description required before stopping
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handleStop}
                style={{ ...btnBase, background: C.danger, color: '#fff' }}
              >
                ■ Stop
              </button>
            </div>
          </div>
        </div>
        <style>{`
          @keyframes litt-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
        `}</style>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // CONFIRMING state (normalizing sub-state handled via normalizing flag)
  // ---------------------------------------------------------------------------

  return (
    <div style={base}>
      <div style={card}>
        <div style={{ padding: '10px 14px 8px', background: C.forest, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em' }}>
            REVIEW ENTRY
          </span>
          <span style={{ color: C.brass, fontSize: 12 }}>
            {state.matterName && state.matterName.length > 22
              ? state.matterName.slice(0, 22) + '…'
              : state.matterName} · {computeHoursLabel(state.elapsedMsAccumulated)}
          </span>
        </div>

        <div style={{ padding: '12px 14px' }}>
          {/* Raw description */}
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            Your note
          </div>
          <div style={{ fontSize: 12, color: C.ink, background: C.soft, borderRadius: 5, padding: '6px 10px', marginBottom: 10, lineHeight: 1.45 }}>
            {state.description}
          </div>

          {/* Litt-normalized narrative */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: C.gold, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>✦ Litt</span>
            {normalizing && <span style={{ fontSize: 11, color: C.muted }}>normalizing…</span>}
          </div>
          {normalizing ? (
            <div style={{ fontSize: 12, color: C.muted, background: C.soft, borderRadius: 5, padding: '6px 10px', marginBottom: 10 }}>
              …
            </div>
          ) : (
            <textarea
              value={state.normalizedNarrative ?? state.description}
              onChange={e => setState(prev => ({ ...prev, normalizedNarrative: e.target.value }))}
              rows={3}
              style={{
                width: '100%',
                fontSize: 12,
                fontFamily: "'IBM Plex Sans', sans-serif",
                padding: '7px 10px',
                border: `1px solid ${C.line}`,
                borderRadius: 6,
                resize: 'none',
                marginBottom: 10,
                boxSizing: 'border-box',
                lineHeight: 1.45,
              }}
            />
          )}

          {captureError && (
            <div style={{ fontSize: 12, color: C.danger, marginBottom: 8 }}>
              {captureError} — retry below
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <button onClick={handleDiscard}
              style={{ ...btnBase, background: 'transparent', color: C.muted, fontWeight: 400, fontSize: 12 }}>
              Discard
            </button>
            <button
              onClick={handleConfirm}
              disabled={capturing || normalizing || !state.normalizedNarrative}
              style={{
                ...btnBase,
                background: (capturing || normalizing || !state.normalizedNarrative) ? C.soft : C.teal,
                color: (capturing || normalizing || !state.normalizedNarrative) ? C.muted : '#fff',
                cursor: (capturing || normalizing || !state.normalizedNarrative) ? 'not-allowed' : 'pointer',
              }}
            >
              {capturing ? 'Saving…' : 'Confirm ✓'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
