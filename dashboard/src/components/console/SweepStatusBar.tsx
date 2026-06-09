import { T } from '../../tokens';

export type SweepSource = 'live-api' | 'demo-fixture';
export type SweepPhase  = 'idle' | 'loading' | 'playing' | 'complete' | 'error';

interface Props {
  phase: SweepPhase;
  source: SweepSource | null;
  stepCount: number;
  handledCount: number;
  surfacedCount: number;
}

export function SweepStatusBar({ phase, source, handledCount, surfacedCount }: Props) {
  if (phase === 'idle') return null;

  let dot: string      = T.teal;
  let text: string     = '';
  let textColor: string = T.faint;
  let pulse            = false;

  if (phase === 'loading') {
    dot = T.teal; text = 'Starting closeout sweep...'; textColor = T.faint; pulse = true;
  } else if (phase === 'playing') {
    if (source === 'live-api') {
      dot = '#2dba7e'; text = 'Running live sweep'; textColor = T.teal;
    } else {
      dot = T.gold; text = 'Playing deterministic demo trace'; textColor = T.gold;
    }
  } else if (phase === 'complete') {
    if (source === 'live-api') {
      dot = T.teal;
      text = `Sweep complete · ${handledCount} handled, ${surfacedCount} for review`;
      textColor = T.teal;
    } else {
      dot = T.faint;
      text = `Demo trace complete · ${handledCount} handled, ${surfacedCount} for review`;
      textColor = T.muted;
    }
  } else {
    dot = T.danger; text = 'Sweep playback failed — refresh and try again'; textColor = T.danger;
  }

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      height: 28,
      padding: '0 10px',
      borderRadius: 999,
      border: `1px solid ${dot}33`,
      background: `${dot}0d`,
      maxWidth: 320,
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      <span
        className={pulse ? 'litt-pulse' : undefined}
        style={{ width: 6, height: 6, borderRadius: 999, background: dot, flexShrink: 0 }}
      />
      <span style={{
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        color: textColor,
        whiteSpace: 'nowrap' as const,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {text}
      </span>
    </div>
  );
}
