-- Update OAuth configuration to use the custom domain for Docker deployment
UPDATE app_settings 
SET value = jsonb_set(
  value, 
  '{redirect_uri}', 
  '"https://emailmanagement.lyfeai.com.au/auth/callback"'
)
WHERE key = 'microsoft_oauth';