-- Create user writing style profiles table
CREATE TABLE public.user_writing_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  writing_style JSONB DEFAULT '{}',
  signature TEXT,
  last_analyzed_at TIMESTAMP WITH TIME ZONE,
  emails_analyzed INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for user_writing_profiles
ALTER TABLE public.user_writing_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_writing_profiles
CREATE POLICY "Users can create their own writing profile"
ON public.user_writing_profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own writing profile"
ON public.user_writing_profiles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own writing profile"
ON public.user_writing_profiles
FOR UPDATE
USING (auth.uid() = user_id);

-- Create generated replies tracking table
CREATE TABLE public.generated_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  original_email_id TEXT,
  generated_content TEXT,
  reply_type TEXT,
  was_sent BOOLEAN DEFAULT FALSE,
  was_edited BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for generated_replies
ALTER TABLE public.generated_replies ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for generated_replies
CREATE POLICY "Users can create their own reply records"
ON public.generated_replies
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own reply records"
ON public.generated_replies
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own reply records"
ON public.generated_replies
FOR UPDATE
USING (auth.uid() = user_id);

-- Create trigger for updating updated_at timestamp
CREATE TRIGGER update_user_writing_profiles_updated_at
BEFORE UPDATE ON public.user_writing_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();