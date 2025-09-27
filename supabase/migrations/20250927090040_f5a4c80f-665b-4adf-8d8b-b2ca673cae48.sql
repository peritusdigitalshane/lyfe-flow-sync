-- Update Microsoft OAuth configuration to use the correct redirect URI
UPDATE app_settings 
SET value = jsonb_set(
  value::jsonb, 
  '{redirect_uri}', 
  '"https://ceasktzguzibehknbgsx.supabase.co/functions/v1/mailbox-oauth-callback"'
)
WHERE key = 'microsoft_oauth';