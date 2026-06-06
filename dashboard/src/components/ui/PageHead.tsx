import type { ReactNode } from 'react';
import { Mono } from './Mono';
import { T } from '../../tokens';

interface PageHeadProps {
  title: string;
  tag?: string;
  tagColor?: string;
  sub: ReactNode;
}

export function PageHead({ title, tag, tagColor = T.gold, sub }: PageHeadProps) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-.02em', color: T.ink }}>
          {title}
        </h1>
        {tag && (
          <Mono style={{
            fontSize: 10,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '.08em',
            color: tagColor,
            background: `${tagColor}1a`,
            border: `1px solid ${tagColor}44`,
            borderRadius: 5,
            padding: '2px 7px',
          }}>
            {tag}
          </Mono>
        )}
      </div>
      <p style={{ margin: '6px 0 0', fontSize: 14.5, color: T.muted, lineHeight: 1.5, maxWidth: '64ch' }}>
        {sub}
      </p>
    </div>
  );
}
