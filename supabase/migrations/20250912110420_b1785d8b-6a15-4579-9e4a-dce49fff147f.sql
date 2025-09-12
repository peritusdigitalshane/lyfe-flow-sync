-- Update RLS policy to allow super admins to update preconfigured feeds
DROP POLICY IF EXISTS "Users can update feeds in their tenant" ON threat_intelligence_feeds;

CREATE POLICY "Users can update feeds in their tenant or super admins can update preconfigured feeds" 
ON threat_intelligence_feeds 
FOR UPDATE 
USING (
  (tenant_id = (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid())) 
  OR 
  (is_preconfigured = true AND has_role(auth.uid(), 'super_admin'))
);