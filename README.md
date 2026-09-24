# PhoneMail

**One identity, multiple access channels.** PhoneMail turns a phone number into an accessible email identity such as `9888820532@phonemail.local`. It provides a conversation-first mobile experience and a focused desktop inbox from one shared API.

## Quick start

```bash
cp .env.example .env
docker compose up -d --build
```

- Web client: <http://localhost:5173>
- API health check: <http://localhost:3000/health>
- Local SMTP test console (Mailpit): <http://localhost:8025>

For the built-in demo, enter any valid phone number and use OTP **123456**. This demo OTP is deliberately only returned outside production.

## Features

- Phone-number-derived, configurable email identity (`EMAIL_DOMAIN`).
- OTP verification before token issuance, with expiry and attempt limits; password hash column is ready for fallback authentication.
- Conversation-centric responsive interface: WhatsApp-inspired at small widths and Gmail-inspired at desktop widths.
- Compose messages with To, CC, BCC, subject, body, and replies.
- Fastify API, PostgreSQL schema, local Mailpit SMTP container, and Twilio-compatible SMS/voice webhooks.
- High-contrast, low-image UI with large touch targets for lower-bandwidth and rural-first use.

## Architecture

```text
Responsive Web Client ─┐
                       ├── Fastify API ── PostgreSQL
Twilio IVR / SMS ──────┤       │
                       │       └───────── Mailpit / local SMTP
                       └── phone-number email identity
```

See [`docs/architecture.md`](docs/architecture.md), [`docs/api.md`](docs/api.md), and [`docs/requirements.md`](docs/requirements.md) for the detailed SDLC artifacts.

## Important implementation note

The compose API persists outgoing mail plus recipient metadata. Mailpit is included as a local SMTP test service. Production delivery and inbound SMTP relay credentials should be supplied through environment variables; no provider secret is committed to this repository.
