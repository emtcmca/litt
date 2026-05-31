import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { AgentObservation, AgentRunTimeline as AgentRunTimelineType } from '../types';
import './AgentRunTimeline.css';

const PLAYBACK_MS = 250;

// ─── Gate badge — 4-gate model ────────────────────────────────────────────────

const GATE_SPEC: Record<string, { bg: string; color: string }> = {
  AUTO_SAFE:       { bg: 'var(--color-ramp-teal-200)',  color: 'var(--color-ramp-teal-900)' },
  REVIEW_REQUIRED: { bg: 'var(--color-ramp-blue-200)',  color: 'var(--color-ramp-blue-900)' },
  ESCALATION:      { bg: 'var(--color-ramp-amber-200)', color: 'var(--color-ramp-amber-900)' },
  BLOCKED:         { bg: 'var(--color-ramp-red-400)',   color: '#FFFFFF' },
};

// work_kind chips — judges see exactly where Gemini operates
const WORK_KIND_SPEC: Record<string, { label: string; color: string }> = {
  deterministic: { label: 'det',        color: 'var(--color-text-tertiary)' },
  llm_assisted:  { label: 'gemini',     color: 'var(--color-ramp-blue-600)' },
  tool_write:    { label: 'tool write', color: 'var(--color-ramp-teal-600)' },
  human_gate:    { label: 'human gate', color: 'var(--color-ramp-amber-600)' },
};

function GateBadge({ level }: { level: string }) {
  const spec = GATE_SPEC[level] ?? GATE_SPEC.AUTO_SAFE;
  return (
    <span style={{
      display: 'inline-block',
      background: spec.bg,
      color: spec.color,
      padding: '2px 6px',
      borderRadius: 'var(--border-radius-md)',
      fontSize: 10,
      fontWeight: 500,
      fontFamily: 'var(--font-mono)',
      lineHeight: 1.4,
      flexShrink: 0,
      letterSpacing: '0.02em',
    }}>
      {level.replace(/_/g, ' ')}
    </span>
  );
}

function WorkKindChip({ kind }: { kind: string }) {
  const spec = WORK_KIND_SPEC[kind] ?? WORK_KIND_SPEC.deterministic;
  return (
    <span style={{
      fontSize: 10,
      fontFamily: 'var(--font-mono)',
      color: spec.color,
      flexShrink: 0,
    }}>
      {spec.label}
    </span>
  );
}

// ─── Single observation row ───────────────────────────────────────────────────

function ObservationRow({ obs }: { obs: AgentObservation }) {
  const needsAction = obs.commitment_level === 'ESCALATION' || obs.commitment_level === 'BLOCKED';
  const actionBg = obs.commitment_level === 'BLOCKED'
    ? 'var(--color-background-danger)'
    : 'var(--color-background-warning)';
  const actionBorder = obs.commitment_level === 'BLOCKED'
    ? 'var(--color-border-danger)'
    : 'var(--color-border-warning)';
  const actionColor = obs.commitment_level === 'BLOCKED'
    ? 'var(--color-text-danger)'
    : 'var(--color-text-warning)';

  return (
    <div className="litt-obs-item" style={{
      padding: '8px 12px',
      borderBottom: '0.5px solid var(--color-border-tertiary)',
    }}>
      {/* Meta row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
        <GateBadge level={obs.commitment_level} />
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)', flexShrink: 0 }}>
          {obs.agent_name}
        </span>
        <span style={{ fontSize: 10, color: 'var(--color-border-tertiary)' }}>·</span>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)', flexShrink: 0 }}>
          {obs.observation_type.toLowerCase().replace(/_/g, '_')}
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {obs.confidence != null && (
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)' }}>
              {Math.round(obs.confidence * 100)}%
            </span>
          )}
          <WorkKindChip kind={obs.work_kind} />
        </span>
      </div>

      {/* Description */}
      <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.4 }}>
        {obs.description}
      </p>

      {/* Attorney next action — only for ESCALATION and BLOCKED */}
      {needsAction && obs.attorney_next_action && (
        <div style={{
          marginTop: 6,
          padding: '5px 8px',
          background: actionBg,
          borderLeft: `2px solid ${actionBorder}`,
          borderRadius: '0 var(--border-radius-md) var(--border-radius-md) 0',
          fontSize: 12,
          color: actionColor,
          lineHeight: 1.4,
        }}>
          <strong style={{ fontWeight: 500 }}>Attorney action:</strong> {obs.attorney_next_action}
        </div>
      )}
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function TimelineHeader({
  timeline,
  displayed,
  isPlaying,
}: {
  timeline: AgentRunTimelineType;
  displayed: AgentObservation[];
  isPlaying: boolean;
}) {
  const gateCount = displayed.filter(
    o => o.commitment_level === 'ESCALATION' || o.commitment_level === 'BLOCKED'
  ).length;

  const statusStyle: CSSProperties = isPlaying
    ? { color: 'var(--color-ramp-teal-600)', background: 'var(--color-ramp-teal-50)', border: '0.5px solid var(--color-ramp-teal-200)' }
    : { color: 'var(--color-text-tertiary)', background: 'var(--color-background-secondary)', border: '0.5px solid var(--color-border-tertiary)' };

  return (
    <div style={{
      padding: '10px 14px',
      borderBottom: '0.5px solid var(--color-border-tertiary)',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      background: 'var(--color-background-secondary)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-info)', marginBottom: 3 }}>
          AGENT RUN TIMELINE
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-text-tertiary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200,
          }}>
            {timeline.run_id}
          </span>
          <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
            {timeline.elapsed_seconds.toFixed(1)}s
          </span>
          {gateCount > 0 && (
            <span style={{
              fontSize: 11, fontFamily: 'var(--font-mono)',
              background: 'var(--color-ramp-amber-200)', color: 'var(--color-ramp-amber-900)',
              padding: '1px 6px', borderRadius: 'var(--border-radius-md)',
            }}>
              {gateCount} gate{gateCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
          {displayed.length}/{timeline.observations.length}
        </span>
        <span style={{
          fontSize: 11, fontFamily: 'var(--font-mono)',
          padding: '2px 7px', borderRadius: 'var(--border-radius-md)',
          ...statusStyle,
        }}>
          {isPlaying ? 'streaming…' : 'complete'}
        </span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  timeline: AgentRunTimelineType;
}

export function AgentRunTimeline({ timeline }: Props) {
  const [displayed, setDisplayed] = useState<AgentObservation[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const indexRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Restart playback whenever timeline changes (new sweep)
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setDisplayed([]);
    setIsPlaying(true);
    indexRef.current = 0;

    if (timeline.observations.length === 0) {
      setIsPlaying(false);
      return;
    }

    timerRef.current = setInterval(() => {
      const i = indexRef.current;
      setDisplayed(prev => [...prev, timeline.observations[i]]);
      indexRef.current = i + 1;
      if (indexRef.current >= timeline.observations.length) {
        if (timerRef.current) clearInterval(timerRef.current);
        setIsPlaying(false);
      }
    }, PLAYBACK_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeline]);

  // Auto-scroll to bottom as observations drip in
  useEffect(() => {
    if (displayed.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [displayed.length]);

  return (
    <div style={{
      background: 'var(--color-background-primary)',
      border: '0.5px solid var(--color-border-tertiary)',
      borderRadius: 'var(--border-radius-lg)',
      overflow: 'hidden',
    }}>
      <TimelineHeader timeline={timeline} displayed={displayed} isPlaying={isPlaying} />

      <div style={{ maxHeight: 380, overflowY: 'auto' }}>
        {displayed.length === 0 ? (
          <div style={{ padding: '20px 14px', textAlign: 'center', fontSize: 13, color: 'var(--color-text-tertiary)' }}>
            Initializing agent run…
          </div>
        ) : (
          displayed.map(obs => (
            <ObservationRow key={obs.observation_id} obs={obs} />
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
