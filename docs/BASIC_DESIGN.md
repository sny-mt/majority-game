# マジョリティゲーム 基本設計書

## 1. 概要

### 1.1 システム概要
マジョリティゲームは、参加者の「多数派」を当てるリアルタイム対戦型パーティゲームです。
Webブラウザ上で動作し、QRコード/URLを共有することで複数人が同時参加できます。

### 1.2 主な機能
- ルーム作成・参加
- リアルタイム回答同期
- 多数派予想と結果発表
- スコアランキング

### 1.3 技術スタック
| 項目 | 技術 |
|------|------|
| フロントエンド | Next.js 15.5.7 (App Router) |
| UIライブラリ | Material-UI (MUI) v6 |
| バックエンド | Supabase (PostgreSQL + Realtime) |
| デプロイ | Vercel |
| 言語 | TypeScript |

---

## 2. システム構成

### 2.1 アーキテクチャ
```
┌─────────────────┐     ┌─────────────────┐
│   クライアント   │────▶│     Vercel      │
│  (ブラウザ)     │◀────│   (Next.js)     │
└─────────────────┘     └────────┬────────┘
                                 │
                        ┌────────▼────────┐
                        │    Supabase     │
                        │  ┌───────────┐  │
                        │  │PostgreSQL │  │
                        │  └───────────┘  │
                        │  ┌───────────┐  │
                        │  │ Realtime  │  │
                        │  └───────────┘  │
                        └─────────────────┘
```

### 2.2 ディレクトリ構成
```
majority-game/
├── app/                      # Next.js App Router
│   ├── page.tsx              # ホーム（ルーム作成）
│   ├── layout.tsx            # 共通レイアウト
│   └── room/[roomId]/
│       ├── join/page.tsx     # 参加画面
│       ├── waiting/page.tsx  # 待機画面
│       ├── answer/page.tsx   # 回答画面
│       ├── result/page.tsx   # 結果画面
│       └── summary/page.tsx  # 最終結果画面
├── components/               # UIコンポーネント
│   ├── AnimatedButton.tsx    # アニメーションボタン
│   ├── HowToPlayDialog.tsx   # 遊び方ダイアログ
│   ├── PopEffect.tsx         # エフェクト
│   └── ThemeRegistry.tsx     # テーマ設定
├── lib/
│   ├── supabase.ts           # Supabaseクライアント
│   └── utils/
│       ├── aggregation.ts    # 回答集計ロジック
│       ├── player.ts         # プレイヤーID管理
│       └── validation.ts     # 入力バリデーション
├── types/
│   └── database.ts           # 型定義
└── docs/
    └── BASIC_DESIGN.md       # 本ドキュメント
```

---

## 3. データベース設計

### 3.1 ER図
```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   rooms     │       │  questions  │       │   answers   │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id (PK)     │◀──┐   │ id (PK)     │◀──┐   │ id (PK)     │
│ room_name   │   │   │ room_id(FK) │───┘   │ question_id │───┐
│ status      │   │   │ question_text│      │ player_id   │───┤
│ current_idx │   │   │ choice_a    │       │ answer      │   │
│ host_id     │   │   │ choice_b    │       │ prediction  │   │
│ created_at  │   │   │ order_index │       │ comment     │   │
└─────────────┘   │   └─────────────┘       │ is_correct  │   │
                  │                          │ points      │   │
                  │   ┌─────────────┐       │ created_at  │   │
                  │   │   players   │       └─────────────┘   │
                  │   ├─────────────┤                         │
                  └───│ room_id(FK) │                         │
                      │ id (PK)     │◀────────────────────────┘
                      │ nickname    │
                      │ is_host     │
                      │ score       │
                      │ joined_at   │
                      └─────────────┘
```

### 3.2 テーブル定義

#### rooms（ルーム）
| カラム名 | 型 | 説明 |
|----------|------|------|
| id | UUID | 主キー |
| room_name | VARCHAR(100) | ルーム名 |
| status | VARCHAR(20) | ステータス |
| current_question_index | INTEGER | 現在の質問番号 |
| host_player_id | VARCHAR(36) | ホストプレイヤーID |
| created_at | TIMESTAMP | 作成日時 |

**ステータス値:**
- `waiting` - 参加者待機中
- `answering` - 回答受付中
- `showing_result` - 結果表示中
- `finished` - ゲーム終了

#### questions（質問）
| カラム名 | 型 | 説明 |
|----------|------|------|
| id | UUID | 主キー |
| room_id | UUID | ルームID (FK) |
| question_text | VARCHAR(500) | 質問文 |
| choice_a | VARCHAR(100) | 選択肢A |
| choice_b | VARCHAR(100) | 選択肢B |
| order_index | INTEGER | 表示順序 |

#### players（プレイヤー）
| カラム名 | 型 | 説明 |
|----------|------|------|
| id | VARCHAR(36) | プレイヤーID (UUID) |
| room_id | UUID | ルームID (FK) |
| nickname | VARCHAR(50) | ニックネーム |
| is_host | BOOLEAN | ホストフラグ |
| score | INTEGER | 累計スコア |
| joined_at | TIMESTAMP | 参加日時 |

#### answers（回答）
| カラム名 | 型 | 説明 |
|----------|------|------|
| id | UUID | 主キー |
| question_id | UUID | 質問ID (FK) |
| player_id | VARCHAR(36) | プレイヤーID (FK) |
| answer | VARCHAR(100) | 回答（A/B/自由記述） |
| prediction | VARCHAR(100) | 多数派予想 |
| comment | TEXT | コメント |
| is_correct_prediction | BOOLEAN | 予想的中フラグ |
| points_earned | INTEGER | 獲得ポイント |
| created_at | TIMESTAMP | 回答日時 |

---

## 4. 画面設計

### 4.1 画面遷移図
```
[ホーム] ──作成──▶ [待機画面] ──開始──▶ [回答画面]
    │                  ▲                    │
    │                  │                    ▼
    └──参加──▶ [参加画面]              [結果画面]
                                           │
                              次の質問 ◀───┤
                                           │
                              終了 ───▶ [最終結果]
```

### 4.2 各画面の機能

#### ホーム画面（/）
- ホストニックネーム入力
- ルーム名入力（任意）
- お題・選択肢の入力（複数可）
- 過去ルームからの再利用
- ルーム作成ボタン
- QRコード/URL表示

#### 参加画面（/room/[roomId]/join）
- ルーム存在確認
- ニックネーム入力
- 参加ボタン

#### 待機画面（/room/[roomId]/waiting）
- QRコード表示
- 参加者リスト（リアルタイム更新）
- 遊び方ボタン
- ゲーム開始ボタン（ホストのみ）

#### 回答画面（/room/[roomId]/answer）
- 質問文表示
- 選択肢A/B
- 自由記述入力（シンクロボーナス説明付き）
- 多数派予想選択
- コメント入力
- 回答送信ボタン
- 回答状況表示

#### 結果画面（/room/[roomId]/result）
- 自分の回答・予想表示
- マジョリティ回答発表
- 各回答の投票数・割合
- 現在のランキング
- 順位変動表示
- 予想的中・シンクロボーナス表示
- 次の質問ボタン（ホストのみ）

#### 最終結果画面（/room/[roomId]/summary）
- 最終ランキング（1〜3位演出）
- 全質問の回答履歴
- 各プレイヤーのスコア詳細
- 結果画像保存機能

---

## 5. ポイントシステム

### 5.1 獲得ポイント

| 条件 | ポイント |
|------|----------|
| 多数派予想的中 | +10pt |
| 自由記述シンクロボーナス | +（一致人数 × 5）pt |

### 5.2 シンクロボーナス
- 自由記述で他のプレイヤーと**完全一致**した場合に発生
- 2人以上の一致が必要
- 例: 3人が「カレー」と回答 → 各自 +15pt（3×5）

---

## 6. リアルタイム同期

### 6.1 Supabase Realtime使用箇所

| 画面 | 監視対象 | トリガー |
|------|----------|----------|
| 待機画面 | players テーブル | 参加者の追加 |
| 待機画面 | rooms テーブル | status変更 |
| 回答画面 | answers テーブル | 回答の追加 |
| 回答画面 | rooms テーブル | status変更 |
| 結果画面 | rooms テーブル | status変更 |

### 6.2 状態遷移

```
waiting ──[ゲーム開始]──▶ answering
                              │
                    [全員回答 or 締切]
                              ▼
                        showing_result
                              │
              [次の質問] ◀────┴────▶ [最後の質問終了]
                   │                        │
                   ▼                        ▼
              answering                 finished
```

---

## 7. セキュリティ

### 7.1 入力バリデーション
- XSS対策: HTMLエスケープ処理
- 文字数制限: 各フィールドに最大長設定
- 禁止文字: 制御文字の除去

### 7.2 認証
- プレイヤーIDはlocalStorageに保存されたUUID
- ルームへのアクセスはURLを知っている人のみ
- ホスト権限はhost_player_idで判定

---

## 8. UX機能

### 8.1 アニメーション・エフェクト
| 機能 | 説明 |
|------|------|
| 紙吹雪 | 正解時にcanvas-confettiで演出 |
| 画面シェイク | 不正解時に1秒間揺れる |
| ボタンアニメーション | ホバーでバウンス、クリックでポップ |
| 順位変動表示 | ランキング変動をアイコンで表示 |

### 8.2 遊び方ダイアログ
- 待機画面からアクセス可能
- 5ステップのスライド形式
- スマホ画面イメージ付き

---

## 9. 非機能要件

### 9.1 対応ブラウザ
- Chrome（最新）
- Safari（最新）
- Firefox（最新）
- Edge（最新）

### 9.2 対応デバイス
- スマートフォン（iOS/Android）
- タブレット
- PC

### 9.3 パフォーマンス目標
- 初回ロード: 3秒以内
- ページ遷移: 1秒以内
- リアルタイム更新: 500ms以内

---

## 10. 今後の拡張案

- [ ] サウンドエフェクト
- [ ] 回答時間制限
- [ ] カスタムテーマ
- [ ] チーム対戦モード
- [ ] 質問テンプレート

---

## 更新履歴

| 日付 | バージョン | 更新内容 |
|------|------------|----------|
| 2025-12-05 | 1.0 | 初版作成 |
