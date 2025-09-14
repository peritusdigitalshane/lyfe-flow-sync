-- Set up automatic processing of pending emails every 5 minutes
SELECT cron.schedule(
  'auto-process-pending-emails',
  '*/5 * * * *', -- every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://ceasktzguzibehknbgsx.supabase.co/functions/v1/auto-process-pending-emails',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlYXNrdHpndXppYmVoa25iZ3N4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxMjg2OTAsImV4cCI6MjA3MDcwNDY5MH0.wUUytPNjVDFc0uGlhxnSmp0fw_VIdGPK2kHGft9lfso"}'::jsonb,
    body := '{"automated": true}'::jsonb
  );
  $$
);