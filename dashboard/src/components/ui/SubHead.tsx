import type { ReactNode } from 'react';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { T } from '../../tokens';

interface SubHeadProps {
  icon: IconName;
  title: string;
  sub?: ReactNode;
  count?: string;
  tone: string;
}

export function SubHead({ icon, title, sub, count, tone }: SubHeadProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 6 }}>
      <span style={{
        width: 30, height: 30, borderRadius: 8,
        background: `${tone}14`, border: `1px solid ${tone}33`,
        display: 'grid', placeItems: 'center', flexShrink: 0,
      }}>
        <Icon name={icon} size={15} color={tone} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: '-.01em', color: T.ink }}>
            {title}
          </h2>
          {count && (
            <span style={{
              fontSize: 11.5, color: tone, background: `${tone}12`,
              border: `1px solid ${tone}30`, borderRadius: 999, padding: '1px 8px',
              fontWeight: 600,
            }}>
              {count}
            </span>
          )}
        </div>
        {sub && (
          <p style={{ margin: '2px 0 0', fontSize: 13, color: T.muted, lineHeight: 1.45 }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}
