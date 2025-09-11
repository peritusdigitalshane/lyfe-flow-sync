-- Add mailbox_id column to email_categories table to make categories mailbox-specific
ALTER TABLE public.email_categories 
ADD COLUMN mailbox_id UUID REFERENCES public.mailboxes(id);

-- Update the existing RLS policies to consider mailbox ownership
DROP POLICY IF EXISTS "Users can view their own categories" ON public.email_categories;
DROP POLICY IF EXISTS "Users can create their own categories" ON public.email_categories;
DROP POLICY IF EXISTS "Users can update their own categories" ON public.email_categories;
DROP POLICY IF EXISTS "Users can delete their own categories" ON public.email_categories;

-- Create new RLS policies that consider both user and mailbox
CREATE POLICY "Users can view categories for their mailboxes" 
ON public.email_categories 
FOR SELECT 
USING (
  auth.uid() = user_id 
  AND (
    mailbox_id IS NULL 
    OR mailbox_id IN (
      SELECT id FROM public.mailboxes 
      WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can create categories for their mailboxes" 
ON public.email_categories 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  AND (
    mailbox_id IS NULL 
    OR mailbox_id IN (
      SELECT id FROM public.mailboxes 
      WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can update categories for their mailboxes" 
ON public.email_categories 
FOR UPDATE 
USING (
  auth.uid() = user_id 
  AND (
    mailbox_id IS NULL 
    OR mailbox_id IN (
      SELECT id FROM public.mailboxes 
      WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can delete categories for their mailboxes" 
ON public.email_categories 
FOR DELETE 
USING (
  auth.uid() = user_id 
  AND (
    mailbox_id IS NULL 
    OR mailbox_id IN (
      SELECT id FROM public.mailboxes 
      WHERE user_id = auth.uid()
    )
  )
);