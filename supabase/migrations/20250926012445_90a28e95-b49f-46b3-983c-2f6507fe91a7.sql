-- Create storage bucket for backups
INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false);

-- Create RLS policies for backups bucket
CREATE POLICY "Authenticated users can upload backups"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'backups');

CREATE POLICY "Authenticated users can view their tenant backups"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'backups' AND
  (storage.foldername(name))[1] = (
    SELECT tenant_id::text 
    FROM profiles 
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Authenticated users can delete their tenant backups"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'backups' AND
  (storage.foldername(name))[1] = (
    SELECT tenant_id::text 
    FROM profiles 
    WHERE id = auth.uid()
  )
);