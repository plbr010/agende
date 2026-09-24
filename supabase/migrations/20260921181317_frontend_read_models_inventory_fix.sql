
create or replace function app.get_inventory_ui(p_workspace_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  perform app.assert_inventory_manager(p_workspace_id);

  return jsonb_build_object(
    'summary', (
      select jsonb_build_object(
        'products', count(*) filter(where active and archived_at is null),
        'low_stock', count(*) filter(where active and archived_at is null and quantity > 0 and quantity <= minimum_quantity),
        'out_of_stock', count(*) filter(where active and archived_at is null and quantity = 0),
        'estimated_cost_cents', coalesce(
          round(sum(quantity * cost_cents) filter(where active and archived_at is null and cost_cents is not null)),
          0
        )
      )
      from public.inventory_products
      where workspace_id=p_workspace_id
    ),
    'products', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',p.id,
          'name',p.name,
          'description',p.description,
          'sku',p.sku,
          'unit',p.unit,
          'quantity',p.quantity,
          'minimum_quantity',p.minimum_quantity,
          'cost_cents',p.cost_cents,
          'active',p.active,
          'archived_at',p.archived_at,
          'created_at',p.created_at
        )
        order by
          case when p.quantity=0 then 0 when p.quantity<=p.minimum_quantity then 1 else 2 end,
          p.name
      )
      from public.inventory_products p
      where p.workspace_id=p_workspace_id
    ),'[]'::jsonb),
    'recent_movements', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from (
        select
          m.id,m.product_id,p.name as product_name,m.type,m.quantity,
          m.quantity_before,m.quantity_after,m.reason,m.created_at
        from public.inventory_movements m
        join public.inventory_products p
          on p.id=m.product_id and p.workspace_id=m.workspace_id
        where m.workspace_id=p_workspace_id
        order by m.created_at desc
        limit 20
      ) x
    ),'[]'::jsonb)
  );
end;
$$;
