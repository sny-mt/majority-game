'use client'

import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'

// 🎨 Zenn風ミニマルデザインシステム
const designSystem = {
  // カラーパレット（彩度を抑えた統一感のある配色）
  colors: {
    primary: '#3b82f6',      // アクセントブルー（唯一の彩度高めカラー）
    primaryLight: '#60a5fa',
    primaryDark: '#2563eb',
    secondary: '#6b7280',    // グレー（補助情報）
    success: '#059669',      // 落ち着いたグリーン
    successLight: '#d1fae5',
    warning: '#d97706',      // 落ち着いたオレンジ
    warningLight: '#fef3c7',
    error: '#dc2626',        // 落ち着いたレッド
    background: '#fafafa',   // ほぼ白の背景
    surface: '#ffffff',      // 純白のカード
    textPrimary: '#1f2937',  // ダークグレー（黒に近いが柔らか）
    textSecondary: '#6b7280', // ミディアムグレー
    border: '#e5e7eb',       // 薄いグレーボーダー
  },
  // スペーシング（Zenn風の広めの余白）
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    '2xl': 48,
    '3xl': 64,
  },
  // タイポグラフィ（読みやすさ重視）
  typography: {
    h1: { size: '1.875rem', weight: 700, letterSpacing: '-0.025em' },
    h2: { size: '1.5rem', weight: 700, letterSpacing: '-0.02em' },
    h3: { size: '1.25rem', weight: 600, letterSpacing: '-0.01em' },
    h4: { size: '1.125rem', weight: 600, letterSpacing: '0' },
    body: { size: '1rem', weight: 400, letterSpacing: '0' },
    small: { size: '0.875rem', weight: 400, letterSpacing: '0' },
    caption: { size: '0.75rem', weight: 500, letterSpacing: '0.01em' },
  },
  // コンポーネントスタイル（フラット・ミニマル）
  components: {
    borderRadius: 8,         // 控えめな角丸
    cardBorder: '1px solid #e5e7eb',
    cardShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)', // ほぼ見えない影
    cardShadowHover: '0 4px 6px -1px rgb(0 0 0 / 0.05)', // ホバー時も控えめ
    buttonShadow: 'none',    // ボタンは影なし
  },
}

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: designSystem.colors.primary,
      light: designSystem.colors.primaryLight,
      dark: designSystem.colors.primaryDark,
      contrastText: '#ffffff',
    },
    secondary: {
      main: designSystem.colors.secondary,
    },
    success: {
      main: designSystem.colors.success,
      light: designSystem.colors.successLight,
    },
    warning: {
      main: designSystem.colors.warning,
      light: designSystem.colors.warningLight,
    },
    error: {
      main: designSystem.colors.error,
    },
    background: {
      default: designSystem.colors.background,
      paper: designSystem.colors.surface,
    },
    text: {
      primary: designSystem.colors.textPrimary,
      secondary: designSystem.colors.textSecondary,
    },
  },
  typography: {
    fontFamily: [
      'Inter',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: {
      fontSize: designSystem.typography.h1.size,
      fontWeight: designSystem.typography.h1.weight,
      letterSpacing: designSystem.typography.h1.letterSpacing,
      lineHeight: 1.2,
      color: designSystem.colors.textPrimary,
    },
    h2: {
      fontSize: designSystem.typography.h2.size,
      fontWeight: designSystem.typography.h2.weight,
      letterSpacing: designSystem.typography.h2.letterSpacing,
      lineHeight: 1.3,
      color: designSystem.colors.textPrimary,
    },
    h3: {
      fontSize: designSystem.typography.h3.size,
      fontWeight: designSystem.typography.h3.weight,
      lineHeight: 1.4,
      color: designSystem.colors.textPrimary,
    },
    h4: {
      fontSize: designSystem.typography.h4.size,
      fontWeight: designSystem.typography.h4.weight,
      lineHeight: 1.5,
      color: designSystem.colors.textPrimary,
      '@media (max-width:600px)': {
        fontSize: '1rem',
      },
    },
    h5: {
      fontSize: '1rem',
      fontWeight: 600,
      lineHeight: 1.5,
      '@media (max-width:600px)': {
        fontSize: '0.9375rem',
      },
    },
    h6: {
      fontSize: '0.875rem',
      fontWeight: 600,
      lineHeight: 1.6,
      '@media (max-width:600px)': {
        fontSize: '0.8125rem',
      },
    },
    body1: {
      fontSize: designSystem.typography.body.size,
      fontWeight: designSystem.typography.body.weight,
      lineHeight: 1.6,
      color: designSystem.colors.textPrimary,
    },
    body2: {
      fontSize: designSystem.typography.small.size,
      fontWeight: designSystem.typography.small.weight,
      lineHeight: 1.6,
      color: designSystem.colors.textSecondary,
    },
    caption: {
      fontSize: designSystem.typography.caption.size,
      fontWeight: designSystem.typography.caption.weight,
      lineHeight: 1.5,
      color: designSystem.colors.textSecondary,
    },
    button: {
      fontSize: '1rem',
      fontWeight: 600,
      textTransform: 'none',
      letterSpacing: '0.01em',
    },
  },
  shape: {
    borderRadius: designSystem.components.borderRadius,
  },
  spacing: 8, // 基本単位: 8px
  shadows: [
    'none',
    '0 1px 2px 0 rgb(0 0 0 / 0.03)',
    '0 1px 3px 0 rgb(0 0 0 / 0.05)',
    designSystem.components.cardShadow,
    designSystem.components.cardShadowHover,
    '0 4px 6px -1px rgb(0 0 0 / 0.08)',
    '0 10px 15px -3px rgb(0 0 0 / 0.08)',
    '0 10px 15px -3px rgb(0 0 0 / 0.08)',
    '0 10px 15px -3px rgb(0 0 0 / 0.08)',
    '0 10px 15px -3px rgb(0 0 0 / 0.08)',
    '0 10px 15px -3px rgb(0 0 0 / 0.08)',
    '0 10px 15px -3px rgb(0 0 0 / 0.08)',
    '0 10px 15px -3px rgb(0 0 0 / 0.08)',
    '0 10px 15px -3px rgb(0 0 0 / 0.08)',
    '0 10px 15px -3px rgb(0 0 0 / 0.08)',
    '0 10px 15px -3px rgb(0 0 0 / 0.08)',
    '0 10px 15px -3px rgb(0 0 0 / 0.08)',
    '0 10px 15px -3px rgb(0 0 0 / 0.08)',
    '0 10px 15px -3px rgb(0 0 0 / 0.08)',
    '0 10px 15px -3px rgb(0 0 0 / 0.08)',
    '0 10px 15px -3px rgb(0 0 0 / 0.08)',
    '0 10px 15px -3px rgb(0 0 0 / 0.08)',
    '0 10px 15px -3px rgb(0 0 0 / 0.08)',
    '0 10px 15px -3px rgb(0 0 0 / 0.08)',
    '0 10px 15px -3px rgb(0 0 0 / 0.08)',
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: designSystem.colors.background,
          minHeight: '100vh',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: designSystem.components.borderRadius,
          fontSize: '0.9375rem',
          fontWeight: 600,
          padding: '10px 20px',
          minHeight: 44,
          boxShadow: 'none',
          textTransform: 'none',
          transition: 'all 0.15s ease-in-out',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        outlined: {
          borderWidth: '1.5px',
          '&:hover': {
            borderWidth: '1.5px',
          },
        },
        sizeLarge: {
          padding: '12px 24px',
          fontSize: '1rem',
          minHeight: 48,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: designSystem.colors.surface,
          border: designSystem.components.cardBorder,
          boxShadow: 'none',
        },
        elevation1: {
          boxShadow: designSystem.components.cardShadow,
        },
        elevation2: {
          boxShadow: designSystem.components.cardShadow,
        },
        elevation3: {
          boxShadow: designSystem.components.cardShadow,
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          fontSize: '0.9375rem',
          minHeight: 52,
          borderRadius: designSystem.components.borderRadius,
          border: `1.5px solid ${designSystem.colors.border}`,
          color: designSystem.colors.textPrimary,
          backgroundColor: designSystem.colors.surface,
          transition: 'all 0.15s ease-in-out',
          textTransform: 'none',
          '&:hover': {
            backgroundColor: '#f9fafb',
            borderColor: designSystem.colors.primary,
          },
          '&.Mui-selected': {
            fontWeight: 600,
            backgroundColor: '#eff6ff',
            borderColor: designSystem.colors.primary,
            color: designSystem.colors.primary,
            '&:hover': {
              backgroundColor: '#dbeafe',
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
          fontSize: '0.8125rem',
          borderRadius: 6,
          height: 28,
          transition: 'all 0.15s ease-in-out',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: designSystem.components.borderRadius,
            backgroundColor: designSystem.colors.surface,
            transition: 'all 0.15s ease-in-out',
            '& fieldset': {
              borderColor: designSystem.colors.border,
              borderWidth: 1.5,
            },
            '&:hover fieldset': {
              borderColor: '#9ca3af',
            },
            '&.Mui-focused fieldset': {
              borderColor: designSystem.colors.primary,
              borderWidth: 2,
            },
          },
        },
      },
    },
    MuiContainer: {
      styleOverrides: {
        root: {
          paddingLeft: designSystem.spacing.lg,
          paddingRight: designSystem.spacing.lg,
          '@media (max-width:600px)': {
            paddingLeft: designSystem.spacing.md,
            paddingRight: designSystem.spacing.md,
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: designSystem.components.borderRadius,
          boxShadow: designSystem.components.cardShadow,
          border: designSystem.components.cardBorder,
          transition: 'all 0.15s ease-in-out',
          '&:hover': {
            boxShadow: designSystem.components.cardShadowHover,
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: designSystem.components.borderRadius,
          padding: '12px 16px',
          fontSize: '0.9375rem',
          border: `1px solid`,
        },
        standardSuccess: {
          backgroundColor: '#f0fdf4',
          borderColor: '#86efac',
          color: designSystem.colors.textPrimary,
        },
        standardWarning: {
          backgroundColor: '#fffbeb',
          borderColor: '#fcd34d',
          color: designSystem.colors.textPrimary,
        },
        standardInfo: {
          backgroundColor: '#eff6ff',
          borderColor: '#93c5fd',
          color: designSystem.colors.textPrimary,
        },
        standardError: {
          backgroundColor: '#fef2f2',
          borderColor: '#fca5a5',
          color: designSystem.colors.textPrimary,
        },
      },
    },
  },
})

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  )
}
