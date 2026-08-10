-- Misma causa que en 20260807b: crear la tabla no concede automáticamente
-- los GRANT de Postgres a los roles de Supabase (anon/authenticated/
-- service_role) — sin esto, cualquier consulta falla con "permission
-- denied for table" antes incluso de evaluar las políticas RLS.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nave_fixed_costs TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
