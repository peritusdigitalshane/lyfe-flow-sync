-- Add Microsoft App credentials to teams_settings table
ALTER TABLE public.teams_settings 
ADD COLUMN microsoft_app_id text,
ADD COLUMN microsoft_app_password text;