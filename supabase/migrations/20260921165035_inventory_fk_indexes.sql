create index if not exists inventory_products_created_by_idx
  on public.inventory_products (created_by);

create index if not exists inventory_movements_created_by_idx
  on public.inventory_movements (created_by);

create index if not exists inventory_movements_product_workspace_idx
  on public.inventory_movements (product_id, workspace_id);