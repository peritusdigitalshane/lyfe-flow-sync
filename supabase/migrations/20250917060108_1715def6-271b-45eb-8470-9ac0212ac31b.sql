-- Update existing Teams bot configuration
UPDATE app_settings 
SET value = jsonb_set(
  jsonb_set(
    jsonb_set(value, '{botName}', '"LyfeAI Meetings Assistant"'),
    '{manifest,name,short}', '"LyfeAI Meetings Assistant"'
  ),
  '{manifest,name,full}', '"LyfeAI Meetings Assistant - Meeting Assistant"'
),
description = 'Teams bot configuration for LyfeAI Meetings Assistant',
updated_at = now()
WHERE key LIKE 'teams_bot_%' AND tenant_id IS NOT NULL;