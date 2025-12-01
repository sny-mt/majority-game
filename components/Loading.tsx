'use client'

import { memo } from 'react'
import { Container, Box, CircularProgress, Typography } from '@mui/material'

interface LoadingProps {
  message?: string
}

const Loading = memo(function Loading({ message = '読み込み中...' }: LoadingProps) {
  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 8, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>{message}</Typography>
      </Box>
    </Container>
  )
})

export default Loading
