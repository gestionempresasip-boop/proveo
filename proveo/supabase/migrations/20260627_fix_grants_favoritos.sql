-- La tabla restaurant_favorite_products se quedó sin los permisos básicos
-- de Postgres (GRANT) que Supabase normalmente aplica automáticamente a
-- anon/authenticated/service_role, así que cualquier consulta devolvía
-- "permission denied for table" antes incluso de evaluar las políticas RLS.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_favorite_products TO authenticated, service_role;
GRANT SELECT ON public.restaurant_favorite_products TO anon;

NOTIFY pgrst, 'reload schema';
