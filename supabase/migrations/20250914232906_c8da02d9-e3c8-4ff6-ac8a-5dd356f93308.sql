-- Add explicit DENY policies for unauthenticated access to all sensitive tables
-- This creates an additional security layer to prevent any unauthenticated access

-- DENY unauthenticated access to profiles table
CREATE POLICY "Deny anonymous access to profiles" 
ON public.profiles 
FOR ALL 
TO anon 
USING (false) 
WITH CHECK (false);

-- DENY unauthenticated access to mailboxes table (contains Microsoft tokens)
CREATE POLICY "Deny anonymous access to mailboxes" 
ON public.mailboxes 
FOR ALL 
TO anon 
USING (false) 
WITH CHECK (false);

-- DENY unauthenticated access to emails table (contains email content)
CREATE POLICY "Deny anonymous access to emails" 
ON public.emails 
FOR ALL 
TO anon 
USING (false) 
WITH CHECK (false);

-- DENY unauthenticated access to subscribers table (contains payment info)
CREATE POLICY "Deny anonymous access to subscribers" 
ON public.subscribers 
FOR ALL 
TO anon 
USING (false) 
WITH CHECK (false);

-- DENY unauthenticated access to other sensitive tables
CREATE POLICY "Deny anonymous access to threat_intelligence_feeds" 
ON public.threat_intelligence_feeds 
FOR ALL 
TO anon 
USING (false) 
WITH CHECK (false);

CREATE POLICY "Deny anonymous access to email_classifications" 
ON public.email_classifications 
FOR ALL 
TO anon 
USING (false) 
WITH CHECK (false);

CREATE POLICY "Deny anonymous access to workflow_rules" 
ON public.workflow_rules 
FOR ALL 
TO anon 
USING (false) 
WITH CHECK (false);

CREATE POLICY "Deny anonymous access to user_roles" 
ON public.user_roles 
FOR ALL 
TO anon 
USING (false) 
WITH CHECK (false);