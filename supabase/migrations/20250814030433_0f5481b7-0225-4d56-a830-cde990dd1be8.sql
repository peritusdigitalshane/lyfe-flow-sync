-- Create email categories table
CREATE TABLE public.email_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3b82f6',
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create email classification rules table
CREATE TABLE public.email_classification_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  category_id UUID NOT NULL REFERENCES public.email_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('sender', 'subject', 'content', 'domain', 'ai')),
  rule_value TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create email classifications table (for storing classified emails)
CREATE TABLE public.email_classifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  mailbox_id UUID NOT NULL REFERENCES public.mailboxes(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.email_categories(id) ON DELETE CASCADE,
  email_id TEXT NOT NULL, -- Microsoft Graph email ID
  confidence_score DECIMAL(3,2) DEFAULT 1.0,
  classification_method TEXT NOT NULL CHECK (classification_method IN ('rule', 'ai', 'manual')),
  rule_id UUID REFERENCES public.email_classification_rules(id),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_classification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_classifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view categories in their tenant" 
ON public.email_categories 
FOR SELECT 
USING (tenant_id = ( SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can create categories in their tenant" 
ON public.email_categories 
FOR INSERT 
WITH CHECK (tenant_id = ( SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can update categories in their tenant" 
ON public.email_categories 
FOR UPDATE 
USING (tenant_id = ( SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can delete categories in their tenant" 
ON public.email_categories 
FOR DELETE 
USING (tenant_id = ( SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid()));

-- Rules policies
CREATE POLICY "Users can view rules in their tenant" 
ON public.email_classification_rules 
FOR SELECT 
USING (tenant_id = ( SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can create rules in their tenant" 
ON public.email_classification_rules 
FOR INSERT 
WITH CHECK (tenant_id = ( SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can update rules in their tenant" 
ON public.email_classification_rules 
FOR UPDATE 
USING (tenant_id = ( SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can delete rules in their tenant" 
ON public.email_classification_rules 
FOR DELETE 
USING (tenant_id = ( SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid()));

-- Classifications policies
CREATE POLICY "Users can view classifications in their tenant" 
ON public.email_classifications 
FOR SELECT 
USING (tenant_id = ( SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can create classifications in their tenant" 
ON public.email_classifications 
FOR INSERT 
WITH CHECK (tenant_id = ( SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can update classifications in their tenant" 
ON public.email_classifications 
FOR UPDATE 
USING (tenant_id = ( SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can delete classifications in their tenant" 
ON public.email_classifications 
FOR DELETE 
USING (tenant_id = ( SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid()));

-- Create indexes for better performance
CREATE INDEX idx_email_categories_tenant_id ON public.email_categories(tenant_id);
CREATE INDEX idx_email_classification_rules_tenant_id ON public.email_classification_rules(tenant_id);
CREATE INDEX idx_email_classification_rules_category_id ON public.email_classification_rules(category_id);
CREATE INDEX idx_email_classifications_tenant_id ON public.email_classifications(tenant_id);
CREATE INDEX idx_email_classifications_mailbox_id ON public.email_classifications(mailbox_id);
CREATE INDEX idx_email_classifications_category_id ON public.email_classifications(category_id);
CREATE INDEX idx_email_classifications_email_id ON public.email_classifications(email_id);

-- Create trigger for updated_at
CREATE TRIGGER update_email_categories_updated_at
BEFORE UPDATE ON public.email_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_email_classification_rules_updated_at
BEFORE UPDATE ON public.email_classification_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Insert default categories
INSERT INTO public.email_categories (tenant_id, name, description, color, priority) VALUES
('00000000-0000-0000-0000-000000000000', 'Important', 'High priority emails requiring immediate attention', '#ef4444', 100),
('00000000-0000-0000-0000-000000000000', 'Spam', 'Unwanted or suspicious emails', '#64748b', 10),
('00000000-0000-0000-0000-000000000000', 'Marketing', 'Promotional and marketing emails', '#f59e0b', 30),
('00000000-0000-0000-0000-000000000000', 'Personal', 'Personal communications', '#10b981', 70),
('00000000-0000-0000-0000-000000000000', 'Work', 'Work-related communications', '#3b82f6', 80),
('00000000-0000-0000-0000-000000000000', 'Social', 'Social media notifications', '#8b5cf6', 40),
('00000000-0000-0000-0000-000000000000', 'Newsletters', 'Newsletters and subscriptions', '#06b6d4', 50);