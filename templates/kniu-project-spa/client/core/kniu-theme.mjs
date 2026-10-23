const LIGHT_THEME = Object.freeze({
  '--kniu-font-family': '"KniuSans_Regular"',
  '--kniu-color-primary': '#409eff',
  '--kniu-color-primary-hover': '#79bbff',
  '--kniu-color-primary-light': '#ecf5ff',
  '--kniu-color-primary-lighter': '#c6e2ff',
  '--kniu-color-success': '#67c23a',
  '--kniu-color-success-hover': '#95d475',
  '--kniu-color-warning': '#e6a23c',
  '--kniu-color-warning-hover': '#eebe77',
  '--kniu-color-danger': '#f56c6c',
  '--kniu-color-danger-hover': '#f89898',
  '--kniu-color-info': '#909399',
  '--kniu-color-info-hover': '#b1b3b8',
  '--kniu-text-color': '#606266',
  '--kniu-text-color-disabled': '#a8abb2',
  '--kniu-border-color': '#dcdfe6',
  '--kniu-border-color-light': '#e4e7ed',
  '--kniu-fill-color': '#f5f7fa',
  '--kniu-fill-color-dark': '#e9e9eb',
  '--kniu-surface-color': '#fff',
  '--kniu-color-disabled': '#c0c4cc',
  '--kniu-radius': '4px',
  '--kniu-control-height': 'max(28px, calc(40 / var(--kniu_vw)))',
  '--kniu-control-height-small': 'max(28px, calc(28 / var(--kniu_vw)))'
});

const THEME_PRESETS = Object.freeze({
  light: LIGHT_THEME,
  dark: Object.freeze({
    '--kniu-color-primary': '#60a5fa', '--kniu-color-primary-hover': '#93c5fd',
    '--kniu-color-primary-light': '#1e3a5f', '--kniu-color-primary-lighter': '#172554',
    '--kniu-text-color': '#e5e7eb', '--kniu-text-color-disabled': '#6b7280',
    '--kniu-border-color': '#4b5563', '--kniu-border-color-light': '#374151',
    '--kniu-fill-color': '#1f2937', '--kniu-fill-color-dark': '#111827',
    '--kniu-surface-color': '#111827', '--kniu-color-disabled': '#6b7280'
  }),
  ocean: Object.freeze({ '--kniu-color-primary': '#0284c7', '--kniu-color-primary-hover': '#38bdf8', '--kniu-color-primary-light': '#e0f2fe', '--kniu-color-primary-lighter': '#bae6fd', '--kniu-color-success': '#059669', '--kniu-color-warning': '#d97706', '--kniu-fill-color': '#f0f9ff', '--kniu-fill-color-dark': '#e0f2fe', '--kniu-surface-color': '#ffffff' }),
  forest: Object.freeze({ '--kniu-color-primary': '#15803d', '--kniu-color-primary-hover': '#4ade80', '--kniu-color-primary-light': '#dcfce7', '--kniu-color-primary-lighter': '#bbf7d0', '--kniu-color-success': '#16a34a', '--kniu-color-warning': '#ca8a04', '--kniu-fill-color': '#f0fdf4', '--kniu-fill-color-dark': '#dcfce7', '--kniu-surface-color': '#ffffff' }),
  violet: Object.freeze({ '--kniu-color-primary': '#7c3aed', '--kniu-color-primary-hover': '#a78bfa', '--kniu-color-primary-light': '#ede9fe', '--kniu-color-primary-lighter': '#ddd6fe', '--kniu-color-success': '#0f766e', '--kniu-color-warning': '#c2410c', '--kniu-fill-color': '#faf5ff', '--kniu-fill-color-dark': '#f3e8ff', '--kniu-surface-color': '#ffffff' })
});

function resolveTheme(theme = {}) {
  const input = theme && typeof theme === 'object' ? theme : {};
  const preset = typeof input.preset === 'string' ? input.preset : 'light';
  return { ...LIGHT_THEME, ...(THEME_PRESETS[preset] || {}), ...input };
}

export { LIGHT_THEME, THEME_PRESETS, resolveTheme };