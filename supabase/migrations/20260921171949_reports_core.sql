
create or replace function app.get_workspace_report(
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
  v_result jsonb;
begin
  perform app.assert_finance_manager(p_workspace_id);

  if p_start_date is null or p_end_date is null
     or p_end_date < p_start_date
     or p_end_date - p_start_date > 366 then
    raise exception 'invalid_report_period' using errcode='22023';
  end if;

  v_tz := app.workspace_timezone(p_workspace_id);
  v_start := (p_start_date::timestamp at time zone v_tz);
  v_end := ((p_end_date + 1)::timestamp at time zone v_tz);

  select jsonb_build_object(
    'period', jsonb_build_object(
      'start_date',p_start_date,
      'end_date',p_end_date,
      'timezone',v_tz
    ),
    'finance', jsonb_build_object(
      'paid_income_cents', coalesce(sum(amount_cents) filter(where entry_type='income' and status='paid'),0),
      'pending_income_cents', coalesce(sum(amount_cents) filter(where entry_type='income' and status='pending'),0),
      'paid_expense_cents', coalesce(sum(amount_cents) filter(where entry_type='expense' and status='paid'),0),
      'pending_expense_cents', coalesce(sum(amount_cents) filter(where entry_type='expense' and status='pending'),0),
      'net_paid_cents',
        coalesce(sum(amount_cents) filter(where entry_type='income' and status='paid'),0)
        - coalesce(sum(amount_cents) filter(where entry_type='expense' and status='paid'),0)
    )
  ) into v_result
  from public.financial_entries f
  where f.workspace_id=p_workspace_id
    and f.created_at>=v_start and f.created_at<v_end;

  v_result := v_result || jsonb_build_object(
    'appointments', (
      select jsonb_build_object(
        'total',count(*),
        'scheduled',count(*) filter(where status='scheduled'),
        'confirmed',count(*) filter(where status='confirmed'),
        'in_progress',count(*) filter(where status='in_progress'),
        'completed',count(*) filter(where status='completed'),
        'cancelled',count(*) filter(where status='cancelled'),
        'no_show',count(*) filter(where status='no_show')
      )
      from public.appointments a
      where a.workspace_id=p_workspace_id and a.starts_at>=v_start and a.starts_at<v_end
    ),
    'clients', (
      select jsonb_build_object('new_clients',count(*))
      from public.workspace_clients c
      where c.workspace_id=p_workspace_id and c.created_at>=v_start and c.created_at<v_end
    ),
    'packages', (
      select jsonb_build_object(
        'sold',count(*),
        'gross_sales_cents',coalesce(sum(price_cents),0),
        'active_now',count(*) filter(
          where status='active' and (expires_at is null or expires_at>now())
        ),
        'exhausted',count(*) filter(where status='exhausted'),
        'cancelled',count(*) filter(where status='cancelled')
      )
      from public.client_packages cp
      where cp.workspace_id=p_workspace_id and cp.purchased_at>=v_start and cp.purchased_at<v_end
    ),
    'inventory', (
      select jsonb_build_object(
        'active_products',count(*) filter(where archived_at is null and active),
        'low_stock',count(*) filter(
          where archived_at is null and active and quantity>0 and quantity<=minimum_quantity
        ),
        'out_of_stock',count(*) filter(
          where archived_at is null and active and quantity=0
        )
      )
      from public.inventory_products ip
      where ip.workspace_id=p_workspace_id
    ),
    'top_services', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.completed_count desc,x.revenue_cents desc)
      from (
        select
          a.service_id,
          coalesce(s.name,'Serviço') as service_name,
          count(*)::int as completed_count,
          coalesce(sum(a.price_cents),0)::bigint as revenue_cents
        from public.appointments a
        left join public.services s
          on s.id=a.service_id and s.workspace_id=a.workspace_id
        where a.workspace_id=p_workspace_id
          and a.starts_at>=v_start and a.starts_at<v_end
          and a.status='completed'
        group by a.service_id,s.name
        order by completed_count desc,revenue_cents desc
        limit 5
      ) x
    ),'[]'::jsonb)
  );

  return v_result;
end;
$$;

create or replace function public.get_workspace_report(
  p_workspace_id uuid,p_start_date date,p_end_date date
)
returns jsonb language sql security definer set search_path='' as $$
select app.get_workspace_report(p_workspace_id,p_start_date,p_end_date);
$$;

revoke all on function app.get_workspace_report(uuid,date,date) from public,anon,authenticated;
revoke all on function public.get_workspace_report(uuid,date,date) from public,anon;
grant execute on function public.get_workspace_report(uuid,date,date) to authenticated;
