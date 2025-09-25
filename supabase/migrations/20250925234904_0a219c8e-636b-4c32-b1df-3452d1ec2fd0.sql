-- Create VIP email addresses table
CREATE TABLE public.vip_email_addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  email_address TEXT NOT NULL,
  display_name TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, email_address)
);

-- Enable Row Level Security
ALTER TABLE public.vip_email_addresses ENABLE ROW LEVEL SECURITY;

-- Create policies for VIP email addresses
CREATE POLICY "Users can view VIP emails in their tenant" 
ON public.vip_email_addresses 
FOR SELECT 
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create VIP emails in their tenant" 
ON public.vip_email_addresses 
FOR INSERT 
WITH CHECK (
  tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) 
  AND user_id = auth.uid()
);

CREATE POLICY "Users can update VIP emails in their tenant" 
ON public.vip_email_addresses 
FOR UPDATE 
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete VIP emails in their tenant" 
ON public.vip_email_addresses 
FOR DELETE 
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_vip_email_addresses_updated_at
BEFORE UPDATE ON public.vip_email_addresses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Add VIP status to emails table
ALTER TABLE public.emails ADD COLUMN is_vip BOOLEAN DEFAULT false;

-- Create index for better performance on VIP lookups
CREATE INDEX idx_vip_email_addresses_tenant_email ON public.vip_email_addresses(tenant_id, email_address);
CREATE INDEX idx_emails_is_vip ON public.emails(is_vip) WHERE is_vip = true;