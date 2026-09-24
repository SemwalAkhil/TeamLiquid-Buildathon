# Architecture

```text
Phone / browser ──► React responsive client ──► Fastify API ──► PostgreSQL
                                                    │
Inbound SMS / IVR ──► Twilio-compatible webhooks ──┤
                                                    └──► Local SMTP test service (Mailpit)
```

## Data flow
1. A phone number is normalized to digits and becomes `{phone}@EMAIL_DOMAIN`.
2. OTP requests are hashed in memory for the local MVP and expire after five minutes. Verified users receive an eight-hour signed JWT.
3. Mail compose stores one `emails` record and its `TO`, `CC`, and `BCC` rows. Thread keys connect replies and mobile conversations.
4. The client adapts by viewport: a compact conversation list at mobile widths and a two-pane Gmail-like inbox on desktop.

## Database model
- `users`: identity, locale, password-hash fallback, app presence.
- `otp_sessions`: durable production-ready OTP session model.
- `emails` and `email_recipients`: message data and recipient categories.
- `aliases`: future address management support.
