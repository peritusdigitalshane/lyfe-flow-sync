-- Create workflow_rules table for native email automation
CREATE TABLE public.workflow_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  mailbox_id UUID REFERENCES public.mailboxes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  conditions JSONB NOT NULL DEFAULT '[]',
  actions JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create workflow_executions table for logging
CREATE TABLE public.workflow_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  email_id UUID REFERENCES public.emails(id) ON DELETE CASCADE,
  mailbox_id UUID NOT NULL,
  rule_id UUID REFERENCES public.workflow_rules(id) ON DELETE SET NULL,
  execution_status TEXT NOT NULL CHECK (execution_status IN ('pending', 'completed', 'failed')),
  actions_taken JSONB NOT NULL DEFAULT '[]',
  error_message TEXT,
  execution_time_ms INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX idx_workflow_rules_tenant_id ON public.workflow_rules(tenant_id);
CREATE INDEX idx_workflow_rules_mailbox_id ON public.workflow_rules(mailbox_id);
CREATE INDEX idx_workflow_rules_priority ON public.workflow_rules(priority DESC);
CREATE INDEX idx_workflow_executions_tenant_id ON public.workflow_executions(tenant_id);
CREATE INDEX idx_workflow_executions_email_id ON public.workflow_executions(email_id);
CREATE INDEX idx_workflow_executions_rule_id ON public.workflow_executions(rule_id);

-- Enable RLS
ALTER TABLE public.workflow_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;

-- RLS policies for workflow_rules
CREATE POLICY "Users can view workflow rules in their tenant" 
ON public.workflow_rules 
FOR SELECT 
USING (tenant_id = (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can create workflow rules in their tenant" 
ON public.workflow_rules 
FOR INSERT 
WITH CHECK (tenant_id = (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can update workflow rules in their tenant" 
ON public.workflow_rules 
FOR UPDATE 
USING (tenant_id = (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can delete workflow rules in their tenant" 
ON public.workflow_rules 
FOR DELETE 
USING (tenant_id = (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid()));

-- RLS policies for workflow_executions
CREATE POLICY "Users can view workflow executions in their tenant" 
ON public.workflow_executions 
FOR SELECT 
USING (tenant_id = (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can create workflow executions in their tenant" 
ON public.workflow_executions 
FOR INSERT 
WITH CHECK (tenant_id = (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid()));

-- Add trigger for updated_at on workflow_rules
CREATE TRIGGER update_workflow_rules_updated_at
BEFORE UPDATE ON public.workflow_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Add quarantined status to emails processing_status
ALTER TABLE public.emails 
DROP CONSTRAINT IF EXISTS emails_processing_status_check;

ALTER TABLE public.emails 
ADD CONSTRAINT emails_processing_status_check 
CHECK (processing_status IN ('pending', 'processed', 'failed', 'quarantined'));