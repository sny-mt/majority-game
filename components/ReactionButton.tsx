'use client'

import { useState, useEffect } from 'react'
import { Box, IconButton, Tooltip, Chip, Popover, Snackbar, Alert } from '@mui/material'
import AddReactionIcon from '@mui/icons-material/AddReaction'
import { supabase } from '@/lib/supabase'
import { REACTION_EMOJIS, type ReactionEmoji, type Reaction } from '@/types/database'

interface ReactionButtonProps {
  answerId: string
  playerId: string
  compact?: boolean
}

interface ReactionCount {
  emoji: ReactionEmoji
  count: number
  hasReacted: boolean
}

export function ReactionButton({ answerId, playerId, compact = false }: ReactionButtonProps) {
  const [reactions, setReactions] = useState<Reaction[]>([])
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // リアクションを取得
  useEffect(() => {
    const fetchReactions = async () => {
      const { data } = await supabase
        .from('reactions')
        .select('*')
        .eq('answer_id', answerId)

      if (data) {
        setReactions(data)
      }
    }

    fetchReactions()

    // リアルタイム購読
    const channel = supabase
      .channel(`reactions-${answerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reactions',
          filter: `answer_id=eq.${answerId}`
        },
        () => {
          fetchReactions()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [answerId])

  // リアクションの集計
  const reactionCounts: ReactionCount[] = REACTION_EMOJIS.map(emoji => ({
    emoji,
    count: reactions.filter(r => r.reaction === emoji).length,
    hasReacted: reactions.some(r => r.reaction === emoji && r.player_id === playerId)
  }))

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleReaction = async (emoji: ReactionEmoji) => {
    if (isLoading) return
    setIsLoading(true)
    setError(null)

    try {
      const existingReaction = reactions.find(
        r => r.reaction === emoji && r.player_id === playerId
      )

      if (existingReaction) {
        // リアクションを削除
        const { error: deleteError } = await supabase
          .from('reactions')
          .delete()
          .eq('id', existingReaction.id)

        if (deleteError) throw deleteError

        // ローカルで即座に反映
        setReactions(prev => prev.filter(r => r.id !== existingReaction.id))
      } else {
        // リアクションを追加
        const { data, error: insertError } = await supabase
          .from('reactions')
          .insert({
            answer_id: answerId,
            player_id: playerId,
            reaction: emoji
          })
          .select()
          .single()

        if (insertError) throw insertError

        // ローカルで即座に反映
        if (data) {
          setReactions(prev => [...prev, data])
        }
      }
    } catch (err: unknown) {
      console.error('Error toggling reaction:', err)
      const errorMessage = err instanceof Error ? err.message : 'リアクションの送信に失敗しました'
      // reactionsテーブルが存在しない場合のエラーメッセージ
      if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
        setError('リアクション機能は準備中です')
      } else {
        setError(errorMessage)
      }
    } finally {
      setIsLoading(false)
      handleClose()
    }
  }

  const open = Boolean(anchorEl)
  const activeReactions = reactionCounts.filter(r => r.count > 0)

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
      {/* 既存のリアクション表示 */}
      {activeReactions.map(({ emoji, count, hasReacted }) => (
        <Chip
          key={emoji}
          label={`${emoji} ${count}`}
          size="small"
          onClick={() => handleReaction(emoji)}
          sx={{
            cursor: 'pointer',
            fontSize: '0.9rem',
            height: 32,
            fontWeight: 600,
            background: hasReacted
              ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(118, 75, 162, 0.3) 100%)'
              : 'rgba(255, 255, 255, 0.9)',
            border: hasReacted
              ? '2px solid rgba(102, 126, 234, 0.6)'
              : '2px solid rgba(0, 0, 0, 0.15)',
            color: hasReacted ? '#5a67d8' : 'inherit',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            '&:hover': {
              background: hasReacted
                ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.4) 0%, rgba(118, 75, 162, 0.4) 100%)'
                : 'rgba(255, 255, 255, 1)',
              transform: 'scale(1.05)',
              boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
            },
            transition: 'all 0.2s',
          }}
        />
      ))}

      {/* リアクション追加ボタン */}
      <Tooltip title="リアクション">
        <IconButton
          size="small"
          onClick={handleClick}
          sx={{
            width: 28,
            height: 28,
            opacity: compact && activeReactions.length === 0 ? 0.5 : 1,
            '&:hover': { opacity: 1 },
          }}
        >
          <AddReactionIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>

      {/* リアクション選択ポップオーバー */}
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        slotProps={{
          paper: {
            sx: {
              borderRadius: 3,
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            }
          }
        }}
      >
        <Box sx={{ display: 'flex', gap: 0.5, p: 1 }}>
          {REACTION_EMOJIS.map(emoji => {
            const hasReacted = reactionCounts.find(r => r.emoji === emoji)?.hasReacted
            return (
              <IconButton
                key={emoji}
                onClick={() => handleReaction(emoji)}
                disabled={isLoading}
                sx={{
                  fontSize: '1.5rem',
                  width: 44,
                  height: 44,
                  background: hasReacted
                    ? 'rgba(102, 126, 234, 0.2)'
                    : 'transparent',
                  '&:hover': {
                    background: 'rgba(102, 126, 234, 0.15)',
                    transform: 'scale(1.2)',
                  },
                  transition: 'all 0.2s',
                }}
              >
                {emoji}
              </IconButton>
            )
          })}
        </Box>
      </Popover>

      {/* エラー表示 */}
      <Snackbar
        open={!!error}
        autoHideDuration={3000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  )
}
