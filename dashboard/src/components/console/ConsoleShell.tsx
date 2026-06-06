import type { ReactNode } from 'react';
import { ConsoleRail } from './ConsoleRail';
import { DemoBanner } from '../DemoBanner';

const DEMO_FIRM_NAME = 'Strand & Okafor LLP';
const DEMO_DATE      = '2026-06-25';

interface ConsoleShellProps {
  children: ReactNode;
  badges?: Record<string, number>;
}

export function ConsoleShell({ children, badges }: ConsoleShellProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <DemoBanner firmName={DEMO_FIRM_NAME} demoDate={DEMO_DATE} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <ConsoleRail badges={badges} />
        <main style={{
          flex:       1,
          overflowY:  'auto',
          background: 'var(--color-background-tertiary)',
          minWidth:   0,
        }}>
          {children}
        </main>
      </div>
    </div>
  );
}
