-- Public booking wrappers, grants, and RLS. app.* stays private.

CREATE OR REPLACE FUNCTION public.list_public_booking_catalog(p_slug text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app.list_public_booking_catalog(p_slug);
$$;

CREATE OR REPLACE FUNCTION public.list_public_available_slots(
  p_slug text,
  p_service_id uuid,
  p_professional_member_id uuid,
  p_local_date date
)
RETURNS TABLE (starts_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.starts_at
  FROM app.list_public_available_slots(
    p_slug,
    p_service_id,
    p_professional_member_id,
    p_local_date
  ) s;
$$;

CREATE OR REPLACE FUNCTION public.create_public_appointment(
  p_slug text,
  p_service_id uuid,
  p_professional_member_id uuid,
  p_starts_at timestamptz,
  p_full_name text,
  p_phone text,
  p_email text,
  p_customer_note text DEFAULT NULL,
  p_ip_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app.create_public_appointment(
    p_slug,
    p_service_id,
    p_professional_member_id,
    p_starts_at,
    p_full_name,
    p_phone,
    p_email,
    p_customer_note,
    p_ip_hash
  );
$$;

CREATE OR REPLACE FUNCTION public.list_my_appointments()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app.list_my_appointments();
$$;

CREATE OR REPLACE FUNCTION public.cancel_my_appointment(p_appointment_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app.cancel_my_appointment(p_appointment_id);
$$;

REVOKE ALL ON FUNCTION app.compute_available_slots(uuid, uuid, uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.resolve_public_workspace(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.assert_public_booking_window(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.assert_public_booking_rate(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.find_or_create_public_client(uuid, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.link_workspace_clients_by_confirmed_email() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.pick_professional_for_slot(uuid, uuid, timestamptz, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.list_public_booking_catalog(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.list_public_available_slots(text, uuid, uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.create_public_appointment(text, uuid, uuid, timestamptz, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.list_my_appointments() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.cancel_my_appointment(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION app.compute_available_slots(uuid, uuid, uuid, date) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION app.resolve_public_workspace(text) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION app.assert_public_booking_window(uuid, timestamptz) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION app.assert_public_booking_rate(uuid, text, text, text) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION app.find_or_create_public_client(uuid, text, text, text, uuid) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION app.link_workspace_clients_by_confirmed_email() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION app.pick_professional_for_slot(uuid, uuid, timestamptz, uuid) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION app.list_public_booking_catalog(text) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION app.list_public_available_slots(text, uuid, uuid, date) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION app.create_public_appointment(text, uuid, uuid, timestamptz, text, text, text, text, text) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION app.list_my_appointments() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION app.cancel_my_appointment(uuid) TO postgres, service_role;

REVOKE ALL ON FUNCTION public.list_public_booking_catalog(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_public_available_slots(text, uuid, uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_public_appointment(text, uuid, uuid, timestamptz, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_my_appointments() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_my_appointment(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.list_public_booking_catalog(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_public_available_slots(text, uuid, uuid, date) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_public_appointment(text, uuid, uuid, timestamptz, text, text, text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_my_appointments() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_my_appointment(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.list_my_appointments() FROM anon;
REVOKE ALL ON FUNCTION public.cancel_my_appointment(uuid) FROM anon;

COMMENT ON FUNCTION public.list_public_booking_catalog(text) IS
  'RPC pública intencional: catálogo de reserva sem auth. SECURITY DEFINER com search_path vazio; devolve só dados públicos do slug.';
COMMENT ON FUNCTION public.list_public_available_slots(text, uuid, uuid, date) IS
  'RPC pública intencional: slots disponíveis/indisponíveis, sem identidade de clientes. Recalcula no banco com timezone do workspace.';
COMMENT ON FUNCTION public.create_public_appointment(text, uuid, uuid, timestamptz, text, text, text, text, text) IS
  'RPC pública intencional para reserva de convidado. Não cria auth.users. Recalcula preço, duração, ends_at, workspace e conflitos. Rate limit + advisory lock + GiST.';
COMMENT ON FUNCTION public.list_my_appointments() IS
  'Lista appointments da cliente autenticada com e-mail confirmado, via linked_user_id. Sem GRANT para anon.';
COMMENT ON FUNCTION public.cancel_my_appointment(uuid) IS
  'Cancelamento da própria cliente autenticada até 2h antes. Sem GRANT para anon.';
