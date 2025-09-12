-- Fix existing categories that have Microsoft preset color values instead of hex colors
UPDATE email_categories 
SET color = CASE 
  WHEN color = 'preset0' THEN '#3b82f6'
  WHEN color = 'preset1' THEN '#ef4444'
  WHEN color = 'preset2' THEN '#f59e0b'
  WHEN color = 'preset3' THEN '#10b981'
  WHEN color = 'preset4' THEN '#8b5cf6'
  WHEN color = 'preset5' THEN '#f97316'
  WHEN color = 'preset6' THEN '#06b6d4'
  WHEN color = 'preset7' THEN '#84cc16'
  WHEN color = 'preset8' THEN '#ec4899'
  WHEN color = 'preset9' THEN '#6b7280'
  WHEN color = 'preset10' THEN '#14b8a6'
  WHEN color = 'preset11' THEN '#f43f5e'
  WHEN color = 'preset12' THEN '#a855f7'
  WHEN color = 'preset13' THEN '#22c55e'
  WHEN color = 'preset14' THEN '#eab308'
  WHEN color = 'preset15' THEN '#dc2626'
  WHEN color = 'preset16' THEN '#0ea5e9'
  WHEN color = 'preset17' THEN '#7c3aed'
  WHEN color = 'preset18' THEN '#059669'
  WHEN color = 'preset19' THEN '#d97706'
  WHEN color = 'preset20' THEN '#be185d'
  WHEN color = 'preset21' THEN '#4338ca'
  WHEN color = 'preset22' THEN '#0d9488'
  WHEN color = 'preset23' THEN '#9333ea'
  WHEN color = 'preset24' THEN '#65a30d'
  ELSE color
END
WHERE color LIKE 'preset%';