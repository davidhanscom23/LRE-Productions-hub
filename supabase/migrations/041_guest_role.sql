-- Guest role enum value only.
-- Postgres requires the new enum label to be committed before it can be used
-- in functions/policies, so helpers + RLS live in 042_guest_rls.sql.

alter type public.user_role add value if not exists 'guest';
