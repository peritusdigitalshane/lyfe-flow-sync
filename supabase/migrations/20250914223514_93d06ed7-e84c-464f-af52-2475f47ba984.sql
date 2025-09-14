-- Step 2: Fix existing constraint violations in the database
-- Update any workflow_executions with invalid execution_status values
UPDATE workflow_executions 
SET execution_status = 'completed' 
WHERE execution_status NOT IN ('pending', 'completed', 'failed');

-- Update any audit_logs that might have invalid action values
-- This should now work since we added the enum values
UPDATE audit_logs 
SET action = 'email_processed' 
WHERE action NOT IN (
  'mailbox_created', 'mailbox_connected', 'mailbox_paused', 'mailbox_resumed',
  'config_updated', 'workflow_synced', 'error_occurred', 'email_received',
  'email_processed', 'email_categorized', 'email_quarantined', 'email_blocked',
  'workflow_executed', 'queue_cleared', 'bulk_processing', 'manual_processing'
);