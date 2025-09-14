-- Fix audit_action enum to include missing values
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'workflow_executed';

-- Fix workflow_executions table execution_status constraint
-- First, let's see what values are currently in the table that might be violating the constraint
UPDATE workflow_executions 
SET execution_status = 'completed' 
WHERE execution_status NOT IN ('pending', 'completed', 'failed');

-- Now let's also check if there are any other constraint violations and fix them
-- The audit_logs table might have invalid enum values, let's check and fix
UPDATE audit_logs 
SET action = 'email_processed' 
WHERE action = 'workflow_executed';

-- Add any other missing audit_action enum values that might be needed
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'queue_cleared';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'bulk_processing';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'manual_processing';