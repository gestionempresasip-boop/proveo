-- La tabla pending_carts se quedó sin los permisos básicos de Postgres
-- (GRANT) que Supabase normalmente aplica automáticamente a
-- anon/authenticated/service_role, así que cualquier consulta devolvía
-- "permission denied for table" antes incluso de evaluar las políticas
-- RLS. Por eso la cesta pendiente nunca llegaba a guardarse ni leerse
-- entre dispositivos — el "restaurar" que sí se veía era solo el de
-- localStorage (mismo navegador), nunca el del servidor.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_carts TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
