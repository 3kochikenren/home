# form-notify

Supabase Edge Function for form mail notifications.

## Required secrets

Set these in Supabase project secrets:

- `RESEND_API_KEY`: Resend API key
- `FORM_NOTIFY_FROM`: sender address (example: `onboarding@resend.dev`)
- `FORM_NOTIFY_TO`: fallback destination address

## Deploy

```bash
supabase functions deploy form-notify
```

## Notes

- Frontend calls this function after inserting records into DB.
- You can override destination mail in DB setting `form_notify_to`.
