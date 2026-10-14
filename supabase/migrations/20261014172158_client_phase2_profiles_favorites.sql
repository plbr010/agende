-- Additive, staging only. No backfill or changes to billing or existing appointments.
ALTER TABLE public.profiles ADD COLUMN residence_city text
  CHECK (residence_city IS NULL OR (residence_city=btrim(residence_city)
    AND char_length(residence_city) BETWEEN 2 AND 80 AND residence_city !~ '[[:cntrl:]]'));
ALTER TABLE public.profiles ADD COLUMN avatar_path text
  CHECK (avatar_path IS NULL OR avatar_path ~ ('^avatars/'||user_id::text||'/[0-9a-f-]{36}\.webp$'));
GRANT UPDATE(residence_city) ON public.profiles TO authenticated;
-- Existing profiles CHECK invokes this pure immutable validator as the writing role.
GRANT EXECUTE ON FUNCTION app.is_valid_br_national(text) TO authenticated;
-- avatar_path is not writable by authenticated, even on their own profile.

CREATE TABLE public.client_workspace_favorites (
  user_id uuid NOT NULL REFERENCES public.profiles(user_id),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,workspace_id)
);
CREATE INDEX client_workspace_favorites_workspace_idx ON public.client_workspace_favorites(workspace_id);
ALTER TABLE public.client_workspace_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_workspace_favorites FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_workspace_favorites FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.client_workspace_favorites TO authenticated;
GRANT ALL ON public.client_workspace_favorites TO service_role;
CREATE POLICY client_workspace_favorites_own_read ON public.client_workspace_favorites
  FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
-- Writes go through checked RPCs only, so raw INSERT cannot bypass publication checks.
CREATE FUNCTION app.require_favorites_client() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=app.require_confirmed_email();
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.client_profiles WHERE user_id=v_uid) THEN
    RAISE EXCEPTION 'client_profile_required' USING ERRCODE='42501';
  END IF;
  RETURN v_uid;
END; $$;
CREATE FUNCTION app.list_my_workspace_favorites() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=app.require_favorites_client();
BEGIN
  RETURN (SELECT jsonb_build_object('items',coalesce(jsonb_agg(jsonb_build_object(
    'workspace_id',w.id,'name',w.name,'slug',w.slug,'city',s.city,'state',s.state,'logo_path',s.logo_path)
    ORDER BY f.created_at DESC,w.id),'[]'::jsonb),'total',count(*))
    FROM public.client_workspace_favorites f JOIN public.workspaces w ON w.id=f.workspace_id
    JOIN public.workspace_settings s ON s.workspace_id=w.id
    WHERE f.user_id=v_uid AND s.discovery_enabled AND s.city IS NOT NULL AND s.state IS NOT NULL
      AND app.workspace_has_entitlement(w.id));
END; $$;
CREATE FUNCTION app.add_my_workspace_favorite(p_workspace_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=app.require_favorites_client();
BEGIN
  -- Same public eligibility as discovery. get_workspace_discovery is a manager-only RPC.
  PERFORM 1 FROM public.workspace_settings s WHERE s.workspace_id=p_workspace_id
    AND s.discovery_enabled AND s.city IS NOT NULL AND s.state IS NOT NULL
    AND app.workspace_has_entitlement(s.workspace_id) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'workspace_unavailable' USING ERRCODE='22023'; END IF;
  INSERT INTO public.client_workspace_favorites(user_id,workspace_id) VALUES(v_uid,p_workspace_id)
    ON CONFLICT DO NOTHING;
END; $$;
CREATE FUNCTION app.remove_my_workspace_favorite(p_workspace_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=app.require_favorites_client();
BEGIN DELETE FROM public.client_workspace_favorites WHERE user_id=v_uid AND workspace_id=p_workspace_id; END; $$;
CREATE FUNCTION public.list_my_workspace_favorites() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT app.list_my_workspace_favorites(); $$;
CREATE FUNCTION public.add_my_workspace_favorite(p_workspace_id uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT app.add_my_workspace_favorite(p_workspace_id); $$;
CREATE FUNCTION public.remove_my_workspace_favorite(p_workspace_id uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT app.remove_my_workspace_favorite(p_workspace_id); $$;
REVOKE ALL ON FUNCTION app.require_favorites_client(),app.list_my_workspace_favorites(),
  app.add_my_workspace_favorite(uuid),app.remove_my_workspace_favorite(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.list_my_workspace_favorites(),public.add_my_workspace_favorite(uuid),
  public.remove_my_workspace_favorite(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_workspace_favorites(),public.add_my_workspace_favorite(uuid),
  public.remove_my_workspace_favorite(uuid) TO authenticated;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('account-avatars','account-avatars',false,2097152,ARRAY['image/webp']);
-- No direct user uploads/signing: all bytes are decoded and normalized by the server API.
-- Restrictive policy prevents any future broad Storage policy from opening this bucket.
CREATE POLICY account_avatars_server_only ON storage.objects AS RESTRICTIVE
FOR ALL TO anon,authenticated USING(bucket_id<>'account-avatars') WITH CHECK(bucket_id<>'account-avatars');

-- Durable retry queue; never delete Storage catalog rows with SQL.
CREATE TABLE app.avatar_cleanup_queue (
  path text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(path ~ '^avatars/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$')
);
ALTER TABLE app.avatar_cleanup_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.avatar_cleanup_queue FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app.avatar_cleanup_queue FROM PUBLIC,anon,authenticated;
GRANT ALL ON app.avatar_cleanup_queue TO service_role;
CREATE FUNCTION public.swap_account_avatar(p_user_id uuid,p_expected_path text,p_new_path text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_old text;
BEGIN
  SELECT avatar_path INTO v_old FROM public.profiles WHERE user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile_not_found' USING ERRCODE='22023'; END IF;
  IF v_old IS DISTINCT FROM p_expected_path THEN RETURN false; END IF;
  IF p_new_path IS NOT NULL AND (p_new_path !~ ('^avatars/'||p_user_id::text||'/[0-9a-f-]{36}\.webp$')
    OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='account-avatars' AND name=p_new_path)) THEN
    RAISE EXCEPTION 'invalid_avatar_path' USING ERRCODE='22023';
  END IF;
  UPDATE public.profiles SET avatar_path=p_new_path WHERE user_id=p_user_id;
  IF v_old IS NOT NULL AND v_old IS DISTINCT FROM p_new_path THEN
    INSERT INTO app.avatar_cleanup_queue(path) VALUES(v_old) ON CONFLICT DO NOTHING;
  END IF;
  RETURN true;
END; $$;
CREATE FUNCTION public.list_avatar_cleanup() RETURNS SETOF text
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  SELECT path FROM app.avatar_cleanup_queue ORDER BY created_at LIMIT 50;
$$;
CREATE FUNCTION public.finish_avatar_cleanup(p_path text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ DELETE FROM app.avatar_cleanup_queue WHERE path=p_path; $$;
REVOKE ALL ON FUNCTION public.swap_account_avatar(uuid,text,text),public.list_avatar_cleanup(),
  public.finish_avatar_cleanup(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.swap_account_avatar(uuid,text,text),public.list_avatar_cleanup(),
  public.finish_avatar_cleanup(text) TO service_role;
-- Typed phone/email must never authorize claiming another client's history.
CREATE OR REPLACE FUNCTION app.find_or_create_public_client(p_workspace_id uuid,p_full_name text,p_email text,p_phone text,p_user_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid; v_name text:=btrim(coalesce(p_full_name,'')); v_email text:=nullif(lower(btrim(coalesce(p_email,''))),''); v_phone text;
BEGIN
  IF char_length(v_name) NOT BETWEEN 2 AND 120 THEN RAISE EXCEPTION 'invalid_client_name' USING ERRCODE='22023'; END IF;
  IF p_user_id IS NOT NULL THEN
    IF p_user_id IS DISTINCT FROM app.require_confirmed_email() THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
    SELECT lower(email) INTO v_email FROM auth.users WHERE id=p_user_id;
    PERFORM pg_advisory_xact_lock(hashtextextended(p_workspace_id::text||'|user|'||p_user_id::text,0));
  END IF;
  IF v_email IS NULL OR v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'invalid_email' USING ERRCODE='22023'; END IF;
  v_phone:=app.normalize_phone(p_phone);
  IF v_phone IS NULL THEN RAISE EXCEPTION 'invalid_phone' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_workspace_id::text||'|phone|'||v_phone,0));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_workspace_id::text||'|email|'||v_email,0));
  IF p_user_id IS NOT NULL THEN
    SELECT id INTO v_id FROM public.workspace_clients WHERE workspace_id=p_workspace_id AND linked_user_id=p_user_id AND archived_at IS NULL ORDER BY created_at LIMIT 1;
  END IF;
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.workspace_clients WHERE workspace_id=p_workspace_id AND linked_user_id IS NULL AND email=v_email AND archived_at IS NULL ORDER BY created_at LIMIT 1;
  END IF;
  IF v_id IS NULL THEN
    INSERT INTO public.workspace_clients(workspace_id,full_name,email,phone) VALUES(p_workspace_id,v_name,v_email,v_phone) RETURNING id INTO v_id;
  END IF;
  IF p_user_id IS NOT NULL THEN
    PERFORM set_config('app.bypass_protected_columns','on',true);
    UPDATE public.workspace_clients SET linked_user_id=p_user_id WHERE id=v_id AND linked_user_id IS NULL;
    PERFORM set_config('app.bypass_protected_columns','off',true);
  END IF;
  RETURN v_id;
END; $$;
NOTIFY pgrst,'reload schema';
