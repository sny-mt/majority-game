'use client'

import { useMemo, useEffect, useState } from 'react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import useMediaQuery from '@mui/material/useMediaQuery'

// アニメーション設定（共通）
const transitions = {
  fast: '0.15s cubic-bezier(0.4, 0, 0.2, 1)',
  normal: '0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '0.5s cubic-bezier(0.4, 0, 0.2, 1)',
  bounce: '0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
}

// ライトモード用デザインシステム
const lightDesign = {
  colors: {
    primary: '#667eea',
    primaryLight: '#818cf8',
    primaryDark: '#4f46e5',
    secondary: '#764ba2',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
    textPrimary: '#1e293b',
    textSecondary: '#64748b',
  },
  glass: {
    background: 'rgba(255, 255, 255, 0.7)',
    backgroundStrong: 'rgba(255, 255, 255, 0.85)',
    border: '1px solid rgba(255, 255, 255, 0.5)',
    shadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
    shadowHover: '0 12px 40px 0 rgba(31, 38, 135, 0.2)',
    inputBg: 'rgba(255, 255, 255, 0.6)',
    inputBgFocus: 'rgba(255, 255, 255, 0.8)',
    toggleBg: 'rgba(255, 255, 255, 0.5)',
    toggleBgHover: 'rgba(255, 255, 255, 0.7)',
    borderColor: 'rgba(255, 255, 255, 0.5)',
    divider: 'rgba(0, 0, 0, 0.1)',
  },
}

// ダークモード用デザインシステム
const darkDesign = {
  colors: {
    primary: '#818cf8',
    primaryLight: '#a5b4fc',
    primaryDark: '#667eea',
    secondary: '#a78bfa',
    success: '#34d399',
    warning: '#fbbf24',
    error: '#f87171',
    info: '#60a5fa',
    textPrimary: '#f1f5f9',
    textSecondary: '#94a3b8',
  },
  glass: {
    background: 'rgba(30, 41, 59, 0.8)',
    backgroundStrong: 'rgba(30, 41, 59, 0.95)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    shadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
    shadowHover: '0 12px 40px 0 rgba(0, 0, 0, 0.4)',
    inputBg: 'rgba(51, 65, 85, 0.6)',
    inputBgFocus: 'rgba(51, 65, 85, 0.8)',
    toggleBg: 'rgba(51, 65, 85, 0.6)',
    toggleBgHover: 'rgba(51, 65, 85, 0.8)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
    divider: 'rgba(255, 255, 255, 0.1)',
  },
}

const createAppTheme = (mode: 'light' | 'dark') => {
  const design = mode === 'light' ? lightDesign : darkDesign
  const isDark = mode === 'dark'

  return createTheme({
    palette: {
      mode,
      primary: {
        main: design.colors.primary,
        light: design.colors.primaryLight,
        dark: design.colors.primaryDark,
        contrastText: '#ffffff',
      },
      secondary: {
        main: design.colors.secondary,
      },
      success: {
        main: design.colors.success,
      },
      warning: {
        main: design.colors.warning,
      },
      error: {
        main: design.colors.error,
      },
      info: {
        main: design.colors.info,
      },
      background: {
        default: 'transparent',
        paper: design.glass.background,
      },
      text: {
        primary: design.colors.textPrimary,
        secondary: design.colors.textSecondary,
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
        fontSize: '2.25rem',
        fontWeight: 700,
        letterSpacing: '-0.025em',
        lineHeight: 1.2,
      },
      h2: {
        fontSize: '1.875rem',
        fontWeight: 700,
        letterSpacing: '-0.02em',
        lineHeight: 1.3,
      },
      h3: {
        fontSize: '1.5rem',
        fontWeight: 600,
        letterSpacing: '-0.01em',
        lineHeight: 1.4,
      },
      h4: {
        fontSize: '1.25rem',
        fontWeight: 600,
        lineHeight: 1.5,
        '@media (max-width:600px)': {
          fontSize: '1.125rem',
        },
      },
      h5: {
        fontSize: '1.125rem',
        fontWeight: 600,
        lineHeight: 1.5,
        '@media (max-width:600px)': {
          fontSize: '1rem',
        },
      },
      h6: {
        fontSize: '1rem',
        fontWeight: 600,
        lineHeight: 1.6,
      },
      body1: {
        fontSize: '1rem',
        lineHeight: 1.7,
      },
      body2: {
        fontSize: '0.875rem',
        lineHeight: 1.6,
      },
      button: {
        fontSize: '0.9375rem',
        fontWeight: 600,
        textTransform: 'none',
        letterSpacing: '0.02em',
      },
    },
    shape: {
      borderRadius: 16,
    },
    spacing: 8,
    shadows: [
      'none',
      isDark ? '0 1px 2px 0 rgba(0, 0, 0, 0.2)' : '0 1px 2px 0 rgba(31, 38, 135, 0.05)',
      isDark ? '0 2px 4px 0 rgba(0, 0, 0, 0.25)' : '0 2px 4px 0 rgba(31, 38, 135, 0.08)',
      design.glass.shadow,
      design.glass.shadowHover,
      isDark ? '0 10px 25px -3px rgba(0, 0, 0, 0.3)' : '0 10px 25px -3px rgba(31, 38, 135, 0.15)',
      isDark ? '0 20px 50px -12px rgba(0, 0, 0, 0.4)' : '0 20px 50px -12px rgba(31, 38, 135, 0.2)',
      isDark ? '0 20px 50px -12px rgba(0, 0, 0, 0.4)' : '0 20px 50px -12px rgba(31, 38, 135, 0.2)',
      isDark ? '0 20px 50px -12px rgba(0, 0, 0, 0.4)' : '0 20px 50px -12px rgba(31, 38, 135, 0.2)',
      isDark ? '0 20px 50px -12px rgba(0, 0, 0, 0.4)' : '0 20px 50px -12px rgba(31, 38, 135, 0.2)',
      isDark ? '0 20px 50px -12px rgba(0, 0, 0, 0.4)' : '0 20px 50px -12px rgba(31, 38, 135, 0.2)',
      isDark ? '0 20px 50px -12px rgba(0, 0, 0, 0.4)' : '0 20px 50px -12px rgba(31, 38, 135, 0.2)',
      isDark ? '0 20px 50px -12px rgba(0, 0, 0, 0.4)' : '0 20px 50px -12px rgba(31, 38, 135, 0.2)',
      isDark ? '0 20px 50px -12px rgba(0, 0, 0, 0.4)' : '0 20px 50px -12px rgba(31, 38, 135, 0.2)',
      isDark ? '0 20px 50px -12px rgba(0, 0, 0, 0.4)' : '0 20px 50px -12px rgba(31, 38, 135, 0.2)',
      isDark ? '0 20px 50px -12px rgba(0, 0, 0, 0.4)' : '0 20px 50px -12px rgba(31, 38, 135, 0.2)',
      isDark ? '0 20px 50px -12px rgba(0, 0, 0, 0.4)' : '0 20px 50px -12px rgba(31, 38, 135, 0.2)',
      isDark ? '0 20px 50px -12px rgba(0, 0, 0, 0.4)' : '0 20px 50px -12px rgba(31, 38, 135, 0.2)',
      isDark ? '0 20px 50px -12px rgba(0, 0, 0, 0.4)' : '0 20px 50px -12px rgba(31, 38, 135, 0.2)',
      isDark ? '0 20px 50px -12px rgba(0, 0, 0, 0.4)' : '0 20px 50px -12px rgba(31, 38, 135, 0.2)',
      isDark ? '0 20px 50px -12px rgba(0, 0, 0, 0.4)' : '0 20px 50px -12px rgba(31, 38, 135, 0.2)',
      isDark ? '0 20px 50px -12px rgba(0, 0, 0, 0.4)' : '0 20px 50px -12px rgba(31, 38, 135, 0.2)',
      isDark ? '0 20px 50px -12px rgba(0, 0, 0, 0.4)' : '0 20px 50px -12px rgba(31, 38, 135, 0.2)',
      isDark ? '0 20px 50px -12px rgba(0, 0, 0, 0.4)' : '0 20px 50px -12px rgba(31, 38, 135, 0.2)',
      isDark ? '0 20px 50px -12px rgba(0, 0, 0, 0.4)' : '0 20px 50px -12px rgba(31, 38, 135, 0.2)',
    ],
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            minHeight: '100vh',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            padding: '12px 24px',
            minHeight: 48,
            position: 'relative',
            overflow: 'hidden',
            transition: `all ${transitions.normal}`,
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: '-100%',
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
              transition: '0.5s',
            },
            '&:hover::before': {
              left: '100%',
            },
            '&:active': {
              transform: 'scale(0.98)',
            },
          },
          contained: {
            background: isDark
              ? 'linear-gradient(135deg, #818cf8 0%, #a78bfa 100%)'
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            boxShadow: isDark
              ? '0 4px 15px 0 rgba(129, 140, 248, 0.3)'
              : '0 4px 15px 0 rgba(102, 126, 234, 0.4)',
            '&:hover': {
              background: isDark
                ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                : 'linear-gradient(135deg, #5a6fd6 0%, #6a4190 100%)',
              boxShadow: isDark
                ? '0 6px 20px 0 rgba(129, 140, 248, 0.4)'
                : '0 6px 20px 0 rgba(102, 126, 234, 0.5)',
              transform: 'translateY(-2px)',
            },
          },
          containedSuccess: {
            background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
            boxShadow: '0 4px 15px 0 rgba(16, 185, 129, 0.4)',
            '&:hover': {
              background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              boxShadow: '0 6px 20px 0 rgba(16, 185, 129, 0.5)',
            },
          },
          containedWarning: {
            background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
            boxShadow: '0 4px 15px 0 rgba(245, 158, 11, 0.4)',
            color: '#1e293b',
            '&:hover': {
              background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
              boxShadow: '0 6px 20px 0 rgba(245, 158, 11, 0.5)',
            },
          },
          outlined: {
            borderWidth: 2,
            backdropFilter: 'blur(12px)',
            background: isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(255, 255, 255, 0.5)',
            borderColor: isDark ? 'rgba(129, 140, 248, 0.5)' : undefined,
            '&:hover': {
              borderWidth: 2,
              background: isDark ? 'rgba(51, 65, 85, 0.6)' : 'rgba(255, 255, 255, 0.7)',
              transform: 'translateY(-2px)',
            },
          },
          sizeLarge: {
            padding: '14px 28px',
            fontSize: '1rem',
            minHeight: 52,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            background: design.glass.background,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: design.glass.border,
            boxShadow: design.glass.shadow,
            transition: `all ${transitions.normal}`,
            '&:hover': {
              boxShadow: design.glass.shadowHover,
            },
          },
          elevation3: {
            background: design.glass.backgroundStrong,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            background: design.glass.background,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: design.glass.border,
            boxShadow: design.glass.shadow,
            transition: `all ${transitions.normal}`,
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: design.glass.shadowHover,
            },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 12,
              background: design.glass.inputBg,
              backdropFilter: 'blur(12px)',
              transition: `all ${transitions.fast}`,
              '& fieldset': {
                borderColor: design.glass.borderColor,
                borderWidth: 2,
                transition: `all ${transitions.fast}`,
              },
              '&:hover fieldset': {
                borderColor: isDark ? 'rgba(129, 140, 248, 0.5)' : 'rgba(102, 126, 234, 0.5)',
              },
              '&.Mui-focused fieldset': {
                borderColor: design.colors.primary,
                borderWidth: 2,
              },
              '&.Mui-focused': {
                background: design.glass.inputBgFocus,
                boxShadow: isDark
                  ? '0 0 0 4px rgba(129, 140, 248, 0.15)'
                  : '0 0 0 4px rgba(102, 126, 234, 0.15)',
              },
            },
            '& .MuiInputLabel-root': {
              color: design.colors.textSecondary,
            },
            '& .MuiOutlinedInput-input': {
              color: design.colors.textPrimary,
            },
          },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            minHeight: 56,
            border: `2px solid ${design.glass.borderColor}`,
            background: design.glass.toggleBg,
            backdropFilter: 'blur(12px)',
            transition: `all ${transitions.normal}`,
            textTransform: 'none',
            fontSize: '1rem',
            color: design.colors.textPrimary,
            '&:hover': {
              background: design.glass.toggleBgHover,
              borderColor: isDark ? 'rgba(129, 140, 248, 0.5)' : 'rgba(102, 126, 234, 0.5)',
              transform: 'translateY(-2px)',
            },
            '&.Mui-selected': {
              background: isDark
                ? 'linear-gradient(135deg, rgba(129, 140, 248, 0.25) 0%, rgba(167, 139, 250, 0.25) 100%)'
                : 'linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%)',
              borderColor: design.colors.primary,
              color: design.colors.primary,
              fontWeight: 600,
              boxShadow: isDark
                ? '0 4px 15px 0 rgba(129, 140, 248, 0.2)'
                : '0 4px 15px 0 rgba(102, 126, 234, 0.2)',
              '&:hover': {
                background: isDark
                  ? 'linear-gradient(135deg, rgba(129, 140, 248, 0.35) 0%, rgba(167, 139, 250, 0.35) 100%)'
                  : 'linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(118, 75, 162, 0.3) 100%)',
              },
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            height: 32,
            fontWeight: 500,
            backdropFilter: 'blur(12px)',
            transition: `all ${transitions.fast}`,
            '&:hover': {
              transform: 'scale(1.05)',
            },
          },
          colorPrimary: {
            background: isDark
              ? 'linear-gradient(135deg, rgba(129, 140, 248, 0.25) 0%, rgba(167, 139, 250, 0.25) 100%)'
              : 'linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%)',
            border: isDark
              ? '1px solid rgba(129, 140, 248, 0.3)'
              : '1px solid rgba(102, 126, 234, 0.3)',
          },
          colorSuccess: {
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            backdropFilter: 'blur(12px)',
            border: '1px solid',
          },
          standardSuccess: {
            background: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)',
            borderColor: 'rgba(16, 185, 129, 0.3)',
          },
          standardWarning: {
            background: isDark ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.15)',
            borderColor: 'rgba(245, 158, 11, 0.3)',
          },
          standardInfo: {
            background: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.15)',
            borderColor: 'rgba(59, 130, 246, 0.3)',
          },
          standardError: {
            background: isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.15)',
            borderColor: 'rgba(239, 68, 68, 0.3)',
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            background: design.glass.backgroundStrong,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderRadius: 20,
            border: design.glass.border,
          },
        },
      },
      MuiContainer: {
        styleOverrides: {
          root: {
            paddingLeft: 24,
            paddingRight: 24,
            '@media (max-width:600px)': {
              paddingLeft: 16,
              paddingRight: 16,
            },
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor: design.glass.divider,
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            transition: `all ${transitions.fast}`,
            '&:hover': {
              transform: 'scale(1.1)',
              background: isDark ? 'rgba(129, 140, 248, 0.15)' : 'rgba(102, 126, 234, 0.1)',
            },
            '&:active': {
              transform: 'scale(0.95)',
            },
          },
        },
      },
      MuiListItem: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            transition: `all ${transitions.fast}`,
          },
        },
      },
      MuiCircularProgress: {
        styleOverrides: {
          root: {
            color: design.colors.primary,
          },
        },
      },
      MuiSkeleton: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? 'rgba(129, 140, 248, 0.15)' : 'rgba(102, 126, 234, 0.1)',
          },
        },
      },
    },
  })
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const theme = useMemo(
    () => createAppTheme(prefersDarkMode ? 'dark' : 'light'),
    [prefersDarkMode]
  )

  // SSR時のハイドレーションエラーを避けるため
  if (!mounted) {
    return (
      <ThemeProvider theme={createAppTheme('light')}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  )
}
