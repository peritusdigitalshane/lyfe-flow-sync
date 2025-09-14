-- Step 1: Add missing enum values for audit_action
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'workflow_executed';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'queue_cleared';  
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'bulk_processing';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'manual_processing';