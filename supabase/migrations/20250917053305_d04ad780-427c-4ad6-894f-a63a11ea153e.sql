-- Add 'teams' to the user_module enum
ALTER TYPE user_module ADD VALUE IF NOT EXISTS 'teams';

-- Create teams_settings table for user preferences
CREATE TABLE IF NOT EXISTS public.teams_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  integration_type TEXT NOT NULL CHECK (integration_type IN ('transcription', 'bot', 'both')),
  auto_transcription_enabled BOOLEAN DEFAULT true,
  meeting_analytics_enabled BOOLEAN DEFAULT true,
  action_item_extraction BOOLEAN DEFAULT true,
  speaking_time_analysis BOOLEAN DEFAULT false,
  bot_enabled BOOLEAN DEFAULT false,
  bot_name TEXT DEFAULT 'Meeting Assistant',
  notification_preferences JSONB DEFAULT '{"email": true, "teams": false}',
  retention_days INTEGER DEFAULT 90,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create meeting_summaries table
CREATE TABLE IF NOT EXISTS public.meeting_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  meeting_id TEXT NOT NULL,
  meeting_title TEXT NOT NULL,
  meeting_date TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER,
  participants JSONB DEFAULT '[]',
  transcript TEXT,
  summary TEXT,
  action_items JSONB DEFAULT '[]',
  key_decisions JSONB DEFAULT '[]',
  speaking_time_analysis JSONB DEFAULT '{}',
  effectiveness_score INTEGER CHECK (effectiveness_score >= 0 AND effectiveness_score <= 100),
  integration_type TEXT NOT NULL CHECK (integration_type IN ('transcription', 'bot')),
  source_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create meeting_action_items table for tracking
CREATE TABLE IF NOT EXISTS public.meeting_action_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  meeting_summary_id UUID NOT NULL REFERENCES public.meeting_summaries(id) ON DELETE CASCADE,
  assigned_to TEXT,
  description TEXT NOT NULL,
  due_date TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create teams_analytics table for insights
CREATE TABLE IF NOT EXISTS public.teams_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  total_meetings INTEGER DEFAULT 0,
  total_meeting_time_minutes INTEGER DEFAULT 0,
  average_meeting_duration INTEGER DEFAULT 0,
  average_effectiveness_score NUMERIC(3,1),
  total_action_items INTEGER DEFAULT 0,
  completed_action_items INTEGER DEFAULT 0,
  most_active_participants JSONB DEFAULT '[]',
  meeting_patterns JSONB DEFAULT '{}',
  insights JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.teams_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for teams_settings
CREATE POLICY "Users can manage their own teams settings"
ON public.teams_settings
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- RLS Policies for meeting_summaries
CREATE POLICY "Users can view meeting summaries in their tenant"
ON public.meeting_summaries
FOR SELECT
TO authenticated
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create meeting summaries in their tenant"
ON public.meeting_summaries
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) AND
  user_id = auth.uid()
);

CREATE POLICY "Users can update meeting summaries in their tenant"
ON public.meeting_summaries
FOR UPDATE
TO authenticated
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete meeting summaries in their tenant"
ON public.meeting_summaries
FOR DELETE
TO authenticated
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- RLS Policies for meeting_action_items
CREATE POLICY "Users can view action items in their tenant"
ON public.meeting_action_items
FOR SELECT
TO authenticated
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage action items in their tenant"
ON public.meeting_action_items
FOR ALL
TO authenticated
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- RLS Policies for teams_analytics
CREATE POLICY "Users can view analytics in their tenant"
ON public.teams_analytics
FOR SELECT
TO authenticated
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create analytics in their tenant"
ON public.teams_analytics
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) AND
  user_id = auth.uid()
);

-- Add updated_at triggers
CREATE TRIGGER update_teams_settings_updated_at
  BEFORE UPDATE ON public.teams_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_meeting_summaries_updated_at
  BEFORE UPDATE ON public.meeting_summaries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_meeting_action_items_updated_at
  BEFORE UPDATE ON public.meeting_action_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_meeting_summaries_tenant_user ON public.meeting_summaries(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_summaries_date ON public.meeting_summaries(meeting_date DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_status ON public.meeting_action_items(status);
CREATE INDEX IF NOT EXISTS idx_teams_analytics_period ON public.teams_analytics(user_id, period_start, period_end);