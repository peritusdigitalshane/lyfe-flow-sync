-- Create table for storing email data
CREATE TABLE public.emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  mailbox_id UUID NOT NULL,
  microsoft_id TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  sender_name TEXT,
  recipient_emails TEXT[],
  body_content TEXT,
  body_preview TEXT,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_read BOOLEAN DEFAULT false,
  importance TEXT DEFAULT 'normal',
  has_attachments BOOLEAN DEFAULT false,
  folder_id TEXT,
  folder_name TEXT,
  internet_message_id TEXT,
  conversation_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  processing_status TEXT DEFAULT 'pending',
  error_message TEXT
);

-- Enable RLS
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view emails in their tenant" 
ON public.emails 
FOR SELECT 
USING (tenant_id = (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can create emails in their tenant" 
ON public.emails 
FOR INSERT 
WITH CHECK (tenant_id = (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can update emails in their tenant" 
ON public.emails 
FOR UPDATE 
USING (tenant_id = (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can delete emails in their tenant" 
ON public.emails 
FOR DELETE 
USING (tenant_id = (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid()));

-- Create indexes for performance
CREATE INDEX idx_emails_tenant_mailbox ON public.emails(tenant_id, mailbox_id);
CREATE INDEX idx_emails_microsoft_id ON public.emails(microsoft_id);
CREATE INDEX idx_emails_received_at ON public.emails(received_at DESC);
CREATE INDEX idx_emails_processing_status ON public.emails(processing_status);

-- Create trigger for updated_at
CREATE TRIGGER update_emails_updated_at
BEFORE UPDATE ON public.emails
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Create table for email polling status
CREATE TABLE public.email_polling_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  mailbox_id UUID NOT NULL,
  last_poll_at TIMESTAMP WITH TIME ZONE,
  last_successful_poll_at TIMESTAMP WITH TIME ZONE,
  last_email_received_at TIMESTAMP WITH TIME ZONE,
  total_emails_processed INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  last_error_message TEXT,
  is_polling_active BOOLEAN DEFAULT true,
  polling_interval_minutes INTEGER DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, mailbox_id)
);

-- Enable RLS for polling status
ALTER TABLE public.email_polling_status ENABLE ROW LEVEL SECURITY;

-- Create policies for polling status
CREATE POLICY "Users can view polling status in their tenant" 
ON public.email_polling_status 
FOR SELECT 
USING (tenant_id = (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can create polling status in their tenant" 
ON public.email_polling_status 
FOR INSERT 
WITH CHECK (tenant_id = (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can update polling status in their tenant" 
ON public.email_polling_status 
FOR UPDATE 
USING (tenant_id = (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid()));

-- Create trigger for updated_at on polling status
CREATE TRIGGER update_email_polling_status_updated_at
BEFORE UPDATE ON public.email_polling_status
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Add foreign key constraints
ALTER TABLE public.emails 
ADD CONSTRAINT fk_emails_mailbox 
FOREIGN KEY (mailbox_id) REFERENCES public.mailboxes(id) ON DELETE CASCADE;

ALTER TABLE public.email_polling_status 
ADD CONSTRAINT fk_polling_status_mailbox 
FOREIGN KEY (mailbox_id) REFERENCES public.mailboxes(id) ON DELETE CASCADE;