-- RLS, wrappers and least-privilege grants for inventory.
-- Authenticated members may SELECT their workspace rows.
-- All writes go through SECURITY DEFINER RPCs in app.* with public wrappers.

ALTER TABLE public.inventory_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_products FORCE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.inventory_products FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.inventory_movements FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.inventory_products TO authenticated;
GRANT SELECT ON TABLE public.inventory_movements TO authenticated;

CREATE POLICY inventory_products_select_member
  ON public.inventory_products
  FOR SELECT
  TO authenticated
  USING ((SELECT app.is_workspace_member(workspace_id)));

CREATE POLICY inventory_movements_select_member
  ON public.inventory_movements
  FOR SELECT
  TO authenticated
  USING ((SELECT app.is_workspace_member(workspace_id)));

CREATE OR REPLACE FUNCTION public.create_inventory_product(
  p_workspace_id uuid,
  p_name text,
  p_description text DEFAULT NULL,
  p_sku text DEFAULT NULL,
  p_unit public.inventory_unit DEFAULT 'unidade',
  p_initial_quantity numeric DEFAULT 0,
  p_minimum_quantity numeric DEFAULT 0,
  p_cost_cents integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app.create_inventory_product(
    p_workspace_id, p_name, p_description, p_sku, p_unit,
    p_initial_quantity, p_minimum_quantity, p_cost_cents
  );
$$;

CREATE OR REPLACE FUNCTION public.update_inventory_product(
  p_workspace_id uuid,
  p_product_id uuid,
  p_name text,
  p_description text DEFAULT NULL,
  p_sku text DEFAULT NULL,
  p_unit public.inventory_unit DEFAULT 'unidade',
  p_minimum_quantity numeric DEFAULT 0,
  p_cost_cents integer DEFAULT NULL,
  p_active boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app.update_inventory_product(
    p_workspace_id, p_product_id, p_name, p_description, p_sku, p_unit,
    p_minimum_quantity, p_cost_cents, p_active
  );
$$;

CREATE OR REPLACE FUNCTION public.archive_inventory_product(p_workspace_id uuid, p_product_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app.archive_inventory_product(p_workspace_id, p_product_id);
$$;

CREATE OR REPLACE FUNCTION public.reactivate_inventory_product(p_workspace_id uuid, p_product_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app.reactivate_inventory_product(p_workspace_id, p_product_id);
$$;

CREATE OR REPLACE FUNCTION public.apply_inventory_movement(
  p_workspace_id uuid,
  p_product_id uuid,
  p_type public.inventory_movement_type,
  p_quantity numeric DEFAULT NULL,
  p_new_quantity numeric DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app.apply_inventory_movement(
    p_workspace_id, p_product_id, p_type, p_quantity, p_new_quantity, p_reason
  );
$$;

REVOKE ALL ON FUNCTION app.assert_inventory_manager(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.assert_inventory_mover(uuid, public.inventory_movement_type) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.normalize_inventory_quantity(numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.lock_inventory_product(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.apply_inventory_movement(uuid, uuid, public.inventory_movement_type, numeric, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.create_inventory_product(uuid, text, text, text, public.inventory_unit, numeric, numeric, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.update_inventory_product(uuid, uuid, text, text, text, public.inventory_unit, numeric, integer, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.archive_inventory_product(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.reactivate_inventory_product(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.protect_inventory_product_columns() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.touch_inventory_product_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.forbid_inventory_movement_mutation() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.create_inventory_product(uuid, text, text, text, public.inventory_unit, numeric, numeric, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_inventory_product(uuid, uuid, text, text, text, public.inventory_unit, numeric, integer, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.archive_inventory_product(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reactivate_inventory_product(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.apply_inventory_movement(uuid, uuid, public.inventory_movement_type, numeric, numeric, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_inventory_product(uuid, text, text, text, public.inventory_unit, numeric, numeric, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_inventory_product(uuid, uuid, text, text, text, public.inventory_unit, numeric, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_inventory_product(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reactivate_inventory_product(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_inventory_movement(uuid, uuid, public.inventory_movement_type, numeric, numeric, text) TO authenticated;
