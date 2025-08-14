-- Create a table for global application settings
CREATE TABLE public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Create policy for viewing settings (authenticated users only)
CREATE POLICY "Authenticated users can view app settings" 
ON public.app_settings 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Create policy for updating settings (authenticated users only)
CREATE POLICY "Authenticated users can update app settings" 
ON public.app_settings 
FOR ALL
USING (auth.role() = 'authenticated');

-- Insert default Microsoft OAuth settings
INSERT INTO public.app_settings (key, value, description) VALUES 
('microsoft_oauth', '{"client_id": "", "client_secret": "", "tenant_id": "common"}', 'Microsoft Azure OAuth configuration for mailbox connections');

-- Create function to update timestamps
CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();