'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  Chip,
  Fade,
  Grow,
  Skeleton,
  Avatar,
  Collapse
} from '@mui/material'
import GroupsIcon from '@mui/icons-material/Groups'
import PersonIcon from '@mui/icons-material/Person'
import StarIcon from '@mui/icons-material/Star'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import QrCodeIcon from '@mui/icons-material/QrCode'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import { QRCodeCanvas } from 'qrcode.react'
import { supabase } from '@/lib/supabase'
import { getOrCreatePlayerId } from '@/lib/utils/player'
import type { Room, Player } from '@/types/database'

export default function WaitingPage() {
  const params = useParams()
  const router = useRouter()
  const roomId = params.roomId as string

  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [isHost, setIsHost] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [playerId, setPlayerId] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [roomUrl, setRoomUrl] = useState('')
  const [isStarting, setIsStarting] = useState(false)
  const [showAllPlayers, setShowAllPlayers] = useState(false)

  const INITIAL_DISPLAY_COUNT = 12 // 初期表示人数

  // ========== 開発用ダミーデータ（本番では削除） ==========
  const DEV_MODE = true // falseにすると無効化
  const generateDummyPlayers = (count: number, realPlayers: typeof players) => {
    if (!DEV_MODE || realPlayers.length >= count) return realPlayers
    const dummyNames = [
      'たろう', 'はなこ', 'ゆうき', 'さくら', 'けんた', 'みさき', 'りょう', 'あおい',
      'そうた', 'ひなた', 'ゆうと', 'めい', 'はると', 'りん', 'そら', 'こはる',
      'ゆい', 'あかり', 'れん', 'みお', 'かいと', 'ゆな', 'りく', 'ほのか',
      'たくみ', 'さき', 'しょう', 'ここあ', 'だいき', 'ひまり', 'ゆうま', 'あんな',
      'こうき', 'まお', 'しゅん', 'みゆ', 'りょうた', 'なな', 'かずき', 'もも',
      'たいが', 'ゆず', 'けい', 'ことね', 'あつし', 'まこ', 'じゅん', 'ふうか',
      'まさと', 'りこ'
    ]
    const dummies = []
    for (let i = realPlayers.length; i < count; i++) {
      dummies.push({
        id: `dummy-${i}`,
        room_id: roomId,
        nickname: dummyNames[i] || `テスト${i + 1}`,
        is_host: false,
        score: 0,
        joined_at: new Date().toISOString()
      } as typeof players[0])
    }
    return [...realPlayers, ...dummies]
  }
  // ========== ダミーデータここまで ==========

  useEffect(() => {
    const initialize = async () => {
      try {
        const pid = getOrCreatePlayerId()
        setPlayerId(pid)

        // ルーム情報を取得
        const { data: roomData, error: roomError } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', roomId)
          .single()

        if (roomError) throw roomError
        setRoom(roomData)
        setIsHost(roomData.host_player_id === pid)

        // 既にゲームが開始されている場合はリダイレクト
        if (roomData.status === 'answering') {
          router.push(`/room/${roomId}/answer`)
          return
        } else if (roomData.status === 'showing_result') {
          router.push(`/room/${roomId}/result`)
          return
        } else if (roomData.status === 'finished') {
          router.push(`/room/${roomId}/summary`)
          return
        }

        // 参加者一覧を取得
        const { data: playersData, error: playersError } = await supabase
          .from('players')
          .select('*')
          .eq('room_id', roomId)
          .order('joined_at', { ascending: true })

        if (playersError) throw playersError
        setPlayers(playersData || [])

        // URLを設定
        setRoomUrl(`${window.location.origin}/room/${roomId}/join`)

        setIsLoading(false)
      } catch (error) {
        console.error('Error initializing waiting room:', error)
        setIsLoading(false)
      }
    }

    initialize()
  }, [roomId, router])

  // リアルタイム購読
  useEffect(() => {
    if (!room) return

    // プレイヤーの参加を監視（差分更新で最適化）
    const playersChannel = supabase
      .channel(`waiting_players:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          // 新規プレイヤーを追加（既存リストに追加するだけ）
          const newPlayer = payload.new as Player
          setPlayers(prev => {
            // 重複チェック
            if (prev.some(p => p.id === newPlayer.id)) return prev
            return [...prev, newPlayer].sort((a, b) =>
              new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
            )
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          // プレイヤーを削除
          const deletedPlayer = payload.old as Player
          setPlayers(prev => prev.filter(p => p.id !== deletedPlayer.id))
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          // プレイヤー情報を更新
          const updatedPlayer = payload.new as Player
          setPlayers(prev => prev.map(p =>
            p.id === updatedPlayer.id ? updatedPlayer : p
          ))
        }
      )
      .subscribe()

    // ルームステータスを監視
    const roomChannel = supabase
      .channel(`waiting_room:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`
        },
        (payload) => {
          const updatedRoom = payload.new as Room
          setRoom(updatedRoom)

          if (updatedRoom.status === 'answering') {
            router.push(`/room/${roomId}/answer`)
          }
        }
      )
      .subscribe()

    return () => {
      playersChannel.unsubscribe()
      roomChannel.unsubscribe()
    }
  }, [room?.id, roomId, router])

  const handleStartGame = async () => {
    if (!isHost || players.length < 1) return
    setIsStarting(true)

    try {
      const { error } = await supabase
        .from('rooms')
        .update({ status: 'answering' })
        .eq('id', roomId)

      if (error) throw error

      router.push(`/room/${roomId}/answer`)
    } catch (error) {
      console.error('Error starting game:', error)
      alert('ゲームの開始に失敗しました')
      setIsStarting(false)
    }
  }

  const handleCopyUrl = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(roomUrl)
      } else {
        const textArea = document.createElement('textarea')
        textArea.value = roomUrl
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        textArea.remove()
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  if (isLoading) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ mt: 4 }}>
          <Paper elevation={3} sx={{ p: 4 }}>
            <Skeleton variant="text" width="60%" height={40} sx={{ mx: 'auto', mb: 2 }} />
            <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2, mb: 3 }} />
            <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 2 }} />
          </Paper>
        </Box>
      </Container>
    )
  }

  if (!room) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ mt: 8 }}>
          <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="error">
              ルームが見つかりません
            </Typography>
          </Paper>
        </Box>
      </Container>
    )
  }

  return (
    <Container maxWidth="sm" sx={{ pb: 4, pt: 2 }}>
      {/* ヘッダー */}
      <Fade in timeout={500}>
        <Box sx={{ mt: 3, mb: 3, textAlign: 'center' }}>
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
              mb: 2,
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
            variant="h5"
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              mb: 1,
            }}
          >
            {room.room_name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            参加者を待っています...
          </Typography>
        </Box>
      </Fade>

      {/* QRコードと招待リンク */}
      <Grow in timeout={600}>
        <Paper
          elevation={3}
          sx={{
            p: 3,
            mb: 3,
            borderRadius: 3,
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <QrCodeIcon color="primary" />
            <Typography variant="h6" fontWeight="bold">
              招待
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              p: 2,
              mb: 2,
              borderRadius: 2,
              background: 'white',
            }}
          >
            <QRCodeCanvas
              value={roomUrl}
              size={150}
              level="M"
              includeMargin
            />
          </Box>

          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              background: 'rgba(255, 255, 255, 0.8)',
              mb: 2,
              wordBreak: 'break-all',
              fontSize: '0.75rem',
              fontFamily: 'monospace',
            }}
          >
            {roomUrl}
          </Box>

          <Button
            fullWidth
            variant="contained"
            startIcon={<ContentCopyIcon />}
            onClick={handleCopyUrl}
            color={copied ? 'success' : 'primary'}
          >
            {copied ? 'コピーしました！' : 'URLをコピー'}
          </Button>
        </Paper>
      </Grow>

      {/* 参加者一覧 */}
      <Fade in timeout={700}>
        <Paper elevation={3} sx={{ p: 3, mb: 3, borderRadius: 3 }}>
          {(() => {
            // ダミーデータを含めた表示用プレイヤーリスト
            const displayPlayers = generateDummyPlayers(30, players) // 30人分表示
            return (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PersonIcon color="primary" />
                    <Typography variant="h6" fontWeight="bold">
                      参加者
                    </Typography>
                  </Box>
                  <Chip
                    label={`${displayPlayers.length}人`}
                    color="primary"
                    size="small"
                    sx={{
                      fontWeight: 700,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    }}
                  />
                </Box>

                {displayPlayers.length === 0 ? (
                  <Box sx={{ py: 4, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      まだ誰も参加していません
                    </Typography>
                  </Box>
                ) : (
                  <>
                    {/* グリッド表示 */}
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                        gap: 1,
                      }}
                    >
                      {displayPlayers.slice(0, INITIAL_DISPLAY_COUNT).map((player, index) => (
                  <Grow in timeout={200 + index * 50} key={player.id}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        p: 1,
                        borderRadius: 2,
                        background: player.id === playerId
                          ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%)'
                          : player.is_host
                          ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(251, 191, 36, 0.1) 100%)'
                          : 'rgba(0, 0, 0, 0.02)',
                        border: player.id === playerId
                          ? '2px solid rgba(102, 126, 234, 0.3)'
                          : player.is_host
                          ? '1px solid rgba(245, 158, 11, 0.3)'
                          : '1px solid rgba(0, 0, 0, 0.05)',
                      }}
                    >
                      <Avatar
                        sx={{
                          width: 28,
                          height: 28,
                          fontSize: '0.75rem',
                          background: player.is_host
                            ? 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)'
                            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        }}
                      >
                        {player.nickname.charAt(0)}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: player.id === playerId || player.is_host ? 600 : 400,
                            fontSize: '0.8rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {player.nickname}
                          {player.id === playerId && ' (あなた)'}
                        </Typography>
                        {player.is_host && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <StarIcon sx={{ fontSize: 12, color: '#f59e0b' }} />
                            <Typography variant="caption" sx={{ color: '#f59e0b', fontSize: '0.65rem' }}>
                              ホスト
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  </Grow>
                ))}
              </Box>

                    {/* 折りたたみ部分 */}
                    {displayPlayers.length > INITIAL_DISPLAY_COUNT && (
                      <>
                        <Collapse in={showAllPlayers}>
                          <Box
                            sx={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                              gap: 1,
                              mt: 1,
                            }}
                          >
                            {displayPlayers.slice(INITIAL_DISPLAY_COUNT).map((player, index) => (
                              <Grow in={showAllPlayers} timeout={100 + index * 30} key={player.id}>
                                <Box
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    p: 1,
                                    borderRadius: 2,
                                    background: player.id === playerId
                                      ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%)'
                                      : 'rgba(0, 0, 0, 0.02)',
                                    border: player.id === playerId
                                      ? '2px solid rgba(102, 126, 234, 0.3)'
                                      : '1px solid rgba(0, 0, 0, 0.05)',
                                  }}
                                >
                                  <Avatar
                                    sx={{
                                      width: 28,
                                      height: 28,
                                      fontSize: '0.75rem',
                                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    }}
                                  >
                                    {player.nickname.charAt(0)}
                                  </Avatar>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      fontWeight: player.id === playerId ? 600 : 400,
                                      fontSize: '0.8rem',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      flex: 1,
                                    }}
                                  >
                                    {player.nickname}
                                    {player.id === playerId && ' (あなた)'}
                                  </Typography>
                                </Box>
                              </Grow>
                            ))}
                          </Box>
                        </Collapse>
                        <Button
                          fullWidth
                          variant="text"
                          size="small"
                          onClick={() => setShowAllPlayers(!showAllPlayers)}
                          startIcon={showAllPlayers ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          sx={{ mt: 1.5, color: 'text.secondary' }}
                        >
                          {showAllPlayers
                            ? '折りたたむ'
                            : `他${displayPlayers.length - INITIAL_DISPLAY_COUNT}人を表示`}
                        </Button>
                      </>
                    )}
                  </>
                )}
              </>
            )
          })()}
        </Paper>
      </Fade>

      {/* ゲーム開始ボタン（ホストのみ） */}
      {isHost && (
        <Fade in timeout={800}>
          <Paper
            elevation={3}
            sx={{
              p: 3,
              borderRadius: 3,
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(52, 211, 153, 0.15) 100%)',
              border: '2px solid rgba(16, 185, 129, 0.3)',
            }}
          >
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
              全員揃ったらゲームを開始しましょう
            </Typography>
            <Button
              fullWidth
              variant="contained"
              color="success"
              size="large"
              onClick={handleStartGame}
              disabled={players.length < 1 || isStarting}
              startIcon={<PlayArrowIcon />}
              sx={{
                py: 2,
                fontSize: '1.1rem',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              }}
            >
              {isStarting ? '開始中...' : 'ゲームを開始する'}
            </Button>
          </Paper>
        </Fade>
      )}

      {/* 非ホストへのメッセージ */}
      {!isHost && (
        <Fade in timeout={800}>
          <Paper
            elevation={2}
            sx={{
              p: 3,
              borderRadius: 3,
              textAlign: 'center',
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(251, 191, 36, 0.1) 100%)',
            }}
          >
            <Typography variant="body1" color="text.secondary">
              ホストがゲームを開始するのを待っています...
            </Typography>
          </Paper>
        </Fade>
      )}
    </Container>
  )
}
