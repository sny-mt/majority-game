'use client'

import { Button, ButtonProps } from '@mui/material'
import { forwardRef } from 'react'

interface AnimatedButtonProps extends ButtonProps {
  bounceOnHover?: boolean
  popOnClick?: boolean
}

export const AnimatedButton = forwardRef<HTMLButtonElement, AnimatedButtonProps>(
  ({ bounceOnHover = true, popOnClick = true, sx, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        {...props}
        sx={{
          transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          ...(bounceOnHover && {
            '&:hover': {
              transform: 'translateY(-2px) scale(1.02)',
            },
          }),
          ...(popOnClick && {
            '&:active': {
              transform: 'scale(0.95)',
              transition: 'all 0.1s ease',
            },
          }),
          ...sx,
        }}
      />
    )
  }
)

AnimatedButton.displayName = 'AnimatedButton'
