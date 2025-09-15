-- Update the OpenAI model from invalid 'gpt-5-mini' to valid 'gpt-5-mini-2025-08-07'
UPDATE app_settings 
SET value = jsonb_set(value, '{model}', '"gpt-5-mini-2025-08-07"')
WHERE key = 'openai_config' AND value->>'model' = 'gpt-5-mini';