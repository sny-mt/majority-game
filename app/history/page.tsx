'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  CircularProgress,
  Chip,
  Card,
  CardContent,
  CardActionArea,
  Fade,
  Grow,
  TextField,
  InputAdornment,
} from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import HistoryIcon from '@mui/icons-material/History'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import GroupsIcon from '@mui/icons-material/Groups'
import QuizIcon from '@mui/icons-material/Quiz'
import SearchIcon from '@mui/icons-material/Search'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import PersonIcon from '@mui/icons-material/Person'
import { supabase } from '@/lib/supabase'
import { getOrCreatePlayerId } from '@/lib/utils/player'
import type { Room } from '@/types/database'

interface RoomWithDetails extends Room {
  playerCount: number
  questionCount: number
  winner?: string
  myNickname?: string
  myRank?: number
  myScore?: number
}

export default function HistoryPage() {
  const router = useRouter()
  const [rooms, setRooms] = useState<RoomWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const playerId = getOrCreatePlayerId()
        if (!playerId) {
          setRooms([])
          setIsLoading(false)
          return
        }

        // 自分が参加したルームIDを取得
        const { data: myPlayerData, error: playerError } = await supabase
          .from('players')
          .select('room_id, nickname, score')
          .eq('id', playerId)

        if (playerError) throw playerError

        if (!myPlayerData || myPlayerData.length === 0) {
          setRooms([])
          setIsLoading(false)
          return
        }

        // 参加したルームIDのリスト
        const myRoomIds = myPlayerData.map(p => p.room_id)
        const myRoomDataMap = new Map(myPlayerData.map(p => [p.room_id, { nickname: p.nickname, score: p.score }]))

        // 終了したルームのみ取得（自分が参加したもの）
        const { data: roomsData, error: roomsError } = await supabase
          .from('rooms')
          .select('*')
          .in('id', myRoomIds)
          .eq('status', 'finished')
          .order('created_at', { ascending: false })
          .limit(50)

        if (roomsError) throw roomsError

        if (!roomsData || roomsData.length === 0) {
          setRooms([])
          setIsLoading(false)
          return
        }

        // 各ルームの詳細を取得
        const roomsWithDetails = await Promise.all(
          roomsData.map(async (room) => {
            // プレイヤー数を取得
            const { count: playerCount } = await supabase
              .from('players')
              .select('*', { count: 'exact', head: true })
              .eq('room_id', room.id)

            // 質問数を取得
            const { count: questionCount } = await supabase
              .from('questions')
              .select('*', { count: 'exact', head: true })
              .eq('room_id', room.id)

            // 全プレイヤーを取得して順位計算
            const { data: allPlayers } = await supabase
              .from('players')
              .select('id, nickname, score')
              .eq('room_id', room.id)
              .order('score', { ascending: false })

            const winner = allPlayers?.[0]?.nickname
            const myData = myRoomDataMap.get(room.id)

            // 自分の順位を計算
            let myRank = 0
            if (allPlayers && myData) {
              for (let i = 0; i < allPlayers.length; i++) {
                if (allPlayers[i].score === myData.score) {
                  myRank = i + 1
                  break
                }
              }
            }

            return {
              ...room,
              playerCount: playerCount || 0,
              questionCount: questionCount || 0,
              winner,
              myNickname: myData?.nickname,
              myRank,
              myScore: myData?.score,
            }
          })
        )

        setRooms(roomsWithDetails)
      } catch (error) {
        console.error('Error fetching rooms:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchRooms()
  }, [])

  const filteredRooms = rooms.filter(room =>
    room.room_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    room.winner?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (isLoading) {
    return (
      <Container maxWidth="md">
        <Box sx={{ mt: 8, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      </Container>
    )
  }

  return (
    <Container maxWidth="md" sx={{ pb: 4, pt: 2 }}>
      {/* ヘッダー */}
      <Fade in timeout={500}>
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              mb: 2,
            }}
          >
            <HistoryIcon sx={{ fontSize: 40, color: 'white' }} />
          </Box>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              mb: 1,
            }}
          >
            過去のルーム
          </Typography>
          <Typography variant="body1" color="text.secondary">
            あなたが参加したゲームの結果を確認できます
          </Typography>
        </Box>
      </Fade>

      {/* 検索・ホームボタン */}
      <Fade in timeout={600}>
        <Paper elevation={2} sx={{ p: 2, mb: 3, borderRadius: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
            <TextField
              fullWidth
              size="small"
              placeholder="ルーム名や勝者名で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
              }}
              sx={{ flex: 1 }}
            />
            <Button
              variant="outlined"
              startIcon={<HomeIcon />}
              onClick={() => router.push('/')}
              sx={{ minWidth: 120 }}
            >
              ホームへ
            </Button>
          </Box>
        </Paper>
      </Fade>

      {/* ルーム一覧 */}
      {filteredRooms.length === 0 ? (
        <Fade in timeout={700}>
          <Paper
            elevation={3}
            sx={{
              p: 6,
              textAlign: 'center',
              borderRadius: 3,
              background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)',
            }}
          >
            <HistoryIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {searchQuery ? '検索結果がありません' : '過去のルームがありません'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {searchQuery
                ? '別のキーワードで検索してみてください'
                : 'ゲームを終了すると、ここに履歴が表示されます'}
            </Typography>
            <Button
              variant="contained"
              startIcon={<HomeIcon />}
              onClick={() => router.push('/')}
            >
              新しいゲームを始める
            </Button>
          </Paper>
        </Fade>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filteredRooms.map((room, index) => (
            <Grow in timeout={500 + index * 100} key={room.id}>
              <Card
                elevation={2}
                sx={{
                  borderRadius: 3,
                  transition: 'all 0.2s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: 6,
                  },
                }}
              >
                <CardActionArea onClick={() => router.push(`/room/${room.id}/summary`)}>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                          {room.room_name}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                          <CalendarTodayIcon sx={{ fontSize: 14 }} />
                          <Typography variant="caption">
                            {formatDate(room.created_at)}
                          </Typography>
                        </Box>
                      </Box>
                      {room.myRank === 1 ? (
                        <Chip
                          icon={<EmojiEventsIcon />}
                          label="優勝！"
                          size="small"
                          sx={{
                            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.3) 0%, rgba(251, 191, 36, 0.3) 100%)',
                            border: '1px solid rgba(245, 158, 11, 0.5)',
                            fontWeight: 700,
                            '& .MuiChip-icon': {
                              color: '#f59e0b',
                            },
                          }}
                        />
                      ) : room.myRank ? (
                        <Chip
                          label={`${room.myRank}位`}
                          size="small"
                          sx={{
                            background: 'rgba(102, 126, 234, 0.15)',
                            border: '1px solid rgba(102, 126, 234, 0.3)',
                            fontWeight: 600,
                          }}
                        />
                      ) : null}
                    </Box>
                    {/* 自分の成績 */}
                    {room.myNickname && (
                      <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        mb: 1.5,
                        p: 1,
                        borderRadius: 1,
                        background: 'rgba(102, 126, 234, 0.08)',
                      }}>
                        <PersonIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {room.myNickname}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          ·
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                          {room.myScore}pt
                        </Typography>
                      </Box>
                    )}
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <GroupsIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">
                          {room.playerCount}人
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <QuizIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">
                          {room.questionCount}問
                        </Typography>
                      </Box>
                      {room.winner && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <EmojiEventsIcon sx={{ fontSize: 18, color: '#f59e0b' }} />
                          <Typography variant="body2" color="text.secondary">
                            {room.winner}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grow>
          ))}
        </Box>
      )}

      {/* 件数表示 */}
      {filteredRooms.length > 0 && (
        <Fade in timeout={800}>
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {searchQuery
                ? `${filteredRooms.length}件の検索結果`
                : `${filteredRooms.length}件のルーム履歴`}
            </Typography>
          </Box>
        </Fade>
      )}
    </Container>
  )
}
