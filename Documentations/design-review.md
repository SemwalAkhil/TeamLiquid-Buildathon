# PhoneMail — Cross-Document Design Consistency Review

> **Project:** PhoneMail (ALPHASTACK 7-Day Buildathon)  
> **Status:** Architecture & Design Review Report (Post Final Gate Review)  
> **Review Scope:** `requirements.md`, `architecture.md`, `database-design.md`, `api-design.md`, `implementation-plan.md`  
> **Review Date:** 2026-09-28

---

## 1. Issues Found During Consistency Review

During the cross-document consistency audit, the following architectural and design gaps were identified and resolved:

1. **Ambiguous Mobile App Status vs. SMS Suppression:**
   - *Issue:* The initial design used an overloaded `is_mobile_user` boolean flag that was conflated with opening the responsive mobile web interface in a browser.
   - *Impact:* Opening the responsive mobile website would have suppressed SMS notifications, directly violating Requirement 6.16 (*"SMS notifications shall apply to users who do not have the mobile application... including those who registered through web portal, web client, or phone call"*).
   - *Resolution:* Replaced `is_mobile_user` with an explicit capability flag `has_native_app` (or `native_app_registered`). Responsive mobile web usage strictly does **not** alter this flag and does **not** suppress SMS notifications.

2. **Mixed Canonical Email vs. Per-User Mailbox State:**
   - *Issue:* The previous `emails` table combined RFC message payload, recipient addressing, and user mailbox state (`is_read`, `folder`, `is_favorite`) in a single row with one `user_id`.
   - *Impact:* A single email with multiple recipients (or group emails) could not track independent read, starred, or trash states across recipients, and CC/BCC handling was denormalized in JSON blobs.
   - *Resolution:* Normalized into three distinct layers:
     - `messages`: Canonical, immutable RFC 5322 email payload and headers.
     - `message_recipients`: Multi-recipient addressing (`TO`, `CC`, `BCC`).
     - `mailbox_items`: Independent per-user mailbox state (`folder`, `is_read`, `is_favorite`).

3. **Incomplete Drafts Lifecycle:**
   - *Issue:* The initial API design had only a single draft creation endpoint without update, list, delete, or send operations.
   - *Impact:* Web client could not provide the required Gmail-style draft management.
   - *Resolution:* Implemented a complete RESTful draft lifecycle (`POST /api/v1/drafts`, `GET /api/v1/drafts`, `GET /api/v1/drafts/:id`, `PUT /api/v1/drafts/:id`, `DELETE /api/v1/drafts/:id`, `POST /api/v1/drafts/:id/send`) cleanly supported by `messages.is_draft` and `mailbox_items.folder = 'DRAFTS'`.

4. **Missing Mobile Recipient Lookup / Chat Resolution Endpoint:**
   - *Issue:* The mobile interaction requirement states: *search for a phone number -> determine registration status -> open/create conversation -> compose*. The initial API only supported bulk conversation listing.
   - *Impact:* Mobile client lacked a deterministic mechanism to look up contacts and transition directly into chat compose.
   - *Resolution:* Added `GET /api/v1/mobile/recipients/lookup` and `POST /api/v1/mobile/conversations/open`.

5. **Telephony Mode Switching & Offline Predictability:**
   - *Issue:* The previous architecture suggested dynamically falling back to mock mode if Twilio calls failed at runtime.
   - *Impact:* Silent runtime fallback masks configuration bugs and creates non-deterministic test states.
   - *Resolution:* Telephony mode is explicitly frozen by configuration (`TELEPHONY_PROVIDER=mock` vs `TELEPHONY_PROVIDER=twilio`). Mock mode is fully deterministic, operates zero-config, and logs SMS to stdout and an inspectable debug endpoint.

6. **Redundant Nginx / Reverse-Proxy Layers in Docker:**
   - *Issue:* Initial diagram showed dual proxy components.
   - *Impact:* Unnecessary configuration overhead during a 7-day buildathon.
   - *Resolution:* Streamlined into 4 clean containers: `frontend` (Nginx serving React SPA and proxying `/api` and `/events` to `http://backend:4000`), `backend` (Express API on 4000 & SMTP on 2525), `postgres` (PostgreSQL 16 on 5432), and `mailpit` (SMTP relay on 1025, web UI on 8025).

7. **Privileged Host Port 25 Conflict:**
   - *Issue:* Mapping host port 25 requires superuser/root permissions on many operating systems and frequently conflicts with local mail daemons.
   - *Impact:* Breaks the buildathon requirement for zero-hassle `docker compose up -d`.
   - *Resolution:* Standardized on host port `2525` for local SMTP ingestion.

8. **Ambiguous Backend Framework:**
   - *Issue:* Previous documentation cited "Node.js (Express or Fastify)".
   - *Resolution:* Frozen exclusively as **Node.js 20 LTS + TypeScript + Express**.

9. **Missing API Documentation Specifics:**
   - *Issue:* Missing explicit health check, attachment upload/download mechanics, SSE endpoint details, and clear authentication standards per endpoint.
   - *Resolution:* Added comprehensive documentation for `GET /api/v1/health`, `POST /api/v1/attachments/upload`, `GET /api/v1/attachments/:id/download`, `GET /api/v1/events`, and explicit Bearer auth tags.

10. **Coupling of OTP Verification and Account Creation (Final Gate Issue):**
    - *Issue:* `POST /api/v1/auth/verify-otp` was automatically creating an account whenever a non-existent user verified an OTP, blurring the boundary between verification and registration/login.
    - *Impact:* Unintended account creation during login attempts, inability to pass registration-specific metadata (display name, language selection), and violation of explicit intent.
    - *Resolution:* Strictly decoupled OTP verification from account creation:
      - `POST /api/v1/auth/verify-otp` **ONLY** verifies the 6-digit code against the stored hash and purpose, returning a short-lived signed `verificationToken`.
      - Account creation happens explicitly via `POST /api/v1/auth/register-web` or `POST /api/v1/auth/register`.
      - Login happens explicitly via `POST /api/v1/auth/login-otp`.

11. **Web Registration UI Field Input Count Clarification:**
    - *Issue:* Initial documentation incorrectly treated "Terms of Service" as an input parameter or checkbox.
    - *Impact:* Ambiguity over visible input field count on the web registration screen.
    - *Resolution:* Clarified that the Web Registration UI has strictly **two visible input fields**: (1) `Phone Number` and (2) `OTP`, followed by the `Next` button. "Terms of Service" is linked display text, not an input field.

12. **Database Single-Reply Uniqueness Enforcement:**
    - *Issue:* Single-reply enforcement was handled solely at the application logic layer, leaving a potential race condition under concurrent requests.
    - *Impact:* Two concurrent replies to the same message could violate Requirement 6.9 (*"Each message may be replied to only once"*).
    - *Resolution:* Added a PostgreSQL partial unique index:
      ```sql
      CREATE UNIQUE INDEX idx_messages_single_reply
      ON messages(in_reply_to_id)
      WHERE in_reply_to_id IS NOT NULL;
      ```
      Documented that the database itself enforces the single-reply rule. The API / service layer catches the PostgreSQL unique constraint violation (`23505`) and returns `HTTP 409 Conflict`.

13. **Attachment Download Security Standard:**
    - *Issue:* Initial specification allowed optional query-string tokens for attachment downloads.
    - *Impact:* Risk of token leakage via browser history, server access logs, and referrer headers.
    - *Resolution:* Strictly updated `GET /api/v1/attachments/:id/download` to require `Authorization: Bearer <JWT_TOKEN>`. Query-string tokens are not supported for downloads; query-token authentication is reserved solely for Server-Sent Events (`/api/v1/events`) due to browser EventSource limitations.

14. **Inbound SMS Account Creation Webhook & Local Mock Simulator:**
    - *Issue:* Initial API design documented IVR and SMS notifications, but lacked the inbound SMS account-creation webhook and local simulation tooling.
    - *Impact:* Inability to test or execute SMS-initiated account creation per Requirement 6.1.2.
    - *Resolution:* Fully defined `POST /api/v1/telephony/sms/inbound` with Twilio signature validation, phone normalization, idempotent user creation (`registration_source = 'SMS'`, `has_native_app = false`), address assignment (`phone@EMAIL_DOMAIN`), confirmation SMS, and TwiML response. Added `POST /api/v1/telephony/mock/simulate-sms` for zero-credential local testing.

15. **Strict Single-Purpose OTP Verification Token Security:**
    - *Issue:* Verification tokens lacked explicit purpose-binding rules, leaving a theoretical ambiguity where a registration token could attempt a login exchange.
    - *Impact:* Potential privilege escalation or logic bypass between login and registration flows.
    - *Resolution:* Enforced strict cryptographic purpose binding in Section 3.0 of `api-design.md`: `REGISTRATION` tokens cannot authenticate a login, `LOGIN` tokens cannot register, tokens expire after 10 minutes, and are single-use.

16. **Standalone Drafts & Conversation Database Integrity:**
    - *Issue:* The `messages` and `mailbox_items` tables initially had `conversation_id` marked NOT NULL, which conflicted with standalone drafts created via `POST /api/v1/drafts` (`"conversationId": null`).
    - *Impact:* Database constraint violation on standalone draft creation, or forced creation of empty placeholder conversations.
    - *Resolution:* Made `conversation_id` nullable for standalone drafts (`is_draft = true` and `folder = 'DRAFTS'`), added PostgreSQL database check constraints `chk_messages_conversation_req` and `chk_mailbox_conversation_req` ensuring non-draft items are strictly conversation-linked, and documented atomic conversation assignment upon sending.

17. **Dedicated Alias Management APIs & Implementation Task:**
    - *Issue:* Requirement 6.18 (Alias Management) had a database entity (`user_aliases`) and general routing mentions, but lacked dedicated REST endpoint specifications and an explicit Day 5 implementation task.
    - *Impact:* Potential omission during Day 5 web client implementation.
    - *Resolution:* Added dedicated subsections 4.4, 4.5, and 4.6 in `api-design.md` (`GET /api/v1/user/aliases`, `POST /api/v1/user/aliases`, `DELETE /api/v1/user/aliases/:id`), added explicit Task 7 to Day 5 in `implementation-plan.md`, and updated Requirement 6.18 in the traceability matrix.

---

## 2. Summary of Changes Made Across Documents

| Document | Primary Changes |
| :--- | :--- |
| **`architecture.md`** | • Replaced `is_mobile_user` with `has_native_app`<br>• Frozen backend stack to Node.js + TypeScript + Express<br>• Standardized SMTP port to 2525<br>• Explicit `TELEPHONY_PROVIDER` config (no runtime fallback)<br>• Streamlined Docker topology to 4 services with single Nginx proxy |
| **`database-design.md`** | • Decoupled into `messages`, `message_recipients`, and `mailbox_items`<br>• Replaced `is_mobile_user` with `has_native_app` in `users`<br>• Preserved unique RFC `Message-ID` at canonical message level<br>• Added PostgreSQL unique partial index `idx_messages_single_reply`<br>• Allowed nullable `conversation_id` for drafts with `chk_messages_conversation_req` & `chk_mailbox_conversation_req`<br>• Complete draft persistence without redundant tables |
| **`api-design.md`** | • Decoupled OTP verification (`POST /auth/verify-otp`) from account creation<br>• Defined explicit flows: Registration (`request-otp` $\rightarrow$ `verify-otp` $\rightarrow$ `register` / `register-web`) and Login (`request-otp` $\rightarrow$ `verify-otp` $\rightarrow$ `login-otp`)<br>• Added Section 3.0 OTP Token Security Rules (strict purpose-binding, single-use, 10m expiry)<br>• Added dedicated Alias Management endpoints (`GET /api/v1/user/aliases`, `POST /api/v1/user/aliases`, `DELETE /api/v1/user/aliases/:id`)<br>• Defined Inbound SMS webhook (`POST /telephony/sms/inbound`) and local mock simulator (`POST /telephony/mock/simulate-sms`)<br>• Clarified Web Registration UI has only two visible inputs (Phone and OTP)<br>• Enforced `Authorization: Bearer <JWT_TOKEN>` on attachment downloads (no query tokens)<br>• Handled `idx_messages_single_reply` constraint with 409 Conflict<br>• Added `GET /api/v1/health`, drafts lifecycle, recipient lookup & conversation opening, native device registration |
| **`implementation-plan.md`** | • Aligned daily tasks with decoupled mail model, frozen Express backend, and separated auth endpoints<br>• Added explicit Alias Management task to Day 5<br>• Added explicit SMS account creation webhook, simulation, and verification test to Day 6<br>• Added mobile recipient search in Day 4<br>• Added complete draft lifecycle in Day 5<br>• Standardized port 2525 in Day 1 and Day 3 |

---

## 3. Requirement-to-Design Traceability Matrix

Every requirement documented in [requirements.md](file:///c:/Users/205126009/Desktop/205126009/Documentations/requirements.md) is mapped directly to architecture components, database entities, API endpoints, implementation tasks, and acceptance criteria:

| Requirement (from `requirements.md`) | Architecture Component | Database Entity | API Endpoint | Implementation Plan Task | Acceptance Criterion |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **6.1.1 IVR Account Creation** | IVR Call Flow Manager (`IVRService`) | `ivr_sessions`, `users` | `POST /telephony/ivr/voice`<br>`POST /telephony/ivr/gather` | Day 6 (Tasks 2, 3) | AC-01, AC-09 |
| **6.1.2 SMS Account Creation** | Telephony Gateway (`TelephonyService`) | `users` | `POST /telephony/sms/inbound`<br>`POST /telephony/mock/simulate-sms` | Day 6 (Tasks 4, 6) | Account created through SMS (Req 6.1.2, AC-01) |
| **6.1.3 Web Registration (2 Inputs + Link)** | Web Client Shell & Auth Controller | `users`, `otps` | `POST /auth/request-otp`<br>`POST /auth/verify-otp`<br>`POST /auth/register-web` | Day 2 (Tasks 3, 4), Day 5 (Task 4) | AC-01 |
| **6.2 PhoneMail Address Generation** | RecipientResolutionService | `users.phone_number`, `users.email_address` | All auth endpoints | Day 2 (Task 1) | AC-02 |
| **6.3.1 OTP Authentication** | OTP & Token Engine (`AuthService`) | `otps` | `POST /auth/request-otp`<br>`POST /auth/verify-otp`<br>`POST /auth/login-otp` | Day 2 (Tasks 3, 4) | AC-03 |
| **6.3.2 Password Auth Fallback** | `AuthService` (Bcrypt) | `users.password_hash` | `POST /auth/login-password` | Day 2 (Task 5) | AC-03 |
| **6.3.3 Manual & Auto OTP Entry** | Frontend Auth Views | `otps` | `POST /auth/verify-otp` | Day 2 (Task 3), Day 4 (Task 2) | AC-03 |
| **6.4 Mobile Onboarding (4 Screens)** | Mobile Client (WhatsApp UX) | `users.preferred_language` | `POST /auth/register`<br>`PUT /user/profile` | Day 4 (Task 2) | AC-06 |
| **6.5 Device Permissions** | Mobile Client Native Bridge / PWA | `users.has_native_app` | `POST /user/native-device` | Day 2 (Task 6), Day 4 (Task 2) | AC-06 |
| **6.6 Mobile Home (Search, Filters, Drawer)** | Mobile Client Shell | `conversations`, `mailbox_items` | `GET /mobile/conversations` | Day 4 (Task 3) | AC-06 |
| **6.7 Mobile Conversation Organization** | `ConversationService` | `conversations`, `mailbox_items` | `GET /mobile/conversations` | Day 4 (Task 3) | AC-07 |
| **6.8 Mobile Compose (Traditional & Chat)** | Mobile Client Composer | `messages`, `conversations` | `GET /mobile/recipients/lookup`<br>`POST /mobile/conversations/open` | Day 4 (Tasks 1, 5) | AC-06 |
| **6.9 Mobile Conversation Rules & Replies** | Threading Engine | `messages.in_reply_to_id` | `POST /mobile/conversations/:id/messages` | Day 4 (Task 4) | AC-07 |
| **6.10 Traditional Email View on Mobile** | Mobile Traditional View Modal | `messages`, `email_attachments` | `GET /mobile/conversations/:id` | Day 4 (Task 4) | AC-06 |
| **6.11 Multi-Recipient & Group Conversations**| `ConversationService` | `conversations.is_group`, `message_recipients` | `POST /mobile/conversations/open` | Day 4 (Task 1) | AC-07 |
| **6.12 Email Composition (To, CC, BCC)** | Canonical Mail Composer | `message_recipients` | `POST /emails/send`<br>`POST /drafts` | Day 3 (Task 5), Day 5 (Task 1) | AC-04 |
| **6.13 Email Sending Pipeline** | Outbound SMTP Relay (`nodemailer`) | `messages`, `mailbox_items` | `POST /emails/send` | Day 3 (Tasks 4, 5) | AC-04 |
| **6.14 Email Receiving Pipeline** | Inbound SMTP Server (`smtp-server`) | `messages`, `message_recipients`, `mailbox_items` | Inbound Port 2525 listener | Day 3 (Tasks 1, 2, 3) | AC-05 |
| **6.15 Web Client (Gmail-Style)** | Web Client 3-Column Shell | `mailbox_items`, `messages` | `GET /emails`, `POST /emails/send` | Day 5 (Tasks 2, 3) | AC-08 |
| **6.16 SMS Notifications** | `NotificationService` | `sms_notifications`, `users.has_native_app` | Inbound mail trigger | Day 6 (Task 4) | AC-10 |
| **6.17 IVR Integration** | `IVRService` | `ivr_sessions` | `POST /telephony/ivr/voice`<br>`POST /telephony/ivr/gather` | Day 6 (Tasks 2, 3) | AC-09 |
| **6.18 Alias Management** | User Settings Service | `user_aliases` | `GET /api/v1/user/aliases`<br>`POST /api/v1/user/aliases`<br>`DELETE /api/v1/user/aliases/:id` | Day 5 (Task 7) | Alias Management (Req 6.18, P1) |
| **6.19 Search** | Full-Text Search Engine | `messages.search_vector` | `GET /search` | Day 5 (Task 5) | P1 |
| **8.1 Backend (Node.js)** | Layered Monolith | All backend modules | Express REST API | Day 1 (Task 1) | Tech Req |
| **8.2 Local SMTP** | Inbound / Outbound SMTP | `messages` | Ports 2525 / 1025 | Day 3 (Tasks 1, 4) | Tech Req |
| **8.3 Telephony (Twilio / Mock)** | `ITelephonyService` Adapter | `sms_notifications`, `ivr_sessions` | `TELEPHONY_PROVIDER` | Day 6 (Task 1) | Tech Req |
| **8.5 Docker Compose** | Docker Infrastructure | All containers | `docker compose up -d` | Day 1 (Task 2), Day 7 (Task 4) | AC-11 |
| **11 Documentation (README)** | Project Documentation | All files | Markdown docs | Day 7 (Task 5) | AC-12 |

### Unmatched Requirements Check
**Result:** 0 unmatched requirements. Complete 100% coverage across all 21 SRS sections and 12 Acceptance Criteria.

---

## 4. Remaining Assumptions

1. **Email Domain Configuration:** The application assumes the domain is configurable via `EMAIL_DOMAIN` (defaulting to `phonemail.com`).
2. **Local SMTP Port:** Host port `2525` is assumed available for inbound local SMTP testing and demonstration without superuser privilege requirements.
3. **PSTN / Twilio Webhooks:** During local offline development, webhook calls from Twilio are simulated locally using the mock endpoints (`/api/v1/telephony/mock/*`). In production deployments with live Twilio, an HTTPS tunnel is assumed to route inbound webhooks to port 3000/4000.
4. **Single-Reply Business Rule Interpretation:** In accordance with Requirement 6.9 (*"Each message may be replied to only once"*), once an email message receives a reply in a conversation, its `canReply` flag becomes false, preventing branching reply trees within the linear WhatsApp-style chat.

---

## 5. Remaining Risks & Mitigations

1. **Risk:** Large Inbound Email Attachments Causing Memory Spikes.  
   *Mitigation:* `mailparser` streams raw bytes directly to disk inside the attachment volume (`/data/attachments`) instead of buffering full MIME binaries in Node.js heap memory.
2. **Risk:** Twilio Account Suspension or Trial Balance Exhaustion.  
   *Mitigation:* Default configuration is `TELEPHONY_PROVIDER=mock`. The entire application, including IVR simulation and SMS notifications, is 100% testable without a Twilio account.
3. **Risk:** Race Condition between Database Initialization and Backend Startup in Docker.  
   *Mitigation:* Implemented PostgreSQL container healthcheck (`pg_isready -U postgres`) and Express backend `depends_on: { postgres: { condition: service_healthy } }`.

---

## 6. Final Architecture Summary

PhoneMail operates as a **streamlined 4-container Dockerized system**:
1. **`frontend` (Port 3000):** Nginx hosting the unified React SPA, serving both the WhatsApp-style mobile client (`/m`) and Gmail-style desktop client (`/web`), and reverse-proxying `/api` and `/events` to the backend.
2. **`backend` (Ports 4000 & 2525):** Node.js 20 LTS + TypeScript + Express layered monolith hosting:
   - REST API & Server-Sent Events (`/api/v1/*`).
   - Inbound SMTP daemon listening on port `2525`, parsing RFC 5322 MIME messages.
   - Decoupled mail pipeline writing to `messages`, `message_recipients`, and `mailbox_items`.
   - Notification engine dispatching SMS alerts to users where `has_native_app == false`.
   - Pluggable telephony adapter (`TELEPHONY_PROVIDER=mock|twilio`).
3. **`postgres` (Port 5432):** PostgreSQL 16 storing relational entities, user identities, conversations, normalized mailbox items, and full-text search indexes.
4. **`mailpit` (Ports 8025 / 1025):** Local developer SMTP trap capturing outbound messages sent via `nodemailer`.

---

## 7. Exact First Coding Task

Upon receiving approval to exit the System Design phase and begin the Implementation phase, the **exact first coding task** will be:

> **Task 1.1 — Repository Scaffolding & Streamlined Docker Setup:**
> 1. Create root directory structure (`/backend`, `/frontend`, `/docker`).
> 2. Create `docker-compose.yml` declaring `frontend`, `backend`, `postgres`, and `mailpit` with healthchecks and port mappings (`3000`, `4000`, `2525`, `5432`, `8025`).
> 3. Initialize `/backend` with `package.json`, `tsconfig.json`, Express server entry point, and `GET /api/v1/health` endpoint.
> 4. Initialize `/frontend` with Vite, React, TypeScript, and basic Nginx configuration reverse-proxying `/api` to backend.
> 5. Verify that `docker compose up -d` boots all 4 containers and `http://localhost:3000/api/v1/health` returns status `healthy`.
