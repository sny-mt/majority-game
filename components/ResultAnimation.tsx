'use client'

import { memo } from 'react'
import { Box, Fade, Grow, Typography } from '@mui/material'

interface ResultAnimationProps {
  answer: string
  count: number
  isWinner: boolean
  delay?: number
}

const ResultAnimation = memo(function ResultAnimation({
  answer,
  count,
  isWinner,
  delay = 0
}: ResultAnimationProps) {
  return (
    <Grow in timeout={1000} style={{ transformOrigin: '0 0 0', transitionDelay: `${delay}ms` }}>
      <Box
        sx={{
          p: 3,
          mb: 2,
          borderRadius: 2,
          bgcolor: isWinner ? 'success.main' : 'grey.200',
          color: isWinner ? 'white' : 'text.primary',
          transform: isWinner ? 'scale(1.05)' : 'scale(1)',
          transition: 'all 0.3s ease-in-out',
          boxShadow: isWinner ? 4 : 1,
        }}
      >
        <Fade in timeout={1500} style={{ transitionDelay: `${delay + 300}ms` }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1 }}>
              {answer}
            </Typography>
            <Typography variant="h6">
              {count}人
            </Typography>
          </Box>
        </Fade>
      </Box>
    </Grow>
  )
})

export default ResultAnimation
