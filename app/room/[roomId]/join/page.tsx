'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Container, TextField, Button, Typography, Box, Paper, CircularProgress } from '@mui/material'
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

  useEffect(() => {
    // ルームが存在するか確認
    const checkRoom = async () => {
      const { data, error } = await supabase
        .from('rooms')
        .select('id')
        .eq('id', roomId)
        .single()

      if (error || !data) {
        setRoomExists(false)
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

      // 既にこのプレイヤーがこのルームに参加しているかチェック
      const { data: existingPlayer } = await supabase
        .from('players')
        .select('id')
        .eq('id', playerId)
        .eq('room_id', roomId)
        .single()

      if (existingPlayer) {
        // 既に参加済みの場合は回答ページへ
        router.push(`/room/${roomId}/answer`)
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

      // 回答ページへ遷移
      router.push(`/room/${roomId}/answer`)
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
          <CircularProgress />
          <Typography sx={{ mt: 2 }}>ルームを確認中...</Typography>
        </Box>
      </Container>
    )
  }

  if (!roomExists) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ mt: 8 }}>
          <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h5" gutterBottom color="error">
              ルームが見つかりません
            </Typography>
            <Typography variant="body2" color="text.secondary">
              URLを確認してください
            </Typography>
          </Paper>
        </Box>
      </Container>
    )
  }

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 8, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          ルームに参加
        </Typography>
        <Typography variant="body2" gutterBottom align="center" color="text.secondary">
          ニックネームを入力してください
        </Typography>
      </Box>

      <Paper elevation={3} sx={{ p: 4 }}>
        <TextField
          fullWidth
          label="ニックネーム"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="例：たろう"
          sx={{ mb: 3 }}
          autoFocus
          disabled={isJoining}
        />

        <Button
          fullWidth
          variant="contained"
          size="large"
          onClick={handleJoin}
          disabled={!nickname.trim() || isJoining}
          sx={{ py: 1.5 }}
        >
          {isJoining ? <CircularProgress size={24} /> : '参加する'}
        </Button>

        {error && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
            <Typography variant="body2" color="error.dark">
              {error}
            </Typography>
          </Box>
        )}
      </Paper>
    </Container>
  )
}
