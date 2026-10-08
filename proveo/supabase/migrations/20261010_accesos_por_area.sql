-- Accesos de la nave por función: cada perfil de la nave (Cocina, Gestión, Reparto,
-- Finanzas, Dirección) solo ve las áreas que tiene permitidas.
--
-- areas = NULL significa «todas las áreas» (así los usuarios que ya existen, incluido el
-- de la nave actual, siguen funcionando igual). Solo añade una columna.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS areas text[];

NOTIFY pgrst, 'reload schema';
