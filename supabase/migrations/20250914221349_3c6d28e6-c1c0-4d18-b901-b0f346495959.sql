-- Fix database function security issues
-- Fix function search paths for security
ALTER FUNCTION public.has_threat_intelligence_access(uuid) SET search_path = 'public';
ALTER FUNCTION public.trigger_feed_health_monitor() SET search_path = 'public';
ALTER FUNCTION public.activate_user_account(text) SET search_path = 'public';
ALTER FUNCTION public.handle_new_user() SET search_path = 'public';
ALTER FUNCTION public.update_updated_at() SET search_path = 'public';
ALTER FUNCTION public.has_role(uuid, app_role) SET search_path = 'public';
ALTER FUNCTION public.get_user_roles(uuid) SET search_path = 'public';
ALTER FUNCTION public.handle_new_user_role() SET search_path = 'public';