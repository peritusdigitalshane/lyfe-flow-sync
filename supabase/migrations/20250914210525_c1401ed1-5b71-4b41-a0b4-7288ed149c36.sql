-- Set up automated backlog processing cron job
SELECT cron.schedule(
  'process-email-backlog',
  '0 */6 * * *', -- Every 6 hours
  $$
  select
    net.http_post(
        url:='https://ceasktzguzibehknbgsx.supabase.co/functions/v1/process-email-backlog',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlYXNrdHpndXppYmVoa25iZ3N4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxMjg2OTAsImV4cCI6MjA3MDcwNDY5MH0.wUUytPNjVDFc0uGlhxnSmp0fw_VIdGPK2kHGft9lfso"}'::jsonb,
        body:='{"automated": true}'::jsonb
    ) as request_id;
  $$
);