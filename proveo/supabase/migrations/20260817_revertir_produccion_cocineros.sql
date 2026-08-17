-- Se descarta el módulo de producción/programación para cocineros: no se
-- va a desarrollar. Se eliminan sus tablas y se revierte el rol 'cocinero'
-- (no hay ninguna cuenta con ese rol en uso — se comprobó antes de borrar).
DROP TABLE IF EXISTS production_task_ingredients;
DROP TABLE IF EXISTS production_tasks;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'nave_manager', 'restaurante_manager', 'restaurante_staff'));

NOTIFY pgrst, 'reload schema';
