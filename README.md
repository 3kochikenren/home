# web_portal

参政党高知県支部連合会サイトのフロントエンドです。

## 追加したフォーム機能

- お問い合わせ: `contact.html`
- ボランティア募集: `volunteer.html`
- ご寄付: `donation.html`

各フォームは送信時に次を実行します。

1. Supabase DBへ保存
2. Supabase Edge Function `form-notify` を呼び出してメール通知

## DBマイグレーション

以下を適用してください。

- `supabase/migrations/20260530_forms_and_notifications.sql`

作成されるテーブル:

- `contact_inquiries`
- `volunteer_applications`
- `donation_applications`

## メール通知の設定

Edge Function:

- `supabase/functions/form-notify/index.ts`

必要な Supabase secrets:

- `RESEND_API_KEY`
- `FORM_NOTIFY_FROM`
- `FORM_NOTIFY_TO`

デプロイ例:

```bash
supabase functions deploy form-notify
```

任意で settings テーブルに以下を設定できます。

- `form_notify_function_url` (関数URLを上書き)
- `form_notify_to` (通知先メールアドレス)