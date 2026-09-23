
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
        'estimated_cost_cents', coalesce(round(sum(quantity * cost_cents)) filter(where active and archived_at is null and cost_cents is not null),0)
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

create or replace function public.get_inventory_ui(p_workspace_id uuid)
returns jsonb
language sql
security definer
set search_path=''
as $$
  select app.get_inventory_ui(p_workspace_id);
$$;

create or replace function app.get_packages_ui(p_workspace_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  perform app.assert_package_manager(p_workspace_id);

  return jsonb_build_object(
    'catalog', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',p.id,
          'name',p.name,
          'description',p.description,
          'price_cents',p.price_cents,
          'validity_days',p.validity_days,
          'active',p.active,
          'archived_at',p.archived_at,
          'items',coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'service_id',i.service_id,
                'service_name',s.name,
                'quantity',i.quantity
              ) order by s.name
            )
            from public.service_package_items i
            join public.services s
              on s.id=i.service_id and s.workspace_id=i.workspace_id
            where i.package_id=p.id and i.workspace_id=p.workspace_id
          ),'[]'::jsonb)
        )
        order by p.archived_at nulls first,p.active desc,p.name
      )
      from public.service_packages p
      where p.workspace_id=p_workspace_id
    ),'[]'::jsonb),
    'sales',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.purchased_at desc)
      from (
        select
          cp.id,cp.client_id,c.full_name as client_name,
          cp.package_id,cp.package_name_snapshot,cp.price_cents,
          cp.purchased_at,cp.expires_at,cp.status,
          coalesce(sum(i.included_quantity),0)::int as included_total,
          coalesce(sum(i.used_quantity),0)::int as used_total
        from public.client_packages cp
        join public.workspace_clients c
          on c.id=cp.client_id and c.workspace_id=cp.workspace_id
        left join public.client_package_items i
          on i.client_package_id=cp.id and i.workspace_id=cp.workspace_id
        where cp.workspace_id=p_workspace_id
        group by cp.id,c.full_name
        order by cp.purchased_at desc
        limit 30
      ) x
    ),'[]'::jsonb)
  );
end;
$$;

create or replace function public.get_packages_ui(p_workspace_id uuid)
returns jsonb
language sql
security definer
set search_path=''
as $$
  select app.get_packages_ui(p_workspace_id);
$$;

create or replace function app.get_finance_ui(
  p_workspace_id uuid,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_tz text;
  v_start timestamptz;
  v_end timestamptz;
begin
  perform app.assert_finance_manager(p_workspace_id);

  if p_start_date is null or p_end_date is null or p_end_date<p_start_date or p_end_date-p_start_date>366 then
    raise exception 'invalid_report_period' using errcode='22023';
  end if;

  v_tz:=app.workspace_timezone(p_workspace_id);
  v_start:=(p_start_date::timestamp at time zone v_tz);
  v_end:=((p_end_date+1)::timestamp at time zone v_tz);

  return jsonb_build_object(
    'report',app.get_workspace_advanced_report(p_workspace_id,p_start_date,p_end_date),
    'entries',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from (
        select
          f.id,f.entry_type,f.status,f.source,f.description,f.amount_cents,
          f.due_date,f.paid_at,f.payment_method,f.created_at,
          c.name as category_name,
          wc.full_name as client_name,
          coalesce((
            select sum(r.amount_cents)
            from public.financial_refunds r
            where r.financial_entry_id=f.id and r.workspace_id=f.workspace_id
          ),0)::bigint as refunded_cents
        from public.financial_entries f
        left join public.financial_categories c
          on c.id=f.category_id and c.workspace_id=f.workspace_id
        left join public.workspace_clients wc
          on wc.id=f.client_id and wc.workspace_id=f.workspace_id
        where f.workspace_id=p_workspace_id
          and f.created_at>=v_start and f.created_at<v_end
        order by f.created_at desc
        limit 100
      ) x
    ),'[]'::jsonb),
    'categories',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',c.id,'name',c.name,'entry_type',c.entry_type,
          'system_key',c.system_key,'active',c.active,'archived_at',c.archived_at
        )
        order by c.entry_type,c.name
      )
      from public.financial_categories c
      where c.workspace_id=p_workspace_id
    ),'[]'::jsonb)
  );
end;
$$;

create or replace function public.get_finance_ui(
  p_workspace_id uuid,
  p_start_date date,
  p_end_date date
)
returns jsonb
language sql
security definer
set search_path=''
as $$
  select app.get_finance_ui(p_workspace_id,p_start_date,p_end_date);
$$;

revoke all on function app.get_inventory_ui(uuid) from public,anon,authenticated;
revoke all on function public.get_inventory_ui(uuid) from public,anon;
grant execute on function public.get_inventory_ui(uuid) to authenticated;

revoke all on function app.get_packages_ui(uuid) from public,anon,authenticated;
revoke all on function public.get_packages_ui(uuid) from public,anon;
grant execute on function public.get_packages_ui(uuid) to authenticated;

revoke all on function app.get_finance_ui(uuid,date,date) from public,anon,authenticated;
revoke all on function public.get_finance_ui(uuid,date,date) from public,anon;
grant execute on function public.get_finance_ui(uuid,date,date) to authenticated;
