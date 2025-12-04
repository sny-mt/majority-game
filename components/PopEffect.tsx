'use client'

import { Box } from '@mui/material'
import { useEffect, useState } from 'react'

interface PopEffectProps {
  trigger: boolean
  color?: string
  onComplete?: () => void
}

interface Particle {
  id: number
  x: number
  y: number
  size: number
  angle: number
  velocity: number
}

export function PopEffect({ trigger, color = '#667eea', onComplete }: PopEffectProps) {
  const [particles, setParticles] = useState<Particle[]>([])
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (trigger && !isAnimating) {
      setIsAnimating(true)

      // パーティクルを生成
      const newParticles: Particle[] = []
      for (let i = 0; i < 12; i++) {
        newParticles.push({
          id: i,
          x: 50,
          y: 50,
          size: Math.random() * 8 + 4,
          angle: (i * 30) + Math.random() * 20 - 10,
          velocity: Math.random() * 60 + 40,
        })
      }
      setParticles(newParticles)

      // アニメーション終了後にリセット
      setTimeout(() => {
        setParticles([])
        setIsAnimating(false)
        onComplete?.()
      }, 600)
    }
  }, [trigger, isAnimating, onComplete])

  if (particles.length === 0) return null

  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {particles.map((particle) => (
        <Box
          key={particle.id}
          sx={{
            position: 'absolute',
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
            borderRadius: '50%',
            background: color,
            animation: 'popParticle 0.6s ease-out forwards',
            '--angle': `${particle.angle}deg`,
            '--velocity': `${particle.velocity}px`,
            '@keyframes popParticle': {
              '0%': {
                transform: 'translate(-50%, -50%) scale(1)',
                opacity: 1,
              },
              '100%': {
                transform: `translate(
                  calc(-50% + cos(var(--angle)) * var(--velocity)),
                  calc(-50% + sin(var(--angle)) * var(--velocity))
                ) scale(0)`,
                opacity: 0,
              },
            },
          }}
        />
      ))}
    </Box>
  )
}

// 画面揺れエフェクト
export function useShakeEffect() {
  const [isShaking, setIsShaking] = useState(false)

  const shake = () => {
    setIsShaking(true)
    setTimeout(() => setIsShaking(false), 3000)
  }

  const shakeStyle = isShaking ? {
    animation: 'shake 0.5s ease-in-out 6',
    '@keyframes shake': {
      '0%, 100%': { transform: 'translateX(0)' },
      '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-5px)' },
      '20%, 40%, 60%, 80%': { transform: 'translateX(5px)' },
    },
  } : {}

  return { shake, shakeStyle, isShaking }
}

// カウントアップアニメーション用フック
export function useCountUp(targetValue: number, duration: number = 1000) {
  const [displayValue, setDisplayValue] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  const startCountUp = (from: number = 0) => {
    if (isAnimating) return
    setIsAnimating(true)

    const startTime = Date.now()
    const startValue = from
    const diff = targetValue - startValue

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      // イージング関数 (easeOutExpo)
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)

      const currentValue = Math.round(startValue + diff * easeProgress)
      setDisplayValue(currentValue)

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        setIsAnimating(false)
      }
    }

    requestAnimationFrame(animate)
  }

  return { displayValue, startCountUp, isAnimating }
}
