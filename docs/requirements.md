# Requirement Analysis

## Problem statement
People who primarily identify and communicate through a phone number need an email identity that is simple to create and usable on mobile, web, SMS, and IVR channels.

## Objectives
1. Create a configurable address from a verified phone number.
2. Make email conversations approachable on a mobile-first interface.
3. Provide conventional desktop email access without duplicating backend logic.
4. Support local deployment with Docker Compose.

## Functional requirements
- Register or log in with phone number and OTP; password storage supports a later fallback flow.
- Derive an address as `{phone}@{EMAIL_DOMAIN}`.
- Send messages with To, CC, BCC, subject, and body; show a unified conversation view.
- Persist users, OTP sessions, mail, recipients, and aliases in PostgreSQL.
- Expose Twilio-compatible `/api/twilio/sms` and `/api/twilio/voice` registration webhooks.
- Alert non-app users through the communication integration when production SMS credentials are configured.

## Non-functional requirements
- Mobile-first, keyboard-accessible controls, plain-language errors, high contrast, and low visual weight.
- OTPs expire after five minutes and fail after five attempts.
- Secrets are environment variables; JWTs expire after eight hours.
- The project starts through `docker compose up -d --build`.

## Acceptance criteria
A user can request and verify an OTP, see a generated identity, open a conversation, reply, compose a message with CC/BCC, and run the full stack locally. A developer can inspect the API health endpoint and Mailpit UI after Compose starts.
