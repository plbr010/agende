
create or replace function app.get_workspace_advanced_report(
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
  v_total bigint;
  v_completed bigint;
  v_cancelled bigint;
  v_no_show bigint;
  v_service_value bigint;
begin
  perform app.assert_finance_manager(p_workspace_id);

  if p_start_date is null or p_end_date is null
     or p_end_date<p_start_date
     or p_end_date-p_start_date>366 then
    raise exception 'invalid_report_period' using errcode='22023';
  end if;

  v_tz:=app.workspace_timezone(p_workspace_id);
  v_start:=(p_start_date::timestamp at time zone v_tz);
  v_end:=((p_end_date+1)::timestamp at time zone v_tz);

  select
    count(*),
    count(*) filter(where status='completed'),
    count(*) filter(where status='cancelled'),
    count(*) filter(where status='no_show'),
    coalesce(sum(price_cents) filter(where status='completed'),0)
  into
    v_total,v_completed,v_cancelled,v_no_show,v_service_value
  from public.appointments
  where workspace_id=p_workspace_id
    and starts_at>=v_start
    and starts_at<v_end;

  return jsonb_build_object(
    'period',jsonb_build_object(
      'start_date',p_start_date,
      'end_date',p_end_date,
      'timezone',v_tz
    ),
    'operations',jsonb_build_object(
      'appointments_total',v_total,
      'completed',v_completed,
      'cancelled',v_cancelled,
      'no_show',v_no_show,
      'completion_rate_pct',
        case when v_total=0 then 0
             else round((v_completed::numeric/v_total::numeric)*100,2) end,
      'cancellation_rate_pct',
        case when v_total=0 then 0
             else round((v_cancelled::numeric/v_total::numeric)*100,2) end,
      'no_show_rate_pct',
        case when v_total=0 then 0
             else round((v_no_show::numeric/v_total::numeric)*100,2) end,
      'average_service_ticket_cents',
        case when v_completed=0 then 0
             else round(v_service_value::numeric/v_completed::numeric) end,
      'completed_service_value_cents',v_service_value
    ),
    'clients',jsonb_build_object(
      'unique_clients',
        (select count(distinct a.client_id)
         from public.appointments a
         where a.workspace_id=p_workspace_id
           and a.starts_at>=v_start
           and a.starts_at<v_end),
      'new_clients',
        (select count(*)
         from public.workspace_clients c
         where c.workspace_id=p_workspace_id
           and c.created_at>=v_start
           and c.created_at<v_end),
      'repeat_clients',
        (select count(*)
         from (
           select a.client_id
           from public.appointments a
           where a.workspace_id=p_workspace_id
             and a.starts_at>=v_start
             and a.starts_at<v_end
             and a.status='completed'
           group by a.client_id
           having count(*)>=2
         ) r)
    ),
    'top_professionals',
      coalesce((
        select jsonb_agg(to_jsonb(x) order by x.completed_count desc,x.service_value_cents desc)
        from (
          select
            a.professional_member_id,
            coalesce(p.display_name,'Profissional') as professional_name,
            count(*)::int as completed_count,
            coalesce(sum(a.price_cents),0)::bigint as service_value_cents
          from public.appointments a
          left join public.professional_profiles p
            on p.member_id=a.professional_member_id
           and p.workspace_id=a.workspace_id
          where a.workspace_id=p_workspace_id
            and a.starts_at>=v_start
            and a.starts_at<v_end
            and a.status='completed'
          group by a.professional_member_id,p.display_name
          order by completed_count desc,service_value_cents desc
          limit 10
        ) x
      ),'[]'::jsonb),
    'finance_by_category',
      coalesce((
        select jsonb_agg(to_jsonb(x) order by x.entry_type,x.net_cents desc,x.category_name)
        from (
          select
            f.entry_type,
            coalesce(c.name,'Sem categoria') as category_name,
            sum(f.amount_cents) filter(where f.status='paid')::bigint as paid_cents,
            sum(f.amount_cents) filter(where f.status='pending')::bigint as pending_cents,
            coalesce(sum(r.refunded_cents),0)::bigint as refunded_cents,
            (
              coalesce(sum(f.amount_cents) filter(where f.status='paid'),0)
              - case
                  when f.entry_type='income' then coalesce(sum(r.refunded_cents),0)
                  else 0
                end
            )::bigint as net_cents
          from public.financial_entries f
          left join public.financial_categories c
            on c.id=f.category_id
           and c.workspace_id=f.workspace_id
          left join lateral (
            select coalesce(sum(fr.amount_cents),0)::bigint as refunded_cents
            from public.financial_refunds fr
            where fr.financial_entry_id=f.id
              and fr.workspace_id=f.workspace_id
              and fr.refunded_at>=v_start
              and fr.refunded_at<v_end
          ) r on true
          where f.workspace_id=p_workspace_id
            and f.created_at>=v_start
            and f.created_at<v_end
          group by f.entry_type,c.name
        ) x
      ),'[]'::jsonb),
    'payment_methods',
      coalesce((
        select jsonb_agg(to_jsonb(x) order by x.total_cents desc)
        from (
          select
            f.payment_method,
            count(*)::int as payments,
            sum(f.amount_cents)::bigint as total_cents
          from public.financial_entries f
          where f.workspace_id=p_workspace_id
            and f.status='paid'
            and f.entry_type='income'
            and f.paid_at>=v_start
            and f.paid_at<v_end
          group by f.payment_method
        ) x
      ),'[]'::jsonb),
    'packages',jsonb_build_object(
      'sold',
        (select count(*)
         from public.client_packages cp
         where cp.workspace_id=p_workspace_id
           and cp.purchased_at>=v_start
           and cp.purchased_at<v_end),
      'redemptions',
        (select count(*)
         from public.package_redemptions pr
         where pr.workspace_id=p_workspace_id
           and pr.created_at>=v_start
           and pr.created_at<v_end
           and pr.reversed_at is null),
      'reversed_redemptions',
        (select count(*)
         from public.package_redemptions pr
         where pr.workspace_id=p_workspace_id
           and pr.reversed_at>=v_start
           and pr.reversed_at<v_end)
    ),
    'inventory',jsonb_build_object(
      'active_products',
        (select count(*)
         from public.inventory_products i
         where i.workspace_id=p_workspace_id
           and i.active and i.archived_at is null),
      'low_stock',
        (select count(*)
         from public.inventory_products i
         where i.workspace_id=p_workspace_id
           and i.active and i.archived_at is null
           and i.quantity>0 and i.quantity<=i.minimum_quantity),
      'out_of_stock',
        (select count(*)
         from public.inventory_products i
         where i.workspace_id=p_workspace_id
           and i.active and i.archived_at is null
           and i.quantity=0),
      'estimated_stock_cost_cents',
        (select coalesce(round(sum(i.quantity*i.cost_cents)),0)
         from public.inventory_products i
         where i.workspace_id=p_workspace_id
           and i.active and i.archived_at is null
           and i.cost_cents is not null)
    )
  );
end;
$$;

create or replace function public.get_workspace_advanced_report(
  p_workspace_id uuid,
  p_start_date date,
  p_end_date date
)
returns jsonb
language sql
security definer
set search_path=''
as $$
  select app.get_workspace_advanced_report(
    p_workspace_id,p_start_date,p_end_date
  );
$$;

revoke all on function app.get_workspace_advanced_report(uuid,date,date)
  from public,anon,authenticated;
revoke all on function public.get_workspace_advanced_report(uuid,date,date)
  from public,anon;
grant execute on function public.get_workspace_advanced_report(uuid,date,date)
  to authenticated;
