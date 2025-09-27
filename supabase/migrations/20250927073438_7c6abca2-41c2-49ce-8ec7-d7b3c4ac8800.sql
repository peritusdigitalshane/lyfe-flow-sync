-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule automatic VIP processing every 30 minutes
SELECT cron.schedule(
  'auto-vip-processing',
  '*/30 * * * *', -- every 30 minutes
  $$
  SELECT
    net.http_post(
        url:='https://ceasktzguzibehknbgsx.supabase.co/functions/v1/auto-vip-processor',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlYXNrdHpndXppYmVoa25iZ3N4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxMjg2OTAsImV4cCI6MjA3MDcwNDY5MH0.wUUytPNjVDFc0uGlhxnSmp0fw_VIdGPK2kHGft9lfso"}'::jsonb,
        body:='{"automated": true}'::jsonb
    ) as request_id;
  $$
);