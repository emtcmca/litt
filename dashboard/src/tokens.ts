export const T = {
  paper: '#FBFAF6', surface: '#FFFFFF', wash: '#F1EFE8', wash2: '#F8F7F4',
  line: 'rgba(20,20,18,0.12)', soft: 'rgba(20,20,18,0.07)',
  ink: '#2C2C2A', muted: '#6F6D67', faint: '#A9A7A1',
  forest: '#14221F', forestLine: 'rgba(214,193,129,.20)',
  brass: '#D6C181', gold: '#A98435',
  teal: '#1D9E75', tealSoft: 'rgba(29,158,117,.10)',
  danger: '#9B2D23', dangerSoft: '#F6E4DF',
  audit: '#11140F', auditMuted: '#9DA89A', auditAccent: '#9EE1C7',
} as const;

export type TKey = keyof typeof T;
