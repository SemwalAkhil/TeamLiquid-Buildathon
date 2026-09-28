-- ==============================================================================
-- Migration: 001_initial_schema.sql
-- Description: PhoneMail Initial Schema (Decoupled Canonical Messages & Mailboxes)
-- Target Engine: PostgreSQL 16
-- Reference: Documentations/database-design.md
-- ==============================================================================

-- Enable standard pgcrypto extension for gen_random_uuid support across all environments
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(20) NOT NULL,
    email_address VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NULL,
    registration_source VARCHAR(20) NOT NULL DEFAULT 'WEB',
    has_native_app BOOLEAN NOT NULL DEFAULT false,
    preferred_language VARCHAR(10) NOT NULL DEFAULT 'en',
    display_name VARCHAR(100) NULL,
    avatar_url TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. OTPs Table
CREATE TABLE otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(20) NOT NULL,
    otp_hash VARCHAR(64) NOT NULL,
    purpose VARCHAR(20) NOT NULL DEFAULT 'LOGIN',
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. User Aliases Table
CREATE TABLE user_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alias_address VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Conversations Table
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    is_group BOOLEAN NOT NULL DEFAULT false,
    title VARCHAR(255) NULL,
    created_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Conversation Participants Table
CREATE TABLE conversation_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    email_address VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20) NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Canonical Messages Table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NULL REFERENCES conversations(id) ON DELETE CASCADE,
    in_reply_to_id UUID NULL REFERENCES messages(id) ON DELETE SET NULL,
    message_id_rfc VARCHAR(255) NULL,
    sender_email VARCHAR(255) NOT NULL,
    sender_phone VARCHAR(20) NULL,
    sender_name VARCHAR(100) NULL,
    subject VARCHAR(500) NOT NULL DEFAULT '',
    body_text TEXT NULL,
    body_html TEXT NULL,
    raw_headers JSONB NULL DEFAULT '{}'::jsonb,
    is_draft BOOLEAN NOT NULL DEFAULT false,
    sent_at TIMESTAMPTZ NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Message Recipients Table (Multi-recipient addressing: TO, CC, BCC)
CREATE TABLE message_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    recipient_type VARCHAR(10) NOT NULL DEFAULT 'TO',
    email_address VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. User Mailbox Items Table (Independent read, favorite, folder states)
CREATE TABLE mailbox_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    conversation_id UUID NULL REFERENCES conversations(id) ON DELETE CASCADE,
    folder VARCHAR(20) NOT NULL DEFAULT 'HOME',
    is_read BOOLEAN NOT NULL DEFAULT false,
    is_favorite BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Email Attachments Table
CREATE TABLE email_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    file_size_bytes INT NOT NULL DEFAULT 0,
    storage_path VARCHAR(500) NOT NULL,
    content_id VARCHAR(100) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. SMS Notifications Table (Audit trail of SMS alerts dispatched to non-native-app users)
CREATE TABLE sms_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    recipient_phone VARCHAR(20) NOT NULL,
    message_text TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
    external_id VARCHAR(100) NULL,
    error_message TEXT NULL,
    sent_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. IVR Sessions Table (Toll-free IVR inbound call tracking)
CREATE TABLE ivr_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_sid VARCHAR(100) NOT NULL UNIQUE,
    from_phone VARCHAR(20) NOT NULL,
    to_phone VARCHAR(20) NOT NULL,
    digits_pressed VARCHAR(5) NULL,
    account_created BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
