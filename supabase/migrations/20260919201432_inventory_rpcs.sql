CREATE OR REPLACE FUNCTION app.assert_inventory_manager(p_workspace_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT app.has_workspace_role(
    p_workspace_id,
    VARIADIC ARRAY['owner'::public.member_role, 'admin'::public.member_role]
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION app.assert_inventory_mover(
  p_workspace_id uuid,
  p_type public.inventory_movement_type
)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_type = 'adjustment'::public.inventory_movement_type THEN
    PERFORM app.assert_inventory_manager(p_workspace_id);
    RETURN;
  END IF;
  IF NOT app.has_workspace_role(
    p_workspace_id,
    VARIADIC ARRAY['owner'::public.member_role, 'admin'::public.member_role, 'receptionist'::public.member_role]
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION app.normalize_inventory_quantity(p_value numeric)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE v_qty numeric(12, 3);
BEGIN
  IF p_value IS NULL THEN
    RAISE EXCEPTION 'invalid_quantity' USING ERRCODE = '22023';
  END IF;
  v_qty := round(p_value, 3);
  IF v_qty < 0 OR v_qty > 999999999.999 THEN
    RAISE EXCEPTION 'invalid_quantity' USING ERRCODE = '22023';
  END IF;
  RETURN v_qty;
END;
$$;

CREATE OR REPLACE FUNCTION app.lock_inventory_product(p_workspace_id uuid, p_product_id uuid)
RETURNS public.inventory_products LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_product public.inventory_products;
BEGIN
  SELECT * INTO v_product FROM public.inventory_products p
  WHERE p.id = p_product_id AND p.workspace_id = p_workspace_id FOR UPDATE;
  IF v_product.id IS NULL THEN
    RAISE EXCEPTION 'inventory_product_not_found' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_product;
END;
$$;

CREATE OR REPLACE FUNCTION app.apply_inventory_movement(
  p_workspace_id uuid,
  p_product_id uuid,
  p_type public.inventory_movement_type,
  p_quantity numeric DEFAULT NULL,
  p_new_quantity numeric DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_product public.inventory_products;
  v_before numeric(12, 3);
  v_after numeric(12, 3);
  v_qty numeric(12, 3);
  v_reason text;
  v_movement_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  PERFORM app.assert_inventory_mover(p_workspace_id, p_type);
  v_product := app.lock_inventory_product(p_workspace_id, p_product_id);
  IF v_product.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'inventory_product_archived' USING ERRCODE = '42501';
  END IF;
  v_before := v_product.quantity;
  v_reason := nullif(btrim(COALESCE(p_reason, '')), '');
  IF p_type = 'adjustment'::public.inventory_movement_type THEN
    v_after := app.normalize_inventory_quantity(p_new_quantity);
    v_qty := abs(v_after - v_before);
  ELSE
    v_qty := app.normalize_inventory_quantity(p_quantity);
    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'invalid_quantity' USING ERRCODE = '22023';
    END IF;
    IF p_type = 'entry'::public.inventory_movement_type THEN
      v_after := v_before + v_qty;
    ELSE
      v_after := v_before - v_qty;
    END IF;
  END IF;
  IF v_after < 0 THEN
    RAISE EXCEPTION 'insufficient_stock' USING ERRCODE = 'P0001';
  END IF;
  v_after := app.normalize_inventory_quantity(v_after);
  PERFORM set_config('app.inventory_mutating', 'on', true);
  UPDATE public.inventory_products SET quantity = v_after
  WHERE id = v_product.id AND workspace_id = v_product.workspace_id;
  INSERT INTO public.inventory_movements (
    workspace_id, product_id, type, quantity, quantity_before, quantity_after, reason, created_by
  ) VALUES (
    v_product.workspace_id, v_product.id, p_type, v_qty, v_before, v_after, v_reason, auth.uid()
  ) RETURNING id INTO v_movement_id;
  PERFORM set_config('app.inventory_mutating', 'off', true);
  RETURN jsonb_build_object(
    'movement_id', v_movement_id,
    'product_id', v_product.id,
    'type', p_type,
    'quantity', v_qty,
    'quantity_before', v_before,
    'quantity_after', v_after
  );
END;
$$;

CREATE OR REPLACE FUNCTION app.create_inventory_product(
  p_workspace_id uuid,
  p_name text,
  p_description text DEFAULT NULL,
  p_sku text DEFAULT NULL,
  p_unit public.inventory_unit DEFAULT 'unidade',
  p_initial_quantity numeric DEFAULT 0,
  p_minimum_quantity numeric DEFAULT 0,
  p_cost_cents integer DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_product public.inventory_products;
  v_initial numeric(12, 3);
  v_movement jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  PERFORM app.assert_inventory_manager(p_workspace_id);
  v_initial := app.normalize_inventory_quantity(COALESCE(p_initial_quantity, 0));
  INSERT INTO public.inventory_products (
    workspace_id, name, description, sku, unit, quantity, minimum_quantity, cost_cents, created_by
  ) VALUES (
    p_workspace_id, btrim(p_name), nullif(btrim(COALESCE(p_description, '')), ''),
    nullif(btrim(COALESCE(p_sku, '')), ''), p_unit, 0,
    app.normalize_inventory_quantity(COALESCE(p_minimum_quantity, 0)), p_cost_cents, auth.uid()
  ) RETURNING * INTO v_product;
  IF v_initial > 0 THEN
    v_movement := app.apply_inventory_movement(
      p_workspace_id, v_product.id, 'entry'::public.inventory_movement_type, v_initial, NULL, 'Quantidade inicial'
    );
  END IF;
  SELECT * INTO v_product FROM public.inventory_products WHERE id = v_product.id;
  RETURN jsonb_build_object(
    'id', v_product.id,
    'workspace_id', v_product.workspace_id,
    'name', v_product.name,
    'quantity', v_product.quantity,
    'unit', v_product.unit,
    'minimum_quantity', v_product.minimum_quantity,
    'initial_movement', v_movement
  );
END;
$$;

CREATE OR REPLACE FUNCTION app.update_inventory_product(
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
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_product public.inventory_products;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  PERFORM app.assert_inventory_manager(p_workspace_id);
  PERFORM app.lock_inventory_product(p_workspace_id, p_product_id);
  UPDATE public.inventory_products SET
    name = btrim(p_name),
    description = nullif(btrim(COALESCE(p_description, '')), ''),
    sku = nullif(btrim(COALESCE(p_sku, '')), ''),
    unit = p_unit,
    minimum_quantity = app.normalize_inventory_quantity(COALESCE(p_minimum_quantity, 0)),
    cost_cents = p_cost_cents,
    active = CASE WHEN archived_at IS NULL THEN p_active ELSE false END
  WHERE id = p_product_id AND workspace_id = p_workspace_id
  RETURNING * INTO v_product;
  RETURN jsonb_build_object('id', v_product.id, 'name', v_product.name, 'quantity', v_product.quantity, 'active', v_product.active);
END;
$$;

CREATE OR REPLACE FUNCTION app.archive_inventory_product(p_workspace_id uuid, p_product_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_product public.inventory_products;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  PERFORM app.assert_inventory_manager(p_workspace_id);
  PERFORM app.lock_inventory_product(p_workspace_id, p_product_id);
  UPDATE public.inventory_products SET archived_at = COALESCE(archived_at, clock_timestamp()), active = false
  WHERE id = p_product_id AND workspace_id = p_workspace_id
  RETURNING * INTO v_product;
  RETURN jsonb_build_object('id', v_product.id, 'archived_at', v_product.archived_at);
END;
$$;

CREATE OR REPLACE FUNCTION app.reactivate_inventory_product(p_workspace_id uuid, p_product_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_product public.inventory_products;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  PERFORM app.assert_inventory_manager(p_workspace_id);
  PERFORM app.lock_inventory_product(p_workspace_id, p_product_id);
  UPDATE public.inventory_products SET archived_at = NULL, active = true
  WHERE id = p_product_id AND workspace_id = p_workspace_id
  RETURNING * INTO v_product;
  RETURN jsonb_build_object('id', v_product.id, 'archived_at', v_product.archived_at);
END;
$$;