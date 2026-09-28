-- ==============================================================================
-- Migration: 002_constraints_and_indexes.sql
-- Description: PhoneMail Performance Indexes, Unique Constraints & Draft Integrity
-- Target Engine: PostgreSQL 16
-- Reference: Documentations/database-design.md Section 4
-- ==============================================================================

-- 1. Canonical User Lookups
CREATE UNIQUE INDEX idx_users_phone ON users(phone_number);
CREATE UNIQUE INDEX idx_users_email ON users(email_address);

-- 2. User Alias Uniqueness
CREATE UNIQUE INDEX idx_user_aliases_address ON user_aliases(alias_address);

-- 3. OTP Lookups and Expirations
CREATE INDEX idx_otps_phone_created ON otps(phone_number, created_at DESC);
CREATE INDEX idx_otps_active ON otps(phone_number, consumed_at, expires_at);

-- 4. Mobile Conversations Feed
CREATE INDEX idx_conversations_last_msg ON conversations(last_message_at DESC);
CREATE INDEX idx_conv_participants_user ON conversation_participants(user_id, conversation_id);
CREATE INDEX idx_conv_participants_email ON conversation_participants(email_address);

-- 5. Canonical Messages & Threading
CREATE UNIQUE INDEX idx_messages_rfc_id ON messages(message_id_rfc) WHERE message_id_rfc IS NOT NULL;
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at ASC);

-- 6. CRITICAL REQUIRED INDEX: Single-Reply Constraint (Req 6.9)
-- Enforces at the database layer that one parent message can have at most one reply
CREATE UNIQUE INDEX idx_messages_single_reply
ON messages(in_reply_to_id)
WHERE in_reply_to_id IS NOT NULL;

-- 7. Multi-recipient Addressing Lookups
CREATE INDEX idx_msg_recipients_msg ON message_recipients(message_id);
CREATE INDEX idx_msg_recipients_user ON message_recipients(user_id);
CREATE INDEX idx_msg_recipients_phone ON message_recipients(phone_number);

-- 8. Independent User Mailbox Queries & Uniqueness
CREATE UNIQUE INDEX idx_mailbox_user_msg ON mailbox_items(user_id, message_id);
CREATE INDEX idx_mailbox_user_folder ON mailbox_items(user_id, folder, created_at DESC);
CREATE INDEX idx_mailbox_filters ON mailbox_items(user_id, is_read, is_favorite);

-- 9. Email Attachment Lookups
CREATE INDEX idx_attachments_msg ON email_attachments(message_id);

-- 10. SMS Notification Lookups
CREATE INDEX idx_sms_notifications_user ON sms_notifications(user_id);
CREATE INDEX idx_sms_notifications_status ON sms_notifications(status);

-- 11. Full-Text Search on Canonical Messages
ALTER TABLE messages ADD COLUMN search_vector tsvector 
    GENERATED ALWAYS AS (to_tsvector('english', coalesce(subject, '') || ' ' || coalesce(body_text, ''))) STORED;
CREATE INDEX idx_messages_fts ON messages USING GIN(search_vector);

-- 12. CRITICAL DRAFT RULE: Integrity Constraints (Standalone Drafts vs Conversation Messages)
-- Standalone drafts may have NULL conversation_id; non-draft messages must have a conversation_id
ALTER TABLE messages ADD CONSTRAINT chk_messages_conversation_req 
    CHECK (is_draft = true OR conversation_id IS NOT NULL);

-- Standalone drafts in mailbox may have NULL conversation_id; normal folders must have a conversation_id
ALTER TABLE mailbox_items ADD CONSTRAINT chk_mailbox_conversation_req 
    CHECK (folder = 'DRAFTS' OR conversation_id IS NOT NULL);
