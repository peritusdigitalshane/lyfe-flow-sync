-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a function to trigger the feed health monitor
CREATE OR REPLACE FUNCTION public.trigger_feed_health_monitor()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Make HTTP request to the feed-health-monitor edge function
  PERFORM net.http_post(
    url := 'https://ceasktzguzibehknbgsx.supabase.co/functions/v1/feed-health-monitor',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlYXNrdHpndXppYmVoa25iZ3N4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxMjg2OTAsImV4cCI6MjA3MDcwNDY5MH0.wUUytPNjVDFc0uGlhxnSmp0fw_VIdGPK2kHGft9lfso"}'::jsonb,
    body := '{"automated": true}'::jsonb
  );
END;
$$;

-- Add app setting for feed update schedule
INSERT INTO public.app_settings (key, value, description)
VALUES (
  'threat_feed_update_schedule',
  '"0 * * * *"',
  'Cron schedule for automatic threat feed updates (default: every hour)'
) ON CONFLICT (key) DO NOTHING;

-- Schedule the cron job to run every hour (0 * * * *)
SELECT cron.schedule(
  'threat-feed-auto-update',
  '0 * * * *',
  'SELECT public.trigger_feed_health_monitor();'
);