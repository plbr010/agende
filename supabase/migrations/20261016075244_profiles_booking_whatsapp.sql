-- Additive migration. No production execution authorized.
-- Confirmed identity is required even through privileged wrappers.
CREATE OR REPLACE FUNCTION app.create_public_appointment(
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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ws uuid;
  v_pro uuid;
  v_client uuid;
  v_snapshot record;
  v_ends timestamptz;
  v_note text;
  v_id uuid;
  v_uid uuid := app.require_confirmed_email();
  v_email text := nullif(lower(btrim(COALESCE(p_email, ''))), '');
  v_phone text;
  v_confirmed boolean := false;
  v_ws_name text;
  v_slug text;
  v_service_name text;
  v_pro_name text;
  v_phone_biz text;
  v_tz text;
BEGIN
  SELECT lower(email) INTO v_email FROM auth.users WHERE id=v_uid;
  v_ws := app.resolve_public_workspace(p_slug);
  v_tz := app.workspace_timezone(v_ws);
  v_phone := app.normalize_phone(p_phone);
  IF v_phone IS NULL THEN
    RAISE EXCEPTION 'invalid_phone' USING ERRCODE = '22023';
  END IF;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'invalid_email' USING ERRCODE = '22023';
  END IF;

  IF v_uid IS NOT NULL THEN
    SELECT u.email_confirmed_at IS NOT NULL INTO v_confirmed
    FROM auth.users u WHERE u.id = v_uid;
    IF NOT COALESCE(v_confirmed, false) THEN
      v_uid := NULL;
    END IF;
  END IF;

  PERFORM app.assert_public_booking_rate(v_ws, v_email, v_phone, nullif(btrim(COALESCE(p_ip_hash, '')), ''));
  PERFORM app.assert_public_booking_window(v_ws, p_starts_at);

  v_pro := app.pick_professional_for_slot(v_ws, p_service_id, p_starts_at, p_professional_member_id);

  SELECT s.price_cents, s.duration_minutes
    INTO v_snapshot
  FROM app.resolve_service_snapshot(v_ws, v_pro, p_service_id) s;

  v_ends := p_starts_at + make_interval(mins => v_snapshot.duration_minutes);
  v_note := nullif(btrim(COALESCE(p_customer_note, '')), '');
  IF v_note IS NOT NULL AND char_length(v_note) > 500 THEN
    RAISE EXCEPTION 'customer_note_too_long' USING ERRCODE = '22023';
  END IF;

  v_client := app.find_or_create_public_client(
    v_ws,
    p_full_name,
    v_email,
    v_phone,
    v_uid
  );

  PERFORM app.lock_professional_agenda(v_pro);

  BEGIN
    PERFORM app.assert_slot_available(v_ws, v_pro, p_starts_at, v_ends, NULL);
  EXCEPTION
    WHEN SQLSTATE '23P01' THEN
      RAISE EXCEPTION 'slot_taken' USING ERRCODE = '23P01';
  END;

  BEGIN
    INSERT INTO public.appointments (
      workspace_id,
      client_id,
      professional_member_id,
      service_id,
      starts_at,
      ends_at,
      status,
      price_cents,
      duration_minutes,
      customer_note,
      created_by
    ) VALUES (
      v_ws,
      v_client,
      v_pro,
      p_service_id,
      p_starts_at,
      v_ends,
      'scheduled'::public.appointment_status,
      v_snapshot.price_cents,
      v_snapshot.duration_minutes,
      v_note,
      v_uid
    )
    RETURNING id INTO v_id;
  EXCEPTION
    WHEN exclusion_violation OR SQLSTATE '23P01' THEN
      RAISE EXCEPTION 'slot_taken' USING ERRCODE = '23P01';
  END;

  INSERT INTO public.public_booking_rate_events (workspace_id, email, phone, ip_hash)
  VALUES (v_ws, v_email, v_phone, nullif(btrim(COALESCE(p_ip_hash, '')), ''));

  SELECT w.name, w.slug INTO v_ws_name, v_slug FROM public.workspaces w WHERE w.id = v_ws;
  SELECT s.name INTO v_service_name FROM public.services s WHERE s.id = p_service_id;
  SELECT p.display_name INTO v_pro_name FROM public.professional_profiles p WHERE p.member_id = v_pro;
  SELECT st.business_phone INTO v_phone_biz FROM public.workspace_settings st WHERE st.workspace_id = v_ws;

  RETURN jsonb_build_object(
    'appointment_id', v_id,
    'workspace_name', v_ws_name,
    'slug', v_slug,
    'service_name', v_service_name,
    'professional_name', v_pro_name,
    'starts_at', p_starts_at,
    'ends_at', v_ends,
    'duration_minutes', v_snapshot.duration_minutes,
    'price_cents', v_snapshot.price_cents,
    'timezone', v_tz,
    'status', 'scheduled',
    'business_phone', v_phone_biz,
    'guest', v_uid IS NULL
  );
END;
$$;
REVOKE ALL ON FUNCTION public.create_public_appointment(text,uuid,uuid,timestamptz,text,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_public_appointment(text,uuid,uuid,timestamptz,text,text,text,text,text) TO authenticated;
COMMENT ON FUNCTION public.create_public_appointment(text,uuid,uuid,timestamptz,text,text,text,text,text) IS 'Authenticated client booking; verified email from Auth, atomic availability and authoritative pricing.';

-- Private bytes; only the normalizing server writes. Public reads are mediated
-- by the route and restricted to currently bookable professionals.
ALTER TABLE public.professional_profiles ADD COLUMN photo_path text
  CHECK(photo_path IS NULL OR photo_path ~ ('^'||workspace_id::text||'/professionals/'||member_id::text||'/[0-9a-f-]{36}[.]webp$'));
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('professional-photos','professional-photos',false,2097152,ARRAY['image/webp']);
CREATE POLICY professional_photos_server_only ON storage.objects AS RESTRICTIVE
FOR ALL TO anon,authenticated USING(bucket_id<>'professional-photos') WITH CHECK(bucket_id<>'professional-photos');
CREATE TABLE app.professional_photo_cleanup(
  path text PRIMARY KEY, member_id uuid NOT NULL REFERENCES public.professional_profiles(member_id),
  available_at timestamptz NOT NULL DEFAULT now()+interval '1 hour', claimed boolean NOT NULL DEFAULT false
);
ALTER TABLE app.professional_photo_cleanup ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.professional_photo_cleanup FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app.professional_photo_cleanup FROM PUBLIC,anon,authenticated;
GRANT ALL ON app.professional_photo_cleanup TO service_role;
CREATE INDEX professional_photo_cleanup_member ON app.professional_photo_cleanup(member_id,available_at);

CREATE FUNCTION app.require_professional_photo_editor(p_member_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=app.require_confirmed_email(); v_member public.workspace_members;
BEGIN
 SELECT * INTO v_member FROM public.workspace_members WHERE id=p_member_id AND status='active';
 IF NOT FOUND OR NOT (app.has_workspace_role(v_member.workspace_id,VARIADIC ARRAY['owner','admin']::public.member_role[])
 OR (v_member.user_id=v_uid AND v_member.role IN ('owner','admin','professional'))) THEN
 RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
 RETURN v_member.workspace_id;
END $$;
REVOKE ALL ON FUNCTION app.require_professional_photo_editor(uuid) FROM PUBLIC,anon,authenticated;

-- Service-only mutations: paths are never accepted as profile updates by users.
CREATE FUNCTION public.queue_professional_photo(p_actor_id uuid,p_member_id uuid,p_path text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_workspace uuid;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',p_actor_id::text,true);
 v_workspace:=app.require_professional_photo_editor(p_member_id);
 IF p_path IS NULL OR p_path !~ ('^'||v_workspace::text||'/professionals/'||p_member_id::text||'/[0-9a-f-]{36}[.]webp$') THEN
 RAISE EXCEPTION 'invalid_image_path'; END IF;
 INSERT INTO app.professional_photo_cleanup(path,member_id) VALUES(p_path,p_member_id);
END $$;
CREATE FUNCTION public.swap_professional_photo(p_actor_id uuid,p_member_id uuid,p_expected_path text,p_new_path text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_workspace uuid; v_old text; v_lease app.professional_photo_cleanup;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',p_actor_id::text,true);
 v_workspace:=app.require_professional_photo_editor(p_member_id);
 SELECT photo_path INTO STRICT v_old FROM public.professional_profiles WHERE member_id=p_member_id FOR UPDATE;
 IF v_old IS DISTINCT FROM p_expected_path THEN RETURN false; END IF;
 IF p_new_path IS NOT NULL THEN
 SELECT * INTO v_lease FROM app.professional_photo_cleanup WHERE path=p_new_path AND member_id=p_member_id FOR UPDATE;
 IF NOT FOUND OR v_lease.claimed OR v_lease.available_at<=now() OR
 NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='professional-photos' AND name=p_new_path) THEN
 RAISE EXCEPTION 'invalid_image_path'; END IF;
 END IF;
 UPDATE public.professional_profiles SET photo_path=p_new_path WHERE member_id=p_member_id;
 DELETE FROM app.professional_photo_cleanup WHERE path=p_new_path;
 IF v_old IS NOT NULL AND v_old IS DISTINCT FROM p_new_path THEN
 INSERT INTO app.professional_photo_cleanup(path,member_id,available_at) VALUES(v_old,p_member_id,now())
 ON CONFLICT(path) DO UPDATE SET available_at=now(),claimed=false; END IF;
 RETURN true;
END $$;
CREATE FUNCTION public.claim_professional_photo_cleanup(p_member_id uuid) RETURNS SETOF text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM 1 FROM public.professional_profiles WHERE member_id=p_member_id FOR UPDATE;
 RETURN QUERY UPDATE app.professional_photo_cleanup q SET claimed=true
 WHERE q.member_id=p_member_id AND q.available_at<=now()
 AND NOT EXISTS(SELECT 1 FROM public.professional_profiles p WHERE p.photo_path=q.path) RETURNING q.path;
END $$;
CREATE FUNCTION public.finish_professional_photo_cleanup(p_path text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 DELETE FROM app.professional_photo_cleanup WHERE path=p_path AND claimed;
$$;
REVOKE ALL ON FUNCTION public.queue_professional_photo(uuid,uuid,text),public.swap_professional_photo(uuid,uuid,text,text),
public.claim_professional_photo_cleanup(uuid),public.finish_professional_photo_cleanup(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.queue_professional_photo(uuid,uuid,text),public.swap_professional_photo(uuid,uuid,text,text),
public.claim_professional_photo_cleanup(uuid),public.finish_professional_photo_cleanup(text) TO service_role;

-- Returned only to server routes via the request user's RLS. No private profile
-- grants are broadened and no global client directory is introduced.
CREATE FUNCTION public.get_related_client_avatar(p_client_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=app.require_confirmed_email(); v_path text;
BEGIN
 SELECT p.avatar_path INTO v_path FROM public.workspace_clients c
 JOIN public.profiles p ON p.user_id=c.linked_user_id
 WHERE c.id=p_client_id AND c.archived_at IS NULL AND EXISTS(
 SELECT 1 FROM public.appointments a WHERE a.workspace_id=c.workspace_id AND a.client_id=c.id
 AND app.can_write_appointment(a.workspace_id,a.professional_member_id));
 RETURN v_path;
END $$;
REVOKE ALL ON FUNCTION public.get_related_client_avatar(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_related_client_avatar(uuid) TO authenticated;

-- Always read current appointment, client and timezone; client cannot supply
-- contact details, status, tenant or message content to this authorization gate.
CREATE FUNCTION public.get_appointment_whatsapp(p_appointment_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=app.require_confirmed_email(); v_result jsonb;
BEGIN
 SELECT jsonb_build_object('clientName',c.full_name,'phone',c.phone,'workspaceName',w.name,
 'professionalName',p.display_name,'serviceName',s.name,'startsAt',a.starts_at,'timezone',app.workspace_timezone(a.workspace_id),'status',a.status)
 INTO v_result FROM public.appointments a
 JOIN public.workspace_clients c ON c.id=a.client_id AND c.workspace_id=a.workspace_id
 JOIN public.workspaces w ON w.id=a.workspace_id
 JOIN public.professional_profiles p ON p.member_id=a.professional_member_id AND p.workspace_id=a.workspace_id
 JOIN public.services s ON s.id=a.service_id AND s.workspace_id=a.workspace_id
 WHERE a.id=p_appointment_id AND a.status IN ('scheduled','confirmed')
 AND app.can_write_appointment(a.workspace_id,a.professional_member_id);
 IF v_result IS NULL THEN RAISE EXCEPTION 'appointment_unavailable' USING ERRCODE='42501'; END IF;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.get_appointment_whatsapp(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_appointment_whatsapp(uuid) TO authenticated;
CREATE FUNCTION public.get_professional_photo(p_member_id uuid,p_slug text DEFAULT NULL) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_path text; v_workspace uuid; v_catalog jsonb;
BEGIN
 SELECT photo_path,workspace_id INTO v_path,v_workspace FROM public.professional_profiles WHERE member_id=p_member_id;
 IF v_path IS NULL THEN RETURN NULL; END IF;
 IF app.is_workspace_member(v_workspace) THEN RETURN v_path; END IF;
 IF p_slug IS NULL THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.workspaces WHERE id=v_workspace AND slug=p_slug) THEN RETURN NULL; END IF;
 v_catalog:=app.list_public_booking_catalog(p_slug);
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_catalog->'professionals') item WHERE item->>'id'=p_member_id::text) THEN RETURN v_path; END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.get_professional_photo(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_professional_photo(uuid,text) TO anon,authenticated;
