'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Container,
  TextField,
  Button,
  Typography,
  Box,
  Paper,
  CircularProgress,
  Fade,
  Grow,
  Skeleton
} from '@mui/material'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import SentimentDissatisfiedIcon from '@mui/icons-material/SentimentDissatisfied'
import GroupsIcon from '@mui/icons-material/Groups'
import { supabase } from '@/lib/supabase'
import { getOrCreatePlayerId } from '@/lib/utils/player'
import { sanitizeInput, validateNickname } from '@/lib/utils/validation'

export default function JoinPage() {
  const params = useParams()
  const router = useRouter()
  const roomId = params.roomId as string

  const [nickname, setNickname] = useState('')
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState('')
  const [roomExists, setRoomExists] = useState(true)
  const [isCheckingRoom, setIsCheckingRoom] = useState(true)
  const [roomName, setRoomName] = useState('')

  useEffect(() => {
    // ルームが存在するか確認
    const checkRoom = async () => {
      const { data, error } = await supabase
        .from('rooms')
        .select('id, room_name')
        .eq('id', roomId)
        .single()

      if (error || !data) {
        setRoomExists(false)
      } else {
        setRoomName(data.room_name || 'マジョリティゲーム')
      }
      setIsCheckingRoom(false)
    }

    checkRoom()
  }, [roomId])

  const handleJoin = async () => {
    setIsJoining(true)
    setError('')

    try {
      // ニックネームをサニタイズとバリデーション
      const sanitizedNickname = sanitizeInput(nickname, 50)
      const nicknameValidation = validateNickname(sanitizedNickname)

      if (!nicknameValidation.valid) {
        throw new Error(nicknameValidation.error)
      }

      // プレイヤーIDを取得または生成
      const playerId = getOrCreatePlayerId()

      // ルーム情報を取得（statusを確認するため）
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single()

      if (roomError) throw roomError

      // 既にこのプレイヤーがこのルームに参加しているかチェック
      const { data: existingPlayer } = await supabase
        .from('players')
        .select('id')
        .eq('id', playerId)
        .eq('room_id', roomId)
        .single()

      if (existingPlayer) {
        // 既に参加済みの場合は、ルームのstatusに応じて適切なページへ
        if (roomData.status === 'answering') {
          router.push(`/room/${roomId}/answer`)
        } else if (roomData.status === 'showing_result') {
          router.push(`/room/${roomId}/result`)
        } else if (roomData.status === 'finished') {
          router.push(`/room/${roomId}/summary`)
        } else {
          // waiting状態の場合は待機画面へ
          router.push(`/room/${roomId}/waiting`)
        }
        return
      }

      // プレイヤーを登録（既存の場合は更新）
      const { error: playerError } = await supabase
        .from('players')
        .upsert({
          id: playerId,
          room_id: roomId,
          nickname: sanitizedNickname,
          is_host: false,
          score: 0
        }, {
          onConflict: 'id'
        })

      if (playerError) throw playerError

      console.log('Player joined:', playerId)

      // ルームのstatusに応じて適切なページへ遷移
      if (roomData.status === 'answering') {
        router.push(`/room/${roomId}/answer`)
      } else if (roomData.status === 'showing_result') {
        router.push(`/room/${roomId}/result`)
      } else if (roomData.status === 'finished') {
        router.push(`/room/${roomId}/summary`)
      } else {
        // waiting状態の場合は待機画面へ
        router.push(`/room/${roomId}/waiting`)
      }
    } catch (err: any) {
      console.error('Error joining room:', err)
      setError(err.message || 'ルームへの参加に失敗しました')
      setIsJoining(false)
    }
  }

  if (isCheckingRoom) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ mt: 8, textAlign: 'center' }}>
          <Paper elevation={3} sx={{ p: 4 }}>
            <Skeleton
              variant="circular"
              width={80}
              height={80}
              sx={{ mx: 'auto', mb: 3 }}
            />
            <Skeleton variant="text" width={200} height={40} sx={{ mx: 'auto', mb: 2 }} />
            <Skeleton variant="text" width={150} height={24} sx={{ mx: 'auto' }} />
          </Paper>
        </Box>
      </Container>
    )
  }

  if (!roomExists) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ mt: 8 }}>
          <Fade in timeout={500}>
            <Paper
              elevation={3}
              sx={{
                p: 4,
                textAlign: 'center',
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
              }}
            >
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 80,
                  height: 80,
                  borderRadius: '24px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  mb: 3,
                }}
              >
                <SentimentDissatisfiedIcon sx={{ fontSize: 40, color: '#ef4444' }} />
              </Box>
              <Typography variant="h5" gutterBottom fontWeight="bold" color="error">
                ルームが見つかりません
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                URLが正しいか確認してください。<br />
                ルームが終了している可能性もあります。
              </Typography>
              <Button
                variant="outlined"
                color="primary"
                onClick={() => router.push('/')}
              >
                ホームに戻る
              </Button>
            </Paper>
          </Fade>
        </Box>
      </Container>
    )
  }

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 6, mb: 4 }}>
        <Fade in timeout={800}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 80,
                height: 80,
                borderRadius: '24px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                boxShadow: '0 10px 40px rgba(102, 126, 234, 0.4)',
                mb: 3,
                animation: 'pulse 2s ease-in-out infinite',
                '@keyframes pulse': {
                  '0%, 100%': { transform: 'scale(1)' },
                  '50%': { transform: 'scale(1.05)' },
                },
              }}
            >
              <GroupsIcon sx={{ fontSize: 40, color: 'white' }} />
            </Box>
            <Typography
              variant="h4"
              component="h1"
              sx={{
                fontWeight: 700,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                mb: 1,
              }}
            >
              ルームに参加
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {roomName}
            </Typography>
          </Box>
        </Fade>

        <Grow in timeout={600}>
          <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
              ニックネームを入力して参加しましょう
            </Typography>
            <TextField
              fullWidth
              label="ニックネーム"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="例：たろう"
              sx={{ mb: 3 }}
              autoFocus
              disabled={isJoining}
              InputProps={{
                sx: { fontSize: '1.1rem' }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && nickname.trim() && !isJoining) {
                  handleJoin()
                }
              }}
            />

            <Button
              fullWidth
              variant="contained"
              size="large"
              onClick={handleJoin}
              disabled={!nickname.trim() || isJoining}
              startIcon={
                isJoining ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  <PersonAddIcon />
                )
              }
              sx={{
                py: 2,
                fontSize: '1.1rem',
              }}
            >
              {isJoining ? '参加中...' : '参加する'}
            </Button>

            {error && (
              <Fade in>
                <Box
                  sx={{
                    mt: 2,
                    p: 2,
                    borderRadius: 2,
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                  }}
                >
                  <Typography variant="body2" color="error">
                    {error}
                  </Typography>
                </Box>
              </Fade>
            )}
          </Paper>
        </Grow>
      </Box>
    </Container>
  )
}
