-- Clear Microsoft Graph tokens from existing mailboxes to force re-authentication
-- This is needed when new permissions are added to the Azure app registration

UPDATE public.mailboxes 
SET microsoft_graph_token = NULL
WHERE microsoft_graph_token IS NOT NULL;