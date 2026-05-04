// toollab-design-system v2 토큰 (~/.claude/skills/toollab-design-system/SKILL.md 기반)
// 변경 시 스킬 파일과 동기화 필요

export const colors = {
  // Primary (메인 블루)
  primary: '#185FA5',
  primaryDark: '#0C447C',
  primaryLight: '#E6F1FB',

  // Background
  bg: '#FFFFFF',
  bgSecondary: '#F4F6FA',
  bgTertiary: '#EAECF2',

  // Text
  text: '#1A1D23',
  textSecondary: '#5A6070',
  textHint: '#9BA3B2',

  // Border
  border: '#DDE1EB',
  borderStrong: '#B0B8CC',

  // Semantic
  success: '#1D9E75',
  successBg: '#E1F5EE',
  warning: '#EF9F27',
  warningBg: '#FAEEDA',
  danger: '#CC2222',
  dangerBg: '#FCEBEB',
  dangerDark: '#A81A1A',

  // Channel
  storefarm: '#1D9E75',
  openmarket: '#185FA5',
  ssg: '#E8B530',

  // Section header (다크 헤더 전용)
  sectionHeaderBg: '#1A1D23',
  sectionHeaderText: '#FFFFFF',
} as const;

export const fonts = {
  family: 'Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif',
  mono: 'ui-monospace, "SF Mono", Menlo, monospace',

  // 크기 / 굵기
  pageTitle: { size: '22px', weight: 700 },
  sectionHeader: { size: '18px', weight: 600 },
  panelHeader: { size: '15px', weight: 600 },
  body: { size: '14px', weight: 400 },
  bodySm: { size: '12px', weight: 400 },
  label: { size: '12px', weight: 400 },
  kpi: { size: '26px', weight: 700 },
  cardLargeNum: { size: '22px', weight: 600 },
  tableHeader: { size: '13px', weight: 500 },
  tableCell: { size: '13px', weight: 400 },

  // line-height
  tight: 1.2,
  normal: 1.45,
  loose: 1.6,

  // 숫자 표기 (tabular-nums)
  numericFeatureSettings: '"tnum" 1, "ss01" 1',
} as const;

export const spacing = {
  s1: '4px',
  s2: '8px',
  s3: '12px',
  s4: '16px',
  s5: '24px',
  s6: '32px',
  s7: '48px',
} as const;

export const radius = {
  sm: '4px',
  base: '6px',
  lg: '8px',
  pill: '999px',
} as const;

export const borders = {
  base: `1px solid ${colors.border}`,
  focus: `2px solid ${colors.primary}`,
} as const;

export const shadows = {
  pop: '0 4px 12px rgba(26, 29, 35, 0.08)',
  modal: '0 20px 48px rgba(26, 29, 35, 0.18)',
} as const;

export const motion = {
  durInstant: '0ms',
  durFast: '120ms',
  ease: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
} as const;

// UI 구조 표준
export const ui = {
  sectionHeaderHeight: '44px',
  gnbHeight: '52px',
  tableHeaderHeight: '36px',
  buttonHeight: {
    xs: '24px',
    sm: '28px',
    md: '32px',
    lg: '40px',
  },
  maxContentWidth: '1320px',
  gridGap: '16px',
} as const;
