-- Inventory products and movements. Isolated from agenda, timezone and owner modules.
--
-- Quantity on inventory_movements is the absolute amount moved (never negative).
-- Signed change is quantity_after - quantity_before.
--   entry:      after = before + quantity
--   exit:       after = before - quantity
--   adjustment: after = counted stock; quantity = abs(after - before)

CREATE TYPE public.inventory_unit AS ENUM ('unidade', 'ml', 'g');
CREATE TYPE public.inventory_movement_type AS ENUM ('entry', 'exit', 'adjustment');

CREATE TABLE public.inventory_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sku text,
  unit public.inventory_unit NOT NULL DEFAULT 'unidade',
  quantity numeric(12, 3) NOT NULL DEFAULT 0,
  minimum_quantity numeric(12, 3) NOT NULL DEFAULT 0,
  cost_cents integer,
  active boolean NOT NULL DEFAULT true,
  archived_at timestamptz,
  created_by uuid REFERENCES public.profiles (user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_products_name_len CHECK (char_length(btrim(name)) BETWEEN 2 AND 80),
  CONSTRAINT inventory_products_description_len CHECK (
    description IS NULL OR char_length(description) <= 500
  ),
  CONSTRAINT inventory_products_sku_len CHECK (
    sku IS NULL OR char_length(sku) BETWEEN 1 AND 40
  ),
  CONSTRAINT inventory_products_sku_format CHECK (
    sku IS NULL OR sku ~ '^[A-Za-z0-9][A-Za-z0-9._-]*$'
  ),
  CONSTRAINT inventory_products_quantity_non_negative CHECK (quantity >= 0),
  CONSTRAINT inventory_products_minimum_non_negative CHECK (minimum_quantity >= 0),
  CONSTRAINT inventory_products_cost_non_negative CHECK (
    cost_cents IS NULL OR (cost_cents >= 0 AND cost_cents <= 10000000)
  ),
  CONSTRAINT inventory_products_archived_inactive CHECK (
    archived_at IS NULL OR active = false
  ),
  CONSTRAINT inventory_products_id_workspace_key UNIQUE (id, workspace_id)
);

CREATE INDEX inventory_products_workspace_id_idx ON public.inventory_products (workspace_id);
CREATE INDEX inventory_products_workspace_active_idx ON public.inventory_products (workspace_id) WHERE archived_at IS NULL AND active;
CREATE INDEX inventory_products_workspace_archived_idx ON public.inventory_products (workspace_id) WHERE archived_at IS NOT NULL;
CREATE UNIQUE INDEX inventory_products_workspace_sku_lower_idx ON public.inventory_products (workspace_id, lower(sku)) WHERE sku IS NOT NULL;
CREATE INDEX inventory_products_workspace_below_min_idx ON public.inventory_products (workspace_id) WHERE archived_at IS NULL AND quantity < minimum_quantity;
CREATE INDEX inventory_products_workspace_empty_idx ON public.inventory_products (workspace_id) WHERE archived_at IS NULL AND quantity = 0;

CREATE TABLE public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  type public.inventory_movement_type NOT NULL,
  quantity numeric(12, 3) NOT NULL,
  quantity_before numeric(12, 3) NOT NULL,
  quantity_after numeric(12, 3) NOT NULL,
  reason text,
  created_by uuid REFERENCES public.profiles (user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_movements_quantity_non_negative CHECK (quantity >= 0),
  CONSTRAINT inventory_movements_before_non_negative CHECK (quantity_before >= 0),
  CONSTRAINT inventory_movements_after_non_negative CHECK (quantity_after >= 0),
  CONSTRAINT inventory_movements_reason_len CHECK (reason IS NULL OR char_length(reason) <= 200),
  CONSTRAINT inventory_movements_entry_math CHECK (type <> 'entry' OR quantity_after = quantity_before + quantity),
  CONSTRAINT inventory_movements_exit_math CHECK (type <> 'exit' OR quantity_after = quantity_before - quantity),
  CONSTRAINT inventory_movements_adjustment_math CHECK (type <> 'adjustment' OR quantity = abs(quantity_after - quantity_before)),
  CONSTRAINT inventory_movements_product_workspace_fk FOREIGN KEY (product_id, workspace_id) REFERENCES public.inventory_products (id, workspace_id) ON DELETE CASCADE
);

CREATE INDEX inventory_movements_workspace_id_idx ON public.inventory_movements (workspace_id);
CREATE INDEX inventory_movements_product_created_idx ON public.inventory_movements (product_id, created_at DESC);
CREATE INDEX inventory_movements_workspace_created_idx ON public.inventory_movements (workspace_id, created_at DESC);

CREATE OR REPLACE FUNCTION app.protect_inventory_product_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN
      RAISE EXCEPTION 'inventory_product_identity_immutable' USING ERRCODE = '42501';
    END IF;
    IF NEW.quantity IS DISTINCT FROM OLD.quantity AND current_setting('app.inventory_mutating', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'inventory_quantity_direct_update_denied' USING ERRCODE = '42501';
    END IF;
  END IF;
  NEW.name := btrim(NEW.name);
  NEW.description := nullif(btrim(COALESCE(NEW.description, '')), '');
  NEW.sku := nullif(btrim(COALESCE(NEW.sku, '')), '');
  RETURN NEW;
END;
$$;

CREATE TRIGGER inventory_products_protect_columns
  BEFORE INSERT OR UPDATE ON public.inventory_products
  FOR EACH ROW
  EXECUTE FUNCTION app.protect_inventory_product_columns();

CREATE OR REPLACE FUNCTION app.touch_inventory_product_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER inventory_products_set_updated_at
  BEFORE UPDATE ON public.inventory_products
  FOR EACH ROW
  EXECUTE FUNCTION app.touch_inventory_product_updated_at();

CREATE OR REPLACE FUNCTION app.forbid_inventory_movement_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'inventory_movement_immutable' USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER inventory_movements_forbid_update
  BEFORE UPDATE OR DELETE ON public.inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION app.forbid_inventory_movement_mutation();

CREATE OR REPLACE FUNCTION app.is_reserved_workspace_slug(p_slug text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT p_slug IN (
    'app', 'api', 'auth', 'login', 'cadastro', 'cliente', 'onboarding',
    'admin', 'www', 'static', 'assets', 'termos', 'privacidade',
    'verificar-email', 'agende', 'suporte', 'billing', 'faturamento',
    'p', 'convite', 'configuracoes', 'equipe', 'servicos', 'clientes',
    'assinatura', 'perfil', 'estoque'
  );
$$;