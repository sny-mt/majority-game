// プレイヤーIDの管理

const PLAYER_ID_KEY = 'majority_game_player_id'

/**
 * UUIDv4を生成
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * localStorageからプレイヤーIDを取得、なければ生成して保存
 */
export function getOrCreatePlayerId(): string {
  if (typeof window === 'undefined') {
    return '' // SSR時は空文字を返す
  }

  let playerId = localStorage.getItem(PLAYER_ID_KEY)

  if (!playerId) {
    playerId = generateUUID()
    localStorage.setItem(PLAYER_ID_KEY, playerId)
  }

  return playerId
}

/**
 * プレイヤーIDをlocalStorageに保存
 */
export function setPlayerId(playerId: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(PLAYER_ID_KEY, playerId)
}

/**
 * プレイヤーIDをクリア（デバッグ用）
 */
export function clearPlayerId(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(PLAYER_ID_KEY)
}
