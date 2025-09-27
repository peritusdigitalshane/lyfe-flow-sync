-- Revert Microsoft OAuth configuration back to the frontend redirect URI
UPDATE app_settings 
SET value = jsonb_set(
  value::jsonb, 
  '{redirect_uri}', 
  '"https://emailmanagement.lyfeai.com.au/auth/callback"'
)
WHERE key = 'microsoft_oauth';