UPDATE app_settings 
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb), 
  '{redirect_uri}', 
  '"https://ceasktzguzibehknbgsx.supabase.co/functions/v1/mailbox-oauth-callback"'
)
WHERE key = 'microsoft_oauth';