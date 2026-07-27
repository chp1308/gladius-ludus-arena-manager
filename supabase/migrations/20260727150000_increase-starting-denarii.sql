-- Raise the starting denarii for a newly founded ludus from 500 to 1000.
-- Only changes the column default; existing profiles are untouched.
ALTER TABLE public.profiles ALTER COLUMN denarii SET DEFAULT 1000;
