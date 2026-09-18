-- Check professional belongs to the workspace before the service link,
-- so cross-tenant IDs fail with professional_not_found instead of
-- professional_service_inactive. Merge appointment SELECT policies to a
-- single permissive policy (staff OR own professional).

CREATE OR REPLACE FUNCTION app.resolve_service_snapshot(
  p_workspace_id uuid,
  p_professional_member_id uuid,
  p_service_id uuid
)
RETURNS TABLE (price_cents integer, duration_minutes integer)
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_service public.services%ROWTYPE;
  v_link public.professional_services%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.professional_profiles p
    WHERE p.member_id = p_professional_member_id
      AND p.workspace_id = p_workspace_id
  ) THEN
    RAISE EXCEPTION 'professional_not_found' USING ERRCODE = '22023';
  END IF;

  SELECT s.* INTO v_service
  FROM public.services s
  WHERE s.id = p_service_id
    AND s.workspace_id = p_workspace_id;

  IF v_service.id IS NULL THEN
    RAISE EXCEPTION 'service_not_found' USING ERRCODE = '22023';
  END IF;

  IF v_service.archived_at IS NOT NULL OR v_service.active IS NOT TRUE THEN
    RAISE EXCEPTION 'service_inactive' USING ERRCODE = '22023';
  END IF;

  SELECT ps.* INTO v_link
  FROM public.professional_services ps
  WHERE ps.workspace_id = p_workspace_id
    AND ps.professional_member_id = p_professional_member_id
    AND ps.service_id = p_service_id
    AND ps.active;

  IF v_link.id IS NULL THEN
    RAISE EXCEPTION 'professional_service_inactive' USING ERRCODE = '22023';
  END IF;

  price_cents := COALESCE(v_link.price_override_cents, v_service.price_cents);
  duration_minutes := COALESCE(v_link.duration_override_minutes, v_service.duration_minutes);
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION app.resolve_service_snapshot(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app.resolve_service_snapshot(uuid, uuid, uuid) TO postgres, service_role;

DROP POLICY IF EXISTS appointments_select_staff ON public.appointments;
DROP POLICY IF EXISTS appointments_select_own_professional ON public.appointments;

CREATE POLICY appointments_select_staff_or_own
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
    OR (
      professional_member_id IN (
        SELECT m.id
        FROM public.workspace_members m
        WHERE m.user_id = (SELECT auth.uid())
          AND m.workspace_id = appointments.workspace_id
          AND m.status = 'active'
          AND m.role = 'professional'::public.member_role
      )
    )
  );
