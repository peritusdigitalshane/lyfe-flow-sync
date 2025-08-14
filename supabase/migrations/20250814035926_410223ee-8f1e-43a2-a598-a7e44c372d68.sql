-- Remove n8n-related columns and tables as they are no longer needed

-- Drop n8n_bindings table entirely
DROP TABLE IF EXISTS public.n8n_bindings CASCADE;

-- Remove n8n columns from mailboxes table
ALTER TABLE public.mailboxes 
DROP COLUMN IF EXISTS n8n_credential_id,
DROP COLUMN IF EXISTS n8n_workflow_id;