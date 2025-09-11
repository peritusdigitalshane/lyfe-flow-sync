-- Add new audit actions for email activities
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'email_received';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'email_processed';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'email_categorized';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'email_quarantined';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'email_blocked';