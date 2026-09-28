# PhoneMail — System Architecture Document

> **Project:** PhoneMail (ALPHASTACK 7-Day Buildathon)  
> **Status:** Revised Architecture Baseline (Post Consistency Review)  
> **Backend Stack:** Node.js (v20 LTS) + TypeScript + Express (Frozen)  
> **Database:** PostgreSQL 16  
> **Local SMTP:** Node.js `smtp-server` listening on port `2525` (Standard unprivileged host port)  
> **Frontend Stack:** React 18 + TypeScript + Vite + Tailwind CSS (Served via Nginx)  
> **Deployment Target:** Docker Compose (`docker compose up -d`)

---

## 1. Overall System Architecture

PhoneMail is a phone-number-centric email system bridging standard RFC 5321/5322 internet mail with phone identities, mobile chat conversations, and telephony interfaces.

```mermaid
flowchart TB
    subgraph Clients["Clients & Presentation Layer"]
        MC["Mobile Client (WhatsApp-style UX / Responsive Web or Native APK)"]
        WC["Web Client (Gmail-style Desktop UX)"]
        TC["Caller / SMS User (PSTN / Feature Phone)"]
    end

    subgraph DockerEnv["Docker Compose Environment"]
        subgraph Front["frontend (Port 3000 -> 80)"]
            NGINX["Nginx Web Server<br>(Static Assets + Reverse Proxy /api -> backend:4000)"]
        end

        subgraph Back["backend (Ports 4000 & 2525)"]
            EXPRESS["Express REST API (Port 4000)"]
            SMTP_IN["Local Inbound SMTP Server (Port 2525)"]
            
            AUTH_SVC["Auth & OTP Engine"]
            MAIL_SVC["Canonical Mail Ingestion & Dispatch"]
            CONV_SVC["Conversation & Threading Engine"]
            DRAFT_SVC["Draft Lifecycle Engine"]
            NOTIF_SVC["SMS Notification Engine"]
            IVR_SVC["IVR Call Flow Manager"]
            TELE_SVC["Telephony Adapter (Twilio / Mock)"]
        end

        subgraph DB["postgres (Port 5432)"]
            PG[("PostgreSQL 16 Database")]
        end

        subgraph DevMail["mailpit (Port 8025 / 1025)"]
            MAILPIT["Mailpit Outbound SMTP Trap & Web UI"]
        end
    end

    subgraph External["External Telephony Provider"]
        TWILIO["Twilio API & Webhooks"]
    end

    MC -->|HTTP / SSE| NGINX
    WC -->|HTTP / SSE| NGINX
    TC -->|Voice / SMS| TWILIO

    NGINX -->|Reverse Proxy /api & /events| EXPRESS
    TWILIO -->|Webhooks / TwiML| NGINX
    
    SMTP_IN -->|RFC 5322 MIME Ingestion| MAIL_SVC
    EXPRESS --> AUTH_SVC & MAIL_SVC & CONV_SVC & DRAFT_SVC & IVR_SVC & TELE_SVC

    MAIL_SVC --> PG
    AUTH_SVC --> PG
    CONV_SVC --> PG
    DRAFT_SVC --> PG
    
    MAIL_SVC -->|Outbound SMTP Relay| MAILPIT
    MAIL_SVC -->|Check has_native_app| NOTIF_SVC
    NOTIF_SVC --> TELE_SVC
    TELE_SVC -->|When TELEPHONY_PROVIDER=twilio| TWILIO
    IVR_SVC --> TELE_SVC
```

### Architectural Principles
1. **Canonical Identity:** The user's primary identity is their normalized phone number (`E.164` format without `+` or punctuation, e.g., `9888820532`). The canonical email address is `${PHONE_NUMBER}@${EMAIL_DOMAIN}`.
2. **Explicit Native App Capability (`has_native_app`):** The system distinguishes between responsive mobile web access and native mobile application capability. Responsive mobile web usage does **NOT** suppress SMS notifications. SMS notifications are dispatched to eligible users who lack a registered native app (`has_native_app == false`).
3. **Decoupled Email Data Model:** Message content (`messages`), recipient delivery (`message_recipients`), and individual user mailbox state (`mailbox_items`) are strictly normalized. A single message with multiple recipients creates independent mailbox states (read, favorite, folder) for each user.
4. **Frozen Node.js + Express Backend:** The backend is standardized exclusively on Node.js 20 LTS, TypeScript, and Express.
5. **Standard Unprivileged SMTP Port (`2525`):** The local inbound SMTP daemon and Docker host binding use port `2525` by default, eliminating root/privileged port binding issues on host operating systems.
6. **Deterministic Telephony Isolation:** Telephony provider selection is explicitly configured via `TELEPHONY_PROVIDER=mock` or `TELEPHONY_PROVIDER=twilio`. The system does **not** silently flip provider modes at runtime upon network errors.

---

## 2. Frontend Architecture

The frontend is a single responsive TypeScript Single Page Application (SPA) built with **React 18**, **Vite**, and **Tailwind CSS**, served via Nginx.

```mermaid
flowchart TD
    subgraph BrowserRuntime["Browser / WebView Runtime"]
        ROUTER["React Router v6"]
        AUTH_CTX["Auth Context (JWT + User Profile)"]
        API_LAYER["Axios HTTP Client"]
        SSE_LAYER["Server-Sent Events Listener (/api/v1/events)"]
        
        subgraph ViewModes["Dual Interface Paradigms"]
            direction TB
            subgraph MobileMode["Mobile Client Interface (/m or Mobile Viewport)"]
                ONBOARD["4-Step Onboarding Flow<br>(Lang -> T&C -> Phone -> OTP)"]
                M_HOME["Mobile Home Screen (WhatsApp-style)"]
                M_CONV["Conversation View & Swipe-to-Reply"]
                M_LOOKUP["Phone Recipient Search & Start Chat"]
                M_TRAD["Traditional Email View Toggle"]
                M_FILTERS["Filter Chips (All, Unread, Attachments, Favorites)"]
            end
            
            subgraph WebMode["Web Client Interface (/web or Desktop Viewport)"]
                W_AUTH["Minimal 3-Field Web Auth Screen"]
                W_SHELL["Gmail-style Desktop Shell"]
                W_TABLE["Thread / Email List Table"]
                W_PANE["Email Reading Pane (Full RFC Headers)"]
                W_MODAL["Floating Compose Modal (To, CC, BCC, Rich Text)"]
                W_DRAFTS["Drafts Management View"]
            end
        end
    end

    ROUTER --> ViewModes
    ViewModes --> AUTH_CTX
    ViewModes --> API_LAYER
    SSE_LAYER --> ViewModes
```

### Key Frontend Components
- **Unified Codebase, Distinct Ergonomics:**
  - `Mobile View (/m)`: WhatsApp-style conversation feed, chat bubbles, swipe-to-reply gesture, search-by-phone to open chat, subject field visible on new email but hidden on reply.
  - `Web View (/web)`: Gmail-style 3-column layout with collapsible sidebar (`Home`, `Drafts`, `Spam`, `Trash`), tabular email list, checkboxes, keyboard shortcuts, and floating modal compose.
  - `Interface Switcher`: Persistent toggle in development allowing judges and developers to test both interfaces seamlessly.
- **Real-Time Synchronization:** Listens to SSE stream (`/api/v1/events`) to update conversation feeds and email lists without manual polling.

---

## 3. Backend Architecture

The backend is built with **Node.js 20 LTS**, **TypeScript**, and **Express**, structured as a modular layered monolith.

```mermaid
flowchart LR
    subgraph Presentation["Controllers & Routes"]
        R_AUTH["Auth & Registration Routes"]
        R_CONV["Mobile Conversation Routes"]
        R_MAIL["Mailbox & Email Routes"]
        R_DRAFT["Draft Lifecycle Routes"]
        R_TELE["Telephony & Webhook Routes"]
        R_SSE["SSE Real-Time Stream"]
        R_HEALTH["Healthcheck Route"]
    end

    subgraph Services["Business Logic Layer"]
        S_AUTH["AuthService (OTP & JWT)"]
        S_LOOKUP["RecipientResolutionService"]
        S_CONV["ConversationService"]
        S_MAIL["MailService (MIME & Delivery)"]
        S_DRAFT["DraftService"]
        S_NOTIF["NotificationService (SMS Alert)"]
        S_TELE["TelephonyService (Twilio / Mock)"]
    end

    subgraph DataAccess["Repository & Data Layer"]
        REPO_USER["UserRepository"]
        REPO_MSG["MessageRepository"]
        REPO_BOX["MailboxRepository"]
        REPO_CONV["ConversationRepository"]
        REPO_OTP["OtpRepository"]
    end

    subgraph Infrastructure["Infrastructure & Daemons"]
        SMTP_IN["Inbound SMTP Server (smtp-server on 2525)"]
        SMTP_OUT["Outbound SMTP Client (nodemailer -> Mailpit:1025)"]
        DB_POOL["PostgreSQL Connection Pool (pg / Prisma)"]
        ATTACH_FS["Attachment File System Storage"]
    end

    Presentation --> Services
    Services --> DataAccess
    DataAccess --> Infrastructure
    SMTP_IN --> S_MAIL
```

### Backend Responsibilities
1. **`AuthService`:** Manages 6-digit cryptographic OTP generation, SHA-256 storage, 5-minute expiry, 3-attempt lockouts, password fallback hashing via `bcrypt`, and JWT issuing.
2. **`RecipientResolutionService`:** Resolves phone numbers, internal PhoneMail identities, aliases, and external email addresses. Supports the mobile search endpoint (`GET /api/v1/mobile/recipients/lookup`).
3. **`ConversationService`:** Manages conversation grouping, thread participants, and single-reply constraint enforcement (`canReply`).
4. **`MailService`:** Ingests raw RFC 5322 MIME messages, parses headers/bodies/attachments via `mailparser`, creates canonical `messages`, creates `message_recipients`, and allocates independent `mailbox_items`. Dispatches outbound mail via `nodemailer`.
5. **`DraftService`:** Implements full draft lifecycle (create, read, update, delete, send) directly leveraging the canonical message/mailbox schema.
6. **`NotificationService`:** Evaluates incoming mail against `recipient_user.has_native_app`. Dispatches SMS notification if `has_native_app == false`.
7. **`TelephonyService`:** Implements `ITelephonyService` interface with deterministic provider resolution based on `TELEPHONY_PROVIDER`.

---

## 4. Database Architecture

The persistence layer uses **PostgreSQL 16**. The schema separates canonical message content from individual user mailbox state.

```mermaid
erDiagram
    users ||--o{ otps : "requests"
    users ||--o{ user_aliases : "owns"
    users ||--o{ conversation_participants : "participates_in"
    users ||--o{ mailbox_items : "owns_mailbox_for"
    users ||--o{ sms_notifications : "receives"

    conversations ||--|{ conversation_participants : "has"
    conversations ||--o{ messages : "contains"
    conversations ||--o{ mailbox_items : "groups"

    messages ||--|{ message_recipients : "addressed_to"
    messages ||--|{ mailbox_items : "manifests_in"
    messages ||--o{ email_attachments : "has"
    messages ||--o| messages : "in_reply_to"
    messages ||--o{ sms_notifications : "triggers"

    users {
        uuid id PK
        varchar phone_number UK
        varchar email_address UK
        varchar password_hash
        varchar registration_source
        boolean has_native_app
        varchar preferred_language
        varchar display_name
        text avatar_url
        timestamptz created_at
        timestamptz updated_at
    }

    messages {
        uuid id PK
        uuid conversation_id FK
        uuid in_reply_to_id FK
        varchar message_id_rfc UK
        varchar sender_email
        varchar sender_phone
        varchar sender_name
        varchar subject
        text body_text
        text body_html
        jsonb raw_headers
        boolean is_draft
        timestamptz sent_at
        timestamptz received_at
        timestamptz created_at
        timestamptz updated_at
    }

    message_recipients {
        uuid id PK
        uuid message_id FK
        uuid user_id FK
        varchar recipient_type
        varchar email_address
        varchar phone_number
        timestamptz created_at
    }

    mailbox_items {
        uuid id PK
        uuid user_id FK
        uuid message_id FK
        uuid conversation_id FK
        varchar folder
        boolean is_read
        boolean is_favorite
        timestamptz created_at
        timestamptz updated_at
    }
```

---

## 5. Local SMTP Architecture

```mermaid
sequenceDiagram
    autonumber
    participant MTA as Sender / External MTA
    participant SMTP as PhoneMail Inbound SMTP (Port 2525)
    participant Parser as MailParser Engine
    participant MailSvc as MailService
    participant DB as PostgreSQL
    participant Notif as NotificationService

    MTA->>SMTP: TCP Connection to Port 2525
    SMTP-->>MTA: 250 phonemail.com ESMTP Ready
    MTA->>SMTP: MAIL FROM: <sender@example.com>
    SMTP-->>MTA: 250 2.1.0 Sender OK
    MTA->>SMTP: RCPT TO: <9888820532@phonemail.com>
    SMTP-->>MTA: 250 2.1.5 Recipient OK
    MTA->>SMTP: DATA (RFC 5322 MIME stream)
    SMTP->>Parser: Stream raw email bytes
    Parser-->>SMTP: Parsed MIME (Headers, Body, Attachments)
    SMTP-->>MTA: 250 2.0.0 Message queued
    SMTP->>MailSvc: Process Inbound Message
    MailSvc->>DB: Insert canonical 'messages' row
    MailSvc->>DB: Insert 'message_recipients' row
    MailSvc->>DB: Insert 'mailbox_items' for recipient (folder: HOME, is_read: false)
    MailSvc->>Notif: Evaluate recipient (has_native_app?)
    alt has_native_app == false
        Notif->>DB: Insert & Dispatch 'sms_notifications'
    end
```

### Key Specifications:
- **Port:** Uses port `2525` internally and maps host port `2525` to container `2525`. Privileged port `25` is not required.
- **Recipient Domain Check:** Validates domain against `EMAIL_DOMAIN` environment variable (e.g. `phonemail.com`).
- **Outbound Mail:** Sent via `nodemailer` pointing to local `mailpit:1025` by default, or an external relay when configured.

---

## 6. OTP & Authentication Architecture

- **Phone-Based Identity:** Authenticates users via 6-digit cryptographically generated OTP.
- **Security Storage:** Stored as `SHA-256(otp + salt)` in the `otps` table with 5-minute expiry and max 3 attempts.
- **Password Fallback (Req 6.3.2):** Supports optional password setup hashed with `bcrypt`.
- **JWT Session Tokens:** Signed using HMAC-SHA256 (`JWT_SECRET`) containing user ID, phone number, and canonical email address.
- **App Capability Binding:** Login from the responsive web app does **not** modify `has_native_app`. Only an authenticated call to `POST /api/v1/user/native-device` with device signature marks `has_native_app = true`.

---

## 7. Telephony Architecture (Twilio & Mock)

Telephony integration is governed strictly by the `TELEPHONY_PROVIDER` environment variable:
```env
# Values: 'mock' (default) | 'twilio'
TELEPHONY_PROVIDER=mock
```

```mermaid
classDiagram
    class ITelephonyService {
        <<interface>>
        +sendSms(to: string, message: string): Promise~TelephonyResult~
        +generateIvrGreeting(): string
        +generateIvrAccountCreated(phone: string, email: string): string
        +generateIvrError(): string
    }

    class TwilioService {
        -client: TwilioClient
        +sendSms(to: string, message: string)
        +generateIvrGreeting()
        +generateIvrAccountCreated()
        +generateIvrError()
    }

    class MockTelephonyService {
        -logger: ConsoleLogger
        -mockInbox: Array
        +sendSms(to: string, message: string)
        +generateIvrGreeting()
        +generateIvrAccountCreated()
        +generateIvrError()
        +getRecentMessages()
    }

    ITelephonyService <|.. TwilioService
    ITelephonyService <|.. MockTelephonyService
```

- **No Silent Fallback:** If `TELEPHONY_PROVIDER=twilio` encounters an error, it returns a 502/503 error with diagnostic details; it does **not** switch modes automatically.
- **Deterministic Mock Mode:** When `TELEPHONY_PROVIDER=mock`, OTPs and SMS notifications are logged to stdout and persisted to an in-memory debug buffer queried via `GET /api/v1/telephony/mock/messages`.

---

## 8. IVR Flow

Implements toll-free automated account creation (Req 6.1.1, 6.17):

```mermaid
sequenceDiagram
    autonumber
    participant Caller as Caller (PSTN Phone)
    participant Twilio as Twilio Voice Gateway
    participant API as Express Telephony Webhook
    participant DB as PostgreSQL
    participant SMS as TelephonyService

    Caller->>Twilio: Dials Toll-Free Number
    Twilio->>API: POST /api/v1/telephony/ivr/voice
    API-->>Twilio: TwiML <Gather numDigits="1"> "Welcome to PhoneMail. Press 1 to create your account."
    Caller->>Twilio: Presses "1"
    Twilio->>API: POST /api/v1/telephony/ivr/gather { Digits: "1", From: "+19888820532" }
    API->>DB: Provision user (phone: 9888820532, email: 9888820532@phonemail.com, has_native_app: false)
    API->>SMS: Dispatch confirmation SMS
    API-->>Twilio: TwiML <Say> "Your PhoneMail account has been created. A confirmation text has been sent." <Hangup/>
    Twilio-->>Caller: Plays confirmation and hangs up
```

---

## 9. SMS Notification Flow

Implements email notification for non-native-app users (Req 6.16):

```mermaid
flowchart TD
    INGEST["Email Ingested via SMTP"] --> RESOLVE["Resolve Recipient in Database"]
    RESOLVE --> CHECK_USER{"User exists?"}
    CHECK_USER -- Yes --> CHECK_APP{"has_native_app == true?"}
    CHECK_USER -- No --> FINISH(["Done"])
    
    CHECK_APP -- Yes --> SKIP["Skip SMS Alert (User has native mobile app)"]
    CHECK_APP -- No --> FORMAT["Format SMS Template:<br>'You have received an email from <Sender>.<br>Subject: <Subject>.'"]
    
    FORMAT --> DISPATCH["Dispatch via TelephonyService (Twilio or Mock)"]
    DISPATCH --> LOG["Persist to sms_notifications table"]
    LOG --> FINISH
```

*Note: Accessing the responsive mobile web interface does NOT set `has_native_app = true`. Responsive web users continue receiving SMS alerts as required by 6.16.*

---

## 10. Mobile Client Architecture

The mobile interface is the primary buildathon priority, following the WhatsApp-style interaction model:

```mermaid
flowchart TB
    subgraph MobileUX["WhatsApp-Style Mobile Interface"]
        TOP["Full-Width Top Search Bar"]
        FILTERS["Filter Chips: [All] [Unread] [Attachments] [Favorites]"]
        NAV["Drawer Navigation: [Home] [Drafts] [Spam] [Trash]"]
        FEED["Unified Conversation Feed (No separate Inbox/Sent)"]
        FAB["Compose / Search FAB"]
        
        subgraph ChatScreen["Conversation View"]
            C_HEADER["Header: Contact Info & Traditional View Toggle"]
            BUBBLE_IN["Inbound Bubble (Subject badge, Body, Attachments)"]
            BUBBLE_OUT["Outbound Bubble (Delivered tick, Body)"]
            INPUT["Input Area: Subject (hidden on reply), Body, Send"]
        end
    end

    TOP --> FILTERS --> FEED
    FEED -->|Tap Thread| ChatScreen
    FAB -->|Tap| INPUT
```

### Rules & Behaviors:
- **Unified Feed:** No separate Inbox and Sent folders; emails exchanged with the same contact appear in one continuous chat thread.
- **Subject Field:** Displayed above message input on a new email; automatically hidden when replying to a message.
- **Single-Reply Enforcement:** Each incoming message can be replied to once directly in the thread.
- **Swipe-to-Reply:** Swiping right selects the parent email and links `in_reply_to_id`.
- **Search & Start Chat:** User can enter a phone number in the search bar, verify if the user exists, and open/create a conversation immediately (`GET /api/v1/mobile/recipients/lookup`).

---

## 11. Web Client Architecture

The web interface provides an authentic **Gmail-like** desktop experience:
- **3-Column Layout:** Collapsible sidebar (`Compose`, `Home`, `Drafts`, `Spam`, `Trash`, `Aliases`), central email table with checkboxes, stars, sender, subject snippets, dates, and reading pane.
- **Floating Compose Modal:** Bottom-right modal with expandable `To`, `CC`, `BCC`, `Subject`, rich text area, and draft auto-saving.
- **Web Registration Screen (Req 6.1.3):** Dedicated 3-field interface (`Phone Number`, `OTP`, `Next`, `Terms of Service` link, automatic field reset on completion).

---

## 12. Docker & Container Architecture

The Docker architecture is streamlined to four clean containers without redundant proxies:

```mermaid
flowchart TB
    subgraph Host["Docker Host (Single docker compose up -d)"]
        subgraph Front["frontend (Port 3000 -> 80)"]
            NGINX_BOX["Nginx Web Server"]
        end

        subgraph Back["backend (Ports 4000 & 2525)"]
            NODE_BOX["Node.js Express API + Inbound SMTP (Port 2525)"]
        end

        subgraph Database["postgres (Port 5432)"]
            PG_BOX["PostgreSQL 16"]
            VOL_PG[("Volume: postgres_data")]
        end

        subgraph MailTrap["mailpit (Ports 8025 & 1025)"]
            MP_BOX["Mailpit SMTP Relay (1025) & Web UI (8025)"]
        end
    end

    Front -->|Proxy /api & /events| Back
    Back -->|PostgreSQL Wire| Database
    Back -->|Outbound SMTP| MailTrap
    PG_BOX --- VOL_PG
```

### Docker Port Configuration
| Container | Internal Port | Host Port | Purpose |
| :--- | :--- | :--- | :--- |
| `frontend` | 80 | `3000` | Web & Mobile UI (Nginx reverse-proxying `/api` to backend) |
| `backend` | 4000 | `4000` | Express REST API, Webhooks & SSE |
| `backend` (SMTP) | 2525 | `2525` | Inbound Local SMTP Server |
| `postgres` | 5432 | `5432` | PostgreSQL 16 Database Server |
| `mailpit` | 8025 / 1025 | `8025` / `1025` | Outbound Mail Viewing (Web UI / SMTP Relay) |

---

## 13. Inter-Service Communication

1. **Client ⇄ Nginx:** HTTP/1.1 and Server-Sent Events on host port `3000`.
2. **Nginx ⇄ Backend:** Nginx proxies `/api/*` and `/api/v1/events` internally to `http://backend:4000`.
3. **Inbound SMTP ⇄ Backend:** Embedded `smtp-server` runs inside the `backend` process on internal port `2525`, passing parsed emails directly to the domain service layer.
4. **Backend ⇄ PostgreSQL:** Pooled connections via standard PostgreSQL driver on `postgres:5432`.
5. **Backend ⇄ Outbound SMTP:** Dispatches outbound emails to `mailpit:1025` via SMTP.
6. **Backend ⇄ Telephony:** Outbound HTTPS requests to Twilio API (or in-memory mock handler when `TELEPHONY_PROVIDER=mock`).

---

## 14. Error Handling Strategy

1. **Uniform RFC 7807 Error Response:**
   ```json
   {
     "success": false,
     "error": {
       "code": "INVALID_OTP",
       "message": "The supplied OTP code is invalid or has expired.",
       "details": { "attemptsRemaining": 2 },
       "timestamp": "2026-09-28T10:00:00.000Z"
     }
   }
   ```
2. **SMTP Ingestion Error Handling:** Unknown recipient domains return `550 5.1.1 User unknown`. Malformed MIME streams are logged without crashing the daemon.
3. **Telephony Failures:** When `TELEPHONY_PROVIDER=twilio`, API connection errors are captured, logged, and return HTTP 502 with error details rather than silently changing configuration.
4. **Database Resilience:** Database connection pool employs healthchecks and reconnect exponential backoff.

---

## 15. Security Boundaries

1. **Input Sanitization:** All incoming HTML bodies are cleaned with `sanitize-html` / `DOMPurify` to eliminate XSS vectors.
2. **Rate Limiting:** OTP generation and verification endpoints are strictly limited (max 5 requests per minute per IP/phone).
3. **Secret Isolation:** All credentials (`JWT_SECRET`, `TWILIO_AUTH_TOKEN`, `DB_PASSWORD`) are loaded strictly from environment variables.
4. **SQL Injection Defense:** All queries use parameterized statements.
