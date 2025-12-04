'use client'

import { Box, Typography } from '@mui/material'
import { useState, useEffect } from 'react'

interface DrumrollRevealProps {
  isRevealing: boolean
  onRevealComplete: () => void
  duration?: number
}

export function DrumrollReveal({ isRevealing, onRevealComplete, duration = 2000 }: DrumrollRevealProps) {
  const [dots, setDots] = useState('')

  useEffect(() => {
    if (!isRevealing) {
      setDots('')
      return
    }

    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.')
    }, 300)

    const timeout = setTimeout(() => {
      onRevealComplete()
    }, duration)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [isRevealing, onRevealComplete, duration])

  if (!isRevealing) return null

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
      }}
    >
      {/* ドラムロール演出 */}
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          mb: 4,
        }}
      >
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            sx={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              animation: `drumBounce 0.6s ease-in-out infinite`,
              animationDelay: `${i * 0.15}s`,
              '@keyframes drumBounce': {
                '0%, 100%': {
                  transform: 'scale(1) translateY(0)',
                  opacity: 0.5,
                },
                '50%': {
                  transform: 'scale(1.3) translateY(-15px)',
                  opacity: 1,
                },
              },
            }}
          />
        ))}
      </Box>

      <Typography
        variant="h4"
        sx={{
          color: 'white',
          fontWeight: 700,
          textAlign: 'center',
          animation: 'pulse 1s ease-in-out infinite',
          '@keyframes pulse': {
            '0%, 100%': { opacity: 1 },
            '50%': { opacity: 0.7 },
          },
        }}
      >
        結果発表{dots}
      </Typography>

      {/* 装飾用の光エフェクト */}
      <Box
        sx={{
          position: 'absolute',
          width: 200,
          height: 200,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(102, 126, 234, 0.3) 0%, transparent 70%)',
          animation: 'glow 1.5s ease-in-out infinite',
          '@keyframes glow': {
            '0%, 100%': {
              transform: 'scale(1)',
              opacity: 0.5,
            },
            '50%': {
              transform: 'scale(1.5)',
              opacity: 0.8,
            },
          },
        }}
      />
    </Box>
  )
}
