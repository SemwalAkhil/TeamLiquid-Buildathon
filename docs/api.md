# API Reference

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | Service health |
| POST | `/api/auth/register` | Create/update phone identity |
| POST | `/api/auth/request-otp` | Create OTP challenge |
| POST | `/api/auth/verify-otp` | Verify challenge and receive JWT |
| GET | `/api/users/me` | Read signed-in identity |
| GET | `/api/emails` | List messages addressed to or sent by user |
| POST | `/api/emails` | Compose with `to`, `cc`, `bcc`, `subject`, `body` |
| PATCH | `/api/emails/:id/read` | Mark a message read |
| POST | `/api/twilio/sms` | SMS account-creation webhook |
| POST | `/api/twilio/voice` | TwiML voice entry webhook |

Protected endpoints require `Authorization: Bearer <JWT>`.
