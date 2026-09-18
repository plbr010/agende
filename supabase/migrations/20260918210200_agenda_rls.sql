-- Agenda RLS, grants and public RPC wrappers.
-- Appointments: authenticated só SELECT. Criar/editar/status só via RPC DEFINER.
-- Receptionist não escreve jornada; pode gerenciar bloqueios e appointments.

ALTER TABLE public.professional_working_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_time_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.professional_working_hours FORCE ROW LEVEL SECURITY;
ALTER TABLE public.professional_breaks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.professional_time_blocks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.appointments FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.professional_working_hours FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.professional_breaks FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.professional_time_blocks FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.appointments FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.professional_working_hours TO authenticated;
GRANT INSERT (
  workspace_id, professional_member_id, weekday, start_time, end_time, active
) ON public.professional_working_hours TO authenticated;
GRANT UPDATE (weekday, start_time, end_time, active) ON public.professional_working_hours TO authenticated;
GRANT DELETE ON public.professional_working_hours TO authenticated;

GRANT SELECT ON public.professional_breaks TO authenticated;
GRANT INSERT (
  workspace_id, professional_member_id, weekday, start_time, end_time, label, active
) ON public.professional_breaks TO authenticated;
GRANT UPDATE (weekday, start_time, end_time, label, active) ON public.professional_breaks TO authenticated;
GRANT DELETE ON public.professional_breaks TO authenticated;

GRANT SELECT ON public.professional_time_blocks TO authenticated;
GRANT INSERT (
  workspace_id, professional_member_id, starts_at, ends_at, reason
) ON public.professional_time_blocks TO authenticated;
GRANT UPDATE (starts_at, ends_at, reason) ON public.professional_time_blocks TO authenticated;
GRANT DELETE ON public.professional_time_blocks TO authenticated;

GRANT SELECT ON public.appointments TO authenticated;

CREATE POLICY professional_working_hours_select_member
  ON public.professional_working_hours
  FOR SELECT
  TO authenticated
  USING ((SELECT app.is_workspace_member(workspace_id)));

CREATE POLICY professional_working_hours_write_manager_or_own
  ON public.professional_working_hours
  FOR ALL
  TO authenticated
  USING (
    (SELECT app.has_workspace_role(
      workspace_id,
      VARIADIC ARRAY['owner'::public.member_role, 'admin'::public.member_role]
    ))
    OR (
      professional_member_id IN (
        SELECT m.id
        FROM public.workspace_members m
        WHERE m.user_id = (SELECT auth.uid())
          AND m.workspace_id = professional_working_hours.workspace_id
          AND m.status = 'active'
          AND m.role = 'professional'::public.member_role
      )
    )
  )
  WITH CHECK (
    (SELECT app.has_workspace_role(
      workspace_id,
      VARIADIC ARRAY['owner'::public.member_role, 'admin'::public.member_role]
    ))
    OR (
      professional_member_id IN (
        SELECT m.id
        FROM public.workspace_members m
        WHERE m.user_id = (SELECT auth.uid())
          AND m.workspace_id = professional_working_hours.workspace_id
          AND m.status = 'active'
          AND m.role = 'professional'::public.member_role
      )
    )
  );

CREATE POLICY professional_breaks_select_member
  ON public.professional_breaks
  FOR SELECT
  TO authenticated
  USING ((SELECT app.is_workspace_member(workspace_id)));

CREATE POLICY professional_breaks_write_manager_or_own
  ON public.professional_breaks
  FOR ALL
  TO authenticated
  USING (
    (SELECT app.has_workspace_role(
      workspace_id,
      VARIADIC ARRAY['owner'::public.member_role, 'admin'::public.member_role]
    ))
    OR (
      professional_member_id IN (
        SELECT m.id
        FROM public.workspace_members m
        WHERE m.user_id = (SELECT auth.uid())
          AND m.workspace_id = professional_breaks.workspace_id
          AND m.status = 'active'
          AND m.role = 'professional'::public.member_role
      )
    )
  )
  WITH CHECK (
    (SELECT app.has_workspace_role(
      workspace_id,
      VARIADIC ARRAY['owner'::public.member_role, 'admin'::public.member_role]
    ))
    OR (
      professional_member_id IN (
        SELECT m.id
        FROM public.workspace_members m
        WHERE m.user_id = (SELECT auth.uid())
          AND m.workspace_id = professional_breaks.workspace_id
          AND m.status = 'active'
          AND m.role = 'professional'::public.member_role
      )
    )
  );

CREATE POLICY professional_time_blocks_select_member
  ON public.professional_time_blocks
  FOR SELECT
  TO authenticated
  USING ((SELECT app.is_workspace_member(workspace_id)));

CREATE POLICY professional_time_blocks_write_staff_or_own
  ON public.professional_time_blocks
  FOR ALL
  TO authenticated
  USING (
    (SELECT app.has_workspace_role(
      workspace_id,
      VARIADIC ARRAY[
        'owner'::public.member_role,
        'admin'::public.member_role,
        'receptionist'::public.member_role
      ]
    ))
    OR (
      professional_member_id IN (
        SELECT m.id
        FROM public.workspace_members m
        WHERE m.user_id = (SELECT auth.uid())
          AND m.workspace_id = professional_time_blocks.workspace_id
          AND m.status = 'active'
          AND m.role = 'professional'::public.member_role
      )
    )
  )
  WITH CHECK (
    (SELECT app.has_workspace_role(
      workspace_id,
      VARIADIC ARRAY[
        'owner'::public.member_role,
        'admin'::public.member_role,
        'receptionist'::public.member_role
      ]
    ))
    OR (
      professional_member_id IN (
        SELECT m.id
        FROM public.workspace_members m
        WHERE m.user_id = (SELECT auth.uid())
          AND m.workspace_id = professional_time_blocks.workspace_id
          AND m.status = 'active'
          AND m.role = 'professional'::public.member_role
      )
    )
  );

CREATE POLICY appointments_select_staff
  ON public.appointments
  FOR SELECT
  TO authenticated
  USING (
    (SELECT app.has_workspace_role(
      workspace_id,
      VARIADIC ARRAY[
        'owner'::public.member_role,
        'admin'::public.member_role,
        'receptionist'::public.member_role
      ]
    ))
  );

CREATE POLICY appointments_select_own_professional
  ON public.appointments
  FOR SELECT
  TO authenticated
  USING (
    professional_member_id IN (
      SELECT m.id
      FROM public.workspace_members m
      WHERE m.user_id = (SELECT auth.uid())
        AND m.workspace_id = appointments.workspace_id
        AND m.status = 'active'
        AND m.role = 'professional'::public.member_role
    )
  );

CREATE OR REPLACE FUNCTION public.create_appointment(
  p_workspace_id uuid,
  p_client_id uuid,
  p_professional_member_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app.create_appointment(
    p_workspace_id,
    p_client_id,
    p_professional_member_id,
    p_service_id,
    p_starts_at,
    p_notes
  );
$$;

CREATE OR REPLACE FUNCTION public.reschedule_appointment(
  p_appointment_id uuid,
  p_professional_member_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app.reschedule_appointment(
    p_appointment_id,
    p_professional_member_id,
    p_service_id,
    p_starts_at,
    p_notes
  );
$$;

CREATE OR REPLACE FUNCTION public.set_appointment_status(
  p_appointment_id uuid,
  p_status public.appointment_status
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app.set_appointment_status(p_appointment_id, p_status);
$$;

CREATE OR REPLACE FUNCTION public.list_available_slots(
  p_workspace_id uuid,
  p_professional_member_id uuid,
  p_service_id uuid,
  p_local_date date
)
RETURNS TABLE (starts_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.starts_at
  FROM app.list_available_slots(
    p_workspace_id,
    p_professional_member_id,
    p_service_id,
    p_local_date
  ) s;
$$;

REVOKE ALL ON FUNCTION public.create_appointment(uuid, uuid, uuid, uuid, timestamptz, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reschedule_appointment(uuid, uuid, uuid, timestamptz, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_appointment_status(uuid, public.appointment_status) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_available_slots(uuid, uuid, uuid, date) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_appointment(uuid, uuid, uuid, uuid, timestamptz, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reschedule_appointment(uuid, uuid, uuid, timestamptz, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_appointment_status(uuid, public.appointment_status) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_available_slots(uuid, uuid, uuid, date) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION app.is_workspace_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app.has_workspace_role(uuid, public.member_role[]) TO authenticated;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO postgres, service_role;
REVOKE ALL ON FUNCTION app.product_timezone() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.time_to_minutes(time) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.lock_professional_agenda(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.actor_member(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.resolve_service_snapshot(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.assert_slot_available(uuid, uuid, timestamptz, timestamptz, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.can_manage_jornada(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.can_manage_time_blocks(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.can_write_appointment(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.assert_status_transition(public.appointment_status, public.appointment_status, public.member_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.range_subtract(tstzrange, tstzrange) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.list_available_slots(uuid, uuid, uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.create_appointment(uuid, uuid, uuid, uuid, timestamptz, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.reschedule_appointment(uuid, uuid, uuid, timestamptz, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.set_appointment_status(uuid, public.appointment_status) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.protect_working_hours_columns() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.protect_break_columns() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.protect_time_block_columns() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.protect_appointment_columns() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.appointments_assert_availability() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.time_blocks_reject_appointment_overlap() FROM PUBLIC, anon, authenticated;
