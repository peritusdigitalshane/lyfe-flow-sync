-- Add user_id to email_categories table for personal categories
ALTER TABLE public.email_categories ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Drop existing tenant-based policies
DROP POLICY IF EXISTS "Users can create categories in their tenant" ON public.email_categories;
DROP POLICY IF EXISTS "Users can view categories in their tenant" ON public.email_categories;
DROP POLICY IF EXISTS "Users can update categories in their tenant" ON public.email_categories;
DROP POLICY IF EXISTS "Users can delete categories in their tenant" ON public.email_categories;

-- Create new user-specific policies
CREATE POLICY "Users can create their own categories" 
ON public.email_categories 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own categories" 
ON public.email_categories 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own categories" 
ON public.email_categories 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own categories" 
ON public.email_categories 
FOR DELETE 
USING (auth.uid() = user_id);

-- Update email_classification_rules to also be user-specific
ALTER TABLE public.email_classification_rules ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Drop existing tenant-based policies for rules
DROP POLICY IF EXISTS "Users can create rules in their tenant" ON public.email_classification_rules;
DROP POLICY IF EXISTS "Users can view rules in their tenant" ON public.email_classification_rules;
DROP POLICY IF EXISTS "Users can update rules in their tenant" ON public.email_classification_rules;
DROP POLICY IF EXISTS "Users can delete rules in their tenant" ON public.email_classification_rules;

-- Create new user-specific policies for rules
CREATE POLICY "Users can create their own rules" 
ON public.email_classification_rules 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own rules" 
ON public.email_classification_rules 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own rules" 
ON public.email_classification_rules 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own rules" 
ON public.email_classification_rules 
FOR DELETE 
USING (auth.uid() = user_id);