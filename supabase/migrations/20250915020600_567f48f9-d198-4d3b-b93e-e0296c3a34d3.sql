-- Update OpenAI configuration to use an available model
UPDATE app_settings 
SET value = jsonb_set(value, '{model}', '"gpt-4o-mini"')
WHERE key = 'openai_config';