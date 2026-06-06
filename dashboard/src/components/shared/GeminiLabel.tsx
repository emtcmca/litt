/**
 * GeminiLabel — inline badge shown on any AI-enriched brief item.
 * Always visible (not a tooltip). Never gates attorney action.
 */

interface GeminiLabelProps {
  /** Optional context tooltip text */
  title?: string;
  size?: 'sm' | 'md';
}

export function GeminiLabel({ title = 'Gemini 2.5 Pro enrichment', size = 'sm' }: GeminiLabelProps) {
  const fontSize = size === 'md' ? 10 : 9;
  const padding  = size === 'md' ? '2px 7px' : '1px 5px';

  return (
    <span
      title={title}
      style={{
        display:       'inline-flex',
        alignItems:    'center',
        gap:           3,
        background:    '#FFFBEB',
        border:        '1px solid #FDE68A',
        color:         '#92400E',
        borderRadius:  3,
        padding,
        fontSize,
        fontWeight:    700,
        fontFamily:    'var(--font-mono)',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        whiteSpace:    'nowrap',
        flexShrink:    0,
      }}
    >
      ✦ Gemini
    </span>
  );
}
