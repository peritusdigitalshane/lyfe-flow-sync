-- Fix existing categories with correct Microsoft preset color mappings
UPDATE email_categories 
SET color = CASE 
  WHEN color = 'preset0' THEN '#ff1a36'   -- red
  WHEN color = 'preset1' THEN '#ff8c00'   -- orange  
  WHEN color = 'preset2' THEN '#f4b942'   -- peach/yellow
  WHEN color = 'preset3' THEN '#009e49'   -- green
  WHEN color = 'preset4' THEN '#00bcf2'   -- teal/cyan
  WHEN color = 'preset5' THEN '#0078d4'   -- blue
  WHEN color = 'preset6' THEN '#4b0082'   -- dark blue/indigo
  WHEN color = 'preset7' THEN '#5c2d91'   -- purple
  WHEN color = 'preset8' THEN '#e3008c'   -- cranberry/pink
  WHEN color = 'preset9' THEN '#881798'   -- steel/gray
  WHEN color = 'preset10' THEN '#498205'  -- dark green
  WHEN color = 'preset11' THEN '#d13438'  -- dark red
  WHEN color = 'preset12' THEN '#ff4b4b'  -- bright red
  WHEN color = 'preset13' THEN '#00cc6a'  -- bright green
  WHEN color = 'preset14' THEN '#ffb900'  -- yellow
  WHEN color = 'preset15' THEN '#dc2626'  -- red variant
  WHEN color = 'preset16' THEN '#0ea5e9'  -- sky blue
  WHEN color = 'preset17' THEN '#7c3aed'  -- violet
  WHEN color = 'preset18' THEN '#059669'  -- emerald
  WHEN color = 'preset19' THEN '#d97706'  -- amber
  WHEN color = 'preset20' THEN '#be185d'  -- pink
  WHEN color = 'preset21' THEN '#4338ca'  -- indigo
  WHEN color = 'preset22' THEN '#0d9488'  -- teal
  WHEN color = 'preset23' THEN '#9333ea'  -- purple variant
  WHEN color = 'preset24' THEN '#65a30d'  -- lime
  ELSE color
END
WHERE color LIKE 'preset%';