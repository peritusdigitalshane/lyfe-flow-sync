-- Fix user activation system - activate all pending users who should be active
UPDATE public.profiles 
SET account_status = 'active' 
WHERE account_status = 'pending';