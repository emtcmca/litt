import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentObservation, AgentRunTimeline } from '../types';
import { runSweep } from '../api';
import { AgentGraph } from '../components/console/AgentGraph';
import { Inspector } from '../components/console/Inspector';
import type { ToolEntry } from '../components/console/Inspector';
import { SweepControls } from '../components/console/SweepControls';

const FIRM_ID = 'strand-okafor';
const PLAYBACK_STEP_MS = 220;

export function AgentConsole() {
  const [tools, setTools]             = useState<ToolEntry[]>([]);
  const [timeline, setTimeline]       = useState<AgentRunTimeline | null>(null);
  const [playbackIdx, setPlaybackIdx] = useState(0);
  const [isRunning, setIsRunning]     = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedObs, setSelectedObs]   = useState<AgentObservation | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const replayTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load tool registry on mount
  useEffect(() => {
    fetch('/api/tools')
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(setTools)
      .catch(() => setTools([]));
  }, []);

  const observations: AgentObservation[] = timeline?.observations ?? [];

  function stopReplay() {
    if (replayTimer.current) {
      clearInterval(replayTimer.current);
      replayTimer.current = null;
    }
    setIsReplaying(false);
  }

  function startReplay(obs: AgentObservation[]) {
    stopReplay();
    setPlaybackIdx(0);
    setIsReplaying(true);
    let i = 0;
    replayTimer.current = setInterval(() => {
      i += 1;
      setPlaybackIdx(i);
      if (i >= obs.length - 1) {
        stopReplay();
      }
    }, PLAYBACK_STEP_MS);
  }

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    setError(null);
    stopReplay();
    try {
      const result = await runSweep(FIRM_ID);
      setTimeline(result.timeline);
      setPlaybackIdx(0);
      startReplay(result.timeline.observations);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sweep failed');
    } finally {
      setIsRunning(false);
    }
  }, []);

  const handleReplay = useCallback(() => {
    if (!timeline) return;
    startReplay(timeline.observations);
  }, [timeline]);

  useEffect(() => () => stopReplay(), []);

  // Sync selectedObs when playback changes
  useEffect(() => {
    if (observations.length > 0 && playbackIdx < observations.length) {
      setSelectedObs(observations[playbackIdx]);
    }
  }, [playbackIdx, observations.length]);

  // Node click → filter inspector to that agent's tools
  function handleNodeSelect(id: string | null) {
    setSelectedNode(id);
    const nodeToAgent: Record<string, string> = {
      deadline_agent: 'deadline_agent',
      billing_agent: 'billing_agent',
      comms_agent: 'comms_agent',
      anomaly_agent: 'anomaly_agent',
      coordinator: 'coordinator',
    };
    if (id && nodeToAgent[id]) {
      // Keep selectedObs so Inspector log still works
    } else {
      // Clicked a signal/output node
    }
  }

  const elapsedSeconds = timeline?.elapsed_seconds ?? undefined;

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1160, height: '100%', minHeight: 0 }}>
      {/* Header */}
      <div>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-tertiary)', marginBottom: 4 }}>
          Agents
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Agent Console
          </h1>
          <SweepControls
            isRunning={isRunning || isReplaying}
            canReplay={!!timeline}
            playbackIndex={playbackIdx}
            totalSteps={observations.length}
            onRun={handleRun}
            onReplay={handleReplay}
            onScrub={i => { stopReplay(); setPlaybackIdx(i); }}
            elapsedSeconds={elapsedSeconds}
          />
        </div>
        {error && (
          <div style={{ fontSize: 12, color: '#9B2D23', marginTop: 6 }}>{error}</div>
        )}
      </div>

      {/* Stats strip from last run */}
      {timeline && (
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { label: 'Observations',   value: timeline.observations.length },
            { label: 'Escalations',    value: timeline.escalations_count },
            { label: 'Brief items',    value: timeline.brief_items_count },
            { label: 'Triggered by',   value: timeline.triggered_by },
          ].map(s => (
            <div key={s.label} style={{
              flex: 1, background: 'var(--color-background-primary)',
              border: '1px solid var(--color-border-tertiary)', borderRadius: 8, padding: '8px 12px',
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Main layout: graph + inspector */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, flex: 1, minHeight: 500 }}>
        {/* Graph */}
        <div style={{
          background: '#14221F',
          border: '1px solid rgba(158,225,199,.1)',
          borderRadius: 10, padding: '16px 20px',
          display: 'flex', flexDirection: 'column', gap: 12,
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(158,225,199,.4)' }}>
              {isReplaying ? 'replaying sweep…' : isRunning ? 'running sweep…' : observations.length > 0 ? `run · ${observations.length} observations` : 'idle — run a sweep to see data flow'}
            </span>
            {selectedNode && (
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#1D9E75' }}>
                {selectedNode}
                <button
                  onClick={() => setSelectedNode(null)}
                  style={{ marginLeft: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(158,225,199,.5)', fontSize: 10 }}
                >
                  ✕
                </button>
              </span>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <AgentGraph
              observations={observations}
              playbackIndex={playbackIdx}
              selectedNode={selectedNode}
              onSelectNode={handleNodeSelect}
            />
          </div>
        </div>

        {/* Inspector */}
        <Inspector
          observations={observations}
          selectedObs={selectedObs}
          selectedAgent={selectedNode && ['deadline_agent','billing_agent','comms_agent','anomaly_agent','coordinator'].includes(selectedNode) ? selectedNode : null}
          tools={tools}
          playbackIndex={playbackIdx}
        />
      </div>
    </div>
  );
}
