// 回答集計のためのヘルパー関数

import { Answer, Player } from '@/types/database'

export interface AnswerGroup {
  answer: string
  count: number
  percentage: number
  players: string[]
  isMajority: boolean
}

/**
 * 回答を集計してグループ化
 */
export function aggregateAnswers(
  answers: Answer[],
  players: Player[],
  choiceA: string,
  choiceB: string
): AnswerGroup[] {
  // プレイヤーIDとニックネームのマップを作成
  const playerMap = new Map<string, string>()
  players.forEach(player => {
    playerMap.set(player.id, player.nickname)
  })

  // 回答をグループ化
  const answerMap = new Map<string, string[]>()
  answers.forEach(answer => {
    const nickname = playerMap.get(answer.player_id) || '不明'
    const answerKey = answer.answer

    if (!answerMap.has(answerKey)) {
      answerMap.set(answerKey, [])
    }
    answerMap.get(answerKey)!.push(nickname)
  })

  // 集計結果を配列に変換
  const groups: AnswerGroup[] = []
  const totalAnswers = answers.length

  answerMap.forEach((playerNicknames, answerText) => {
    const count = playerNicknames.length
    const percentage = totalAnswers > 0 ? (count / totalAnswers) * 100 : 0

    // A/Bの場合は表示用のテキストを追加
    let displayAnswer = answerText
    if (answerText === 'A') {
      displayAnswer = `${choiceA} (A)`
    } else if (answerText === 'B') {
      displayAnswer = `${choiceB} (B)`
    }

    groups.push({
      answer: displayAnswer,
      count,
      percentage,
      players: playerNicknames,
      isMajority: false
    })
  })

  // カウント順にソート
  groups.sort((a, b) => b.count - a.count)

  // 最多回答にマジョリティフラグを立てる
  if (groups.length > 0) {
    const maxCount = groups[0].count
    groups.forEach(group => {
      if (group.count === maxCount) {
        group.isMajority = true
      }
    })
  }

  return groups
}
