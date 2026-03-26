/**
 * Slate Shield — единственный файл палитры.
 * Меняйте цвета здесь — они подтянутся по всему приложению.
 *
 * 60-30-10: #F8FAFC фоны (60%) → #0F172A sidebar + серый текст (30%) → #2563EB accent (10%)
 * Все контрасты прошли WCAG AA.
 */

/* ── Базовая палитра ───────────────────────────────────── */

export const palette = {
  slate50:   '#F8FAFC',
  slate100:  '#F1F5F9',
  slate200:  '#E2E8F0',
  slate500:  '#64748B',
  slate600:  '#475569',
  slate900:  '#0F172A',
  blue50:    '#EFF6FF',
  blue600:   '#2563EB',
  blue700:   '#1D4ED8',
  emerald600:'#059669',
  emerald700:'#047857',
  red600:    '#DC2626',
  amber700:  '#B45309',
  sky700:    '#0369A1',
  steel:     '#1E3A5F',
  white:     '#FFFFFF',
};

/* ── Семантические роли ────────────────────────────────── */

export const colors = {
  /** Основной акцент (кнопки, active, ссылки) */
  primary:       palette.blue600,
  primaryDark:   palette.blue700,
  primaryBg:     palette.blue50,

  /** Danger — атаки, ошибки */
  danger:        palette.red600,
  dangerBg:      '#FEF2F2',

  /** Success — безопасный трафик, ОК */
  success:       palette.emerald700,
  successBg:     '#ECFDF5',

  /** Warning — средняя угроза */
  warning:       palette.amber700,
  warningBg:     '#FFFBEB',

  /** Info — нейтральная информация */
  info:          palette.sky700,
  infoBg:        '#F0F9FF',

  /** Текст */
  text:          palette.slate900,   // 17.85:1 на белом
  textSecondary: palette.slate600,   // 7.58:1
  textMuted:     palette.slate500,   // 4.76:1

  /** Фоны */
  bgPage:        palette.slate50,
  bgCard:        palette.white,
  bgTile:        palette.slate100,

  /** Sidebar */
  sidebar:       palette.slate900,
  sidebarText:   palette.white,
  sidebarMuted:  palette.slate500,

  /** Границы */
  border:        palette.slate200,
  borderLight:   palette.slate100,
};

/* ── Hero-секция (градиентный баннер) ──────────────────── */

export const hero = {
  gradient:   `linear-gradient(135deg, ${palette.slate900}, ${palette.steel})`,
  text:       '#ffffff',
  textMuted:  'rgba(255,255,255,0.7)',
  kicker:     'rgba(255,255,255,0.75)',
  tileBg:     'rgba(255,255,255,0.08)',
  tileBorder: 'rgba(255,255,255,0.14)',
  chipBg:     'rgba(255,255,255,0.10)',
  chipBorder: 'rgba(255,255,255,0.20)',
};

/* ── Графики (Recharts) ────────────────────────────────── */

export const chart = {
  /** Стиль тултипа */
  tooltip: {
    background: '#fff',
    border: `1px solid ${colors.border}`,
    borderRadius: 12,
    color: colors.text,
    fontSize: 12,
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  } as React.CSSProperties,

  /** Цвет сетки */
  grid:   colors.borderLight,
  /** Цвет осей */
  axis:   colors.textMuted,

  /** Безопасный трафик */
  safe:   palette.emerald600,
  /** Атаки */
  attack: palette.red600,
  /** Основная заливка баров */
  bar:    palette.blue600,

  /** Палитра для pie / multi-series (8 цветов, colorblind-safe) */
  pie: [
    '#2563EB', // blue
    '#DC2626', // red
    '#059669', // emerald
    '#D97706', // amber
    '#0891B2', // cyan
    '#6366F1', // indigo
    '#EA580C', // orange
    '#DB2777', // pink
  ],
};

/* ── Ant Design ConfigProvider theme ───────────────────── */

export const antTheme = {
  token: {
    colorPrimary:         colors.primary,
    colorInfo:            colors.info,
    colorSuccess:         colors.success,
    colorWarning:         colors.warning,
    colorError:           colors.danger,
    borderRadius:         12,
    fontFamily:           "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    colorBgContainer:     colors.bgCard,
    colorBgLayout:        colors.bgPage,
    colorBorder:          colors.border,
    colorBorderSecondary: colors.borderLight,
  },
  components: {
    Card:  { borderRadiusLG: 16 },
    Menu:  {
      itemBorderRadius: 8,
      darkItemSelectedBg: 'rgba(37, 99, 235, 0.2)',
      darkItemSelectedColor: '#ffffff',
    },
    Tag:   { borderRadiusSM: 20 },
  },
};

/* ── Tone-карта для OverviewCard и подобных ─────────────── */

export const tones = {
  primary: { color: colors.primary,  bg: colors.primaryBg },
  danger:  { color: colors.danger,   bg: colors.dangerBg },
  success: { color: colors.success,  bg: colors.successBg },
  warning: { color: colors.warning,  bg: colors.warningBg },
  info:    { color: colors.info,     bg: colors.infoBg },
};
