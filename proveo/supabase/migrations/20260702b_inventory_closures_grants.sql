-- Mismo problema que product_category_links (ver 20260629_fix_grants_category_links.sql):
-- las tablas nuevas no heredan los GRANT básicos de Postgres, así que toda
-- consulta devuelve "permission denied" antes de evaluar RLS.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_closures TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_closure_items TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
