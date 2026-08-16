-- Nuevo rol 'cocinero': personal de cocina de la nave con login individual
-- (su propio PIN, como ya tienen los restaurantes), para poder asignarle
-- producciones concretas y que solo vea las suyas.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'nave_manager', 'restaurante_manager', 'restaurante_staff', 'cocinero'));

-- Tareas de producción asignadas a un cocinero. organization_id es siempre
-- la nave (igual que en nave_inventory); recipe_id es opcional por si en el
-- futuro se asignan producciones sin escandallo formal.
CREATE TABLE production_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  recipe_id uuid REFERENCES recipes(id),
  assigned_to uuid NOT NULL REFERENCES profiles(id),
  created_by uuid REFERENCES profiles(id),
  title text NOT NULL,
  scheduled_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  status text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'en_proceso', 'completada')),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ingredientes de la ficha: se copian de recipe_ingredients al crear la
-- tarea (predefinidos, is_custom=false), y el cocinero puede añadir más
-- sobre la marcha (is_custom=true, sin product_id). Se guardan nombre y
-- unidad ya resueltos para que la ficha no dependa de un join con products.
CREATE TABLE production_task_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES production_tasks(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id),
  name text NOT NULL,
  quantity decimal(10,3),
  unit text,
  is_custom boolean NOT NULL DEFAULT false,
  checked boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE production_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_task_ingredients ENABLE ROW LEVEL SECURITY;

-- A diferencia de nave_inventory, aquí NO se puede usar "get_my_org_type() =
-- 'nave'" como condición de gestión total: ahora los cocineros también
-- pertenecen a la nave, y solo deben poder tocar sus propias tareas, no las
-- de sus compañeros. Gestión completa queda restringida a admin/nave_manager.
CREATE POLICY "prod_tasks_select" ON production_tasks FOR SELECT TO authenticated
  USING (assigned_to = auth.uid() OR get_my_role() IN ('admin', 'nave_manager'));
CREATE POLICY "prod_tasks_manage" ON production_tasks FOR ALL TO authenticated
  USING (get_my_role() IN ('admin', 'nave_manager'))
  WITH CHECK (get_my_role() IN ('admin', 'nave_manager'));
CREATE POLICY "prod_tasks_update_own" ON production_tasks FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid())
  WITH CHECK (assigned_to = auth.uid());

CREATE POLICY "prod_ingredients_select" ON production_task_ingredients FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM production_tasks t WHERE t.id = task_id
      AND (t.assigned_to = auth.uid() OR get_my_role() IN ('admin', 'nave_manager'))
    )
  );
CREATE POLICY "prod_ingredients_manage" ON production_task_ingredients FOR ALL TO authenticated
  USING (get_my_role() IN ('admin', 'nave_manager'))
  WITH CHECK (get_my_role() IN ('admin', 'nave_manager'));
CREATE POLICY "prod_ingredients_update_own" ON production_task_ingredients FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM production_tasks t WHERE t.id = task_id AND t.assigned_to = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM production_tasks t WHERE t.id = task_id AND t.assigned_to = auth.uid()));

-- Sin este GRANT explícito, cualquier consulta falla con "permission denied
-- for table" antes de evaluar las políticas RLS (ya nos pasó con
-- pending_carts y con nave_fixed_costs).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_tasks TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_task_ingredients TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
