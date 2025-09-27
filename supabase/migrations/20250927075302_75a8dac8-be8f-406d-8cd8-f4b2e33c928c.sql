-- Schedule automatic VIP category checking every 2 hours
SELECT cron.schedule(
  'ensure-vip-categories',
  '0 */2 * * *', -- every 2 hours
  $$
  SELECT
    net.http_post(
        url:='https://ceasktzguzibehknbgsx.supabase.co/functions/v1/ensure-vip-categories',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlYXNrdHpndXppYmVoa25iZ3N4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxMjg2OTAsImV4cCI6MjA3MDcwNDY5MH0.wUUytPNjVDFc0uGlhxnSmp0fw_VIdGPK2kHGft9lfso"}'::jsonb,
        body:='{"automated": true}'::jsonb
    ) as request_id;
  $$
);