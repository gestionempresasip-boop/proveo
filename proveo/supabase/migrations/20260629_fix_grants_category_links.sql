-- La tabla product_category_links se quedó sin los permisos básicos de
-- Postgres (GRANT) que Supabase normalmente aplica automáticamente a
-- anon/authenticated/service_role, así que cualquier consulta devolvía
-- "permission denied for table" antes incluso de evaluar las políticas RLS.
-- Por eso al editar un producto con varias categorías marcadas, el guardado
-- de las categorías fallaba en silencio (el resto del producto sí se
-- guardaba, porque esa parte usa la tabla products, que sí tenía permisos).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_category_links TO authenticated, service_role;
GRANT SELECT ON public.product_category_links TO anon;

NOTIFY pgrst, 'reload schema';
