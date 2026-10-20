-- PREPARED ONLY. NO DATABASE OPERATION IS PERFORMED BY THE GENERATOR.
-- Verify actual TLS connection/project externally; this GUC is intent, not identity.
-- Future psql: -X --set=ON_ERROR_STOP=1 --single-transaction --file=THIS_FILE
-- Requires session option: -c agende.authorized_project=wohimauqgywshbbejjcl
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
SET LOCAL idle_in_transaction_session_timeout='60s';
DO $prelaunch_guard$
BEGIN
 IF current_setting('agende.authorized_project',true) IS DISTINCT FROM 'wohimauqgywshbbejjcl' THEN RAISE EXCEPTION 'explicit_project_authorization_required'; END IF;
 IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version IN ('20261015054116','20261015054818','20261016075244','20261016235000','20261020162935') OR name IN ('workspace_media_and_settings_contract','workspace_settings_validation','profiles_booking_whatsapp','require_confirmed_public_booking','launch_discovery_eligibility')) THEN RAISE EXCEPTION 'prelaunch_history_present_or_drift'; END IF;
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND (table_name='workspace_settings' AND column_name='cover_path' OR table_name='professional_profiles' AND column_name='photo_path'))
 OR to_regclass('app.workspace_image_cleanup') IS NOT NULL OR to_regclass('app.professional_photo_cleanup') IS NOT NULL
 OR EXISTS(SELECT 1 FROM storage.buckets WHERE id='professional-photos')
 OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('get_appointment_whatsapp','swap_workspace_image','swap_professional_photo','get_related_client_avatar','get_public_workspace_cover')) THEN RAISE EXCEPTION 'prelaunch_objects_present_or_drift'; END IF;
 IF to_regprocedure('app.require_confirmed_email()') IS NULL OR to_regprocedure('app.require_workspace_manager(uuid)') IS NULL OR to_regprocedure('app.can_write_appointment(uuid,uuid)') IS NULL OR to_regclass('public.workspace_settings_discovery_city') IS NULL THEN RAISE EXCEPTION 'prelaunch_dependency_missing'; END IF;
 IF to_regclass('public.appointment_reviews') IS NULL OR to_regprocedure('public.list_my_reschedule_slots(uuid,uuid,date)') IS NULL
 OR NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='app' AND p.proname='sync_billing_subscription' AND p.prosrc LIKE '%v_effective_status%') THEN RAISE EXCEPTION 'prelaunch_legacy_contracts_required'; END IF;
END;
$prelaunch_guard$;

-- Source 20261015054116_workspace_media_and_settings_contract.sql; SHA256 6bdb4cf6bdd771bc8d0a97b4610e54a921a9c763bc768805d9bd6931280cdd4f
-- Additive. Apply only to staging until production backup/rollout is approved.
ALTER TABLE public.workspace_settings ADD COLUMN IF NOT EXISTS cover_path text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.workspace_settings'::regclass AND conname='workspace_cover_owned') THEN
    ALTER TABLE public.workspace_settings ADD CONSTRAINT workspace_cover_owned CHECK
      (cover_path IS NULL OR cover_path ~ ('^'||workspace_id::text||'/cover/[0-9a-f-]{36}[.]webp$'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS app.workspace_image_cleanup (
  path text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  available_at timestamptz NOT NULL DEFAULT now() + interval '1 hour',
  claimed boolean NOT NULL DEFAULT false
);
ALTER TABLE app.workspace_image_cleanup ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.workspace_image_cleanup FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app.workspace_image_cleanup FROM PUBLIC, anon, authenticated;
GRANT ALL ON app.workspace_image_cleanup TO service_role;
CREATE INDEX IF NOT EXISTS workspace_image_cleanup_workspace ON app.workspace_image_cleanup(workspace_id,available_at);

-- Storage bytes can be written only by the image-normalizing server. Existing
-- public URLs remain public; no existing object is moved or removed by DDL.
DROP POLICY IF EXISTS workspace_images_server_insert ON storage.objects;
CREATE POLICY workspace_images_server_insert ON storage.objects AS RESTRICTIVE
  FOR INSERT TO anon,authenticated WITH CHECK(bucket_id<>'workspace-logos');
DROP POLICY IF EXISTS workspace_images_server_update ON storage.objects;
CREATE POLICY workspace_images_server_update ON storage.objects AS RESTRICTIVE
  FOR UPDATE TO anon,authenticated USING(bucket_id<>'workspace-logos') WITH CHECK(bucket_id<>'workspace-logos');
DROP POLICY IF EXISTS workspace_images_server_delete ON storage.objects;
CREATE POLICY workspace_images_server_delete ON storage.objects AS RESTRICTIVE
  FOR DELETE TO anon,authenticated USING(bucket_id<>'workspace-logos');

CREATE OR REPLACE FUNCTION public.queue_workspace_image_upload(p_workspace_id uuid,p_kind text,p_path text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM app.require_workspace_manager(p_workspace_id);
  IF p_kind IS NULL OR p_kind NOT IN ('logo','cover') OR p_path IS NULL OR
    p_path !~ ('^'||p_workspace_id::text||'/'||p_kind||'/[0-9a-f-]{36}[.]webp$') THEN
    RAISE EXCEPTION 'invalid_image_path' USING ERRCODE='22023';
  END IF;
  INSERT INTO app.workspace_image_cleanup(path,workspace_id) VALUES(p_path,p_workspace_id);
END $$;

CREATE OR REPLACE FUNCTION public.swap_workspace_image(p_workspace_id uuid,p_kind text,p_expected_path text,p_new_path text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_settings public.workspace_settings; v_old text; v_lease app.workspace_image_cleanup;
BEGIN
  PERFORM app.require_workspace_manager(p_workspace_id);
  IF p_kind NOT IN ('logo','cover') OR p_kind IS NULL THEN RAISE EXCEPTION 'invalid_image_kind' USING ERRCODE='22023'; END IF;
  SELECT * INTO STRICT v_settings FROM public.workspace_settings WHERE workspace_id=p_workspace_id FOR UPDATE;
  v_old:=CASE WHEN p_kind='logo' THEN v_settings.logo_path ELSE v_settings.cover_path END;
  IF v_old IS DISTINCT FROM p_expected_path THEN RETURN false; END IF;
  IF p_new_path IS NOT NULL THEN
    SELECT * INTO v_lease FROM app.workspace_image_cleanup WHERE path=p_new_path AND workspace_id=p_workspace_id FOR UPDATE;
    IF NOT FOUND OR v_lease.claimed OR v_lease.available_at<=now() OR
      p_new_path !~ ('^'||p_workspace_id::text||'/'||p_kind||'/[0-9a-f-]{36}[.]webp$') OR
      NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='workspace-logos' AND name=p_new_path) THEN
      RAISE EXCEPTION 'invalid_image_path' USING ERRCODE='22023';
    END IF;
  END IF;
  UPDATE public.workspace_settings SET
    logo_path=CASE WHEN p_kind='logo' THEN p_new_path ELSE logo_path END,
    cover_path=CASE WHEN p_kind='cover' THEN p_new_path ELSE cover_path END
    WHERE workspace_id=p_workspace_id;
  DELETE FROM app.workspace_image_cleanup WHERE path=p_new_path;
  IF v_old IS NOT NULL AND v_old IS DISTINCT FROM p_new_path THEN
    INSERT INTO app.workspace_image_cleanup(path,workspace_id,available_at) VALUES(v_old,p_workspace_id,now())
      ON CONFLICT(path) DO UPDATE SET available_at=now(),claimed=false;
  END IF;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.claim_workspace_image_cleanup(p_workspace_id uuid)
RETURNS SETOF text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM app.require_workspace_manager(p_workspace_id);
  -- Same lock order as swap: references cannot change while claiming bytes.
  PERFORM 1 FROM public.workspace_settings WHERE workspace_id=p_workspace_id FOR UPDATE;
  RETURN QUERY UPDATE app.workspace_image_cleanup q SET claimed=true
    WHERE q.workspace_id=p_workspace_id AND q.available_at<=now()
    AND NOT EXISTS(SELECT 1 FROM public.workspace_settings s WHERE s.logo_path=q.path OR s.cover_path=q.path)
    RETURNING q.path;
END $$;
CREATE OR REPLACE FUNCTION public.finish_workspace_image_cleanup(p_workspace_id uuid,p_path text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM app.require_workspace_manager(p_workspace_id);
  DELETE FROM app.workspace_image_cleanup WHERE workspace_id=p_workspace_id AND path=p_path AND claimed;
END $$;

CREATE OR REPLACE FUNCTION public.get_public_workspace_cover(p_slug text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT s.cover_path FROM public.workspace_settings s JOIN public.workspaces w ON w.id=s.workspace_id
  WHERE w.slug=p_slug;
$$;
REVOKE ALL ON FUNCTION public.queue_workspace_image_upload(uuid,text,text),public.swap_workspace_image(uuid,text,text,text),
  public.claim_workspace_image_cleanup(uuid),public.finish_workspace_image_cleanup(uuid,text),public.get_public_workspace_cover(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.queue_workspace_image_upload(uuid,text,text),public.swap_workspace_image(uuid,text,text,text),
  public.claim_workspace_image_cleanup(uuid),public.finish_workspace_image_cleanup(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_workspace_cover(text) TO anon,authenticated;


;
INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('20261015054116','workspace_media_and_settings_contract',ARRAY[$source_20261015054116$-- Additive. Apply only to staging until production backup/rollout is approved.
ALTER TABLE public.workspace_settings ADD COLUMN IF NOT EXISTS cover_path text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.workspace_settings'::regclass AND conname='workspace_cover_owned') THEN
    ALTER TABLE public.workspace_settings ADD CONSTRAINT workspace_cover_owned CHECK
      (cover_path IS NULL OR cover_path ~ ('^'||workspace_id::text||'/cover/[0-9a-f-]{36}[.]webp$'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS app.workspace_image_cleanup (
  path text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
  available_at timestamptz NOT NULL DEFAULT now() + interval '1 hour',
  claimed boolean NOT NULL DEFAULT false
);
ALTER TABLE app.workspace_image_cleanup ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.workspace_image_cleanup FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app.workspace_image_cleanup FROM PUBLIC, anon, authenticated;
GRANT ALL ON app.workspace_image_cleanup TO service_role;
CREATE INDEX IF NOT EXISTS workspace_image_cleanup_workspace ON app.workspace_image_cleanup(workspace_id,available_at);

-- Storage bytes can be written only by the image-normalizing server. Existing
-- public URLs remain public; no existing object is moved or removed by DDL.
DROP POLICY IF EXISTS workspace_images_server_insert ON storage.objects;
CREATE POLICY workspace_images_server_insert ON storage.objects AS RESTRICTIVE
  FOR INSERT TO anon,authenticated WITH CHECK(bucket_id<>'workspace-logos');
DROP POLICY IF EXISTS workspace_images_server_update ON storage.objects;
CREATE POLICY workspace_images_server_update ON storage.objects AS RESTRICTIVE
  FOR UPDATE TO anon,authenticated USING(bucket_id<>'workspace-logos') WITH CHECK(bucket_id<>'workspace-logos');
DROP POLICY IF EXISTS workspace_images_server_delete ON storage.objects;
CREATE POLICY workspace_images_server_delete ON storage.objects AS RESTRICTIVE
  FOR DELETE TO anon,authenticated USING(bucket_id<>'workspace-logos');

CREATE OR REPLACE FUNCTION public.queue_workspace_image_upload(p_workspace_id uuid,p_kind text,p_path text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM app.require_workspace_manager(p_workspace_id);
  IF p_kind IS NULL OR p_kind NOT IN ('logo','cover') OR p_path IS NULL OR
    p_path !~ ('^'||p_workspace_id::text||'/'||p_kind||'/[0-9a-f-]{36}[.]webp$') THEN
    RAISE EXCEPTION 'invalid_image_path' USING ERRCODE='22023';
  END IF;
  INSERT INTO app.workspace_image_cleanup(path,workspace_id) VALUES(p_path,p_workspace_id);
END $$;

CREATE OR REPLACE FUNCTION public.swap_workspace_image(p_workspace_id uuid,p_kind text,p_expected_path text,p_new_path text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_settings public.workspace_settings; v_old text; v_lease app.workspace_image_cleanup;
BEGIN
  PERFORM app.require_workspace_manager(p_workspace_id);
  IF p_kind NOT IN ('logo','cover') OR p_kind IS NULL THEN RAISE EXCEPTION 'invalid_image_kind' USING ERRCODE='22023'; END IF;
  SELECT * INTO STRICT v_settings FROM public.workspace_settings WHERE workspace_id=p_workspace_id FOR UPDATE;
  v_old:=CASE WHEN p_kind='logo' THEN v_settings.logo_path ELSE v_settings.cover_path END;
  IF v_old IS DISTINCT FROM p_expected_path THEN RETURN false; END IF;
  IF p_new_path IS NOT NULL THEN
    SELECT * INTO v_lease FROM app.workspace_image_cleanup WHERE path=p_new_path AND workspace_id=p_workspace_id FOR UPDATE;
    IF NOT FOUND OR v_lease.claimed OR v_lease.available_at<=now() OR
      p_new_path !~ ('^'||p_workspace_id::text||'/'||p_kind||'/[0-9a-f-]{36}[.]webp$') OR
      NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='workspace-logos' AND name=p_new_path) THEN
      RAISE EXCEPTION 'invalid_image_path' USING ERRCODE='22023';
    END IF;
  END IF;
  UPDATE public.workspace_settings SET
    logo_path=CASE WHEN p_kind='logo' THEN p_new_path ELSE logo_path END,
    cover_path=CASE WHEN p_kind='cover' THEN p_new_path ELSE cover_path END
    WHERE workspace_id=p_workspace_id;
  DELETE FROM app.workspace_image_cleanup WHERE path=p_new_path;
  IF v_old IS NOT NULL AND v_old IS DISTINCT FROM p_new_path THEN
    INSERT INTO app.workspace_image_cleanup(path,workspace_id,available_at) VALUES(v_old,p_workspace_id,now())
      ON CONFLICT(path) DO UPDATE SET available_at=now(),claimed=false;
  END IF;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.claim_workspace_image_cleanup(p_workspace_id uuid)
RETURNS SETOF text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM app.require_workspace_manager(p_workspace_id);
  -- Same lock order as swap: references cannot change while claiming bytes.
  PERFORM 1 FROM public.workspace_settings WHERE workspace_id=p_workspace_id FOR UPDATE;
  RETURN QUERY UPDATE app.workspace_image_cleanup q SET claimed=true
    WHERE q.workspace_id=p_workspace_id AND q.available_at<=now()
    AND NOT EXISTS(SELECT 1 FROM public.workspace_settings s WHERE s.logo_path=q.path OR s.cover_path=q.path)
    RETURNING q.path;
END $$;
CREATE OR REPLACE FUNCTION public.finish_workspace_image_cleanup(p_workspace_id uuid,p_path text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM app.require_workspace_manager(p_workspace_id);
  DELETE FROM app.workspace_image_cleanup WHERE workspace_id=p_workspace_id AND path=p_path AND claimed;
END $$;

CREATE OR REPLACE FUNCTION public.get_public_workspace_cover(p_slug text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT s.cover_path FROM public.workspace_settings s JOIN public.workspaces w ON w.id=s.workspace_id
  WHERE w.slug=p_slug;
$$;
REVOKE ALL ON FUNCTION public.queue_workspace_image_upload(uuid,text,text),public.swap_workspace_image(uuid,text,text,text),
  public.claim_workspace_image_cleanup(uuid),public.finish_workspace_image_cleanup(uuid,text),public.get_public_workspace_cover(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.queue_workspace_image_upload(uuid,text,text),public.swap_workspace_image(uuid,text,text,text),
  public.claim_workspace_image_cleanup(uuid),public.finish_workspace_image_cleanup(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_workspace_cover(text) TO anon,authenticated;

$source_20261015054116$]);

-- Source 20261015054818_workspace_settings_validation.sql; SHA256 739aee0dbcf842095d820ede5c78ead377ea22570990739f0b1795caa3530e5a
-- Preserve the existing RPC signature; validate optional fields and serialize
-- with image swaps. Image references now have their own guarded lifecycle.
CREATE OR REPLACE FUNCTION app.update_workspace_settings(
  p_workspace_id uuid,p_name text,p_slug text,p_business_phone text,p_business_email text,
  p_description text,p_address text,p_city text,p_state text,p_postal_code text,p_instagram text,p_timezone text,
  p_logo_path text DEFAULT NULL,p_clear_logo boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_name text:=btrim(p_name); v_slug text:=app.slugify(p_slug);
  v_phone text:=app.normalize_phone(p_business_phone); v_email text:=nullif(lower(btrim(p_business_email)),'');
  v_address text:=nullif(btrim(p_address),''); v_city text:=nullif(btrim(p_city),'');
  v_state text:=nullif(upper(btrim(p_state)),''); v_postal text:=nullif(regexp_replace(coalesce(p_postal_code,''),'[^0-9]','','g'),'');
  v_timezone text:=coalesce(nullif(btrim(p_timezone),''),'America/Sao_Paulo');
BEGIN
  PERFORM app.require_workspace_manager(p_workspace_id);
  PERFORM 1 FROM public.workspace_settings WHERE workspace_id=p_workspace_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'workspace_settings_missing' USING ERRCODE='P0001'; END IF;
  IF v_name IS NULL OR char_length(v_name) NOT BETWEEN 2 AND 80 THEN RAISE EXCEPTION 'invalid_workspace_name' USING ERRCODE='22023'; END IF;
  IF v_slug IS NULL OR char_length(v_slug) NOT BETWEEN 3 AND 60 OR v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN RAISE EXCEPTION 'invalid_slug' USING ERRCODE='22023'; END IF;
  IF app.is_reserved_workspace_slug(v_slug) THEN RAISE EXCEPTION 'reserved_slug' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM public.workspaces WHERE slug=v_slug AND id<>p_workspace_id) THEN RAISE EXCEPTION 'slug_taken' USING ERRCODE='23505'; END IF;
  IF nullif(btrim(p_business_phone),'') IS NOT NULL AND v_phone IS NULL THEN RAISE EXCEPTION 'invalid_phone' USING ERRCODE='22023'; END IF;
  IF v_email IS NOT NULL AND v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' THEN RAISE EXCEPTION 'invalid_business_email' USING ERRCODE='22023'; END IF;
  IF v_address IS NOT NULL AND (char_length(v_address)>160 OR v_address ~ '[[:cntrl:]]') THEN RAISE EXCEPTION 'invalid_address' USING ERRCODE='22023'; END IF;
  IF v_city IS NOT NULL AND (char_length(v_city) NOT BETWEEN 2 AND 80 OR v_city ~ '[[:cntrl:]]') THEN RAISE EXCEPTION 'invalid_city' USING ERRCODE='22023'; END IF;
  IF v_state IS NOT NULL AND v_state NOT IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO') THEN RAISE EXCEPTION 'invalid_state' USING ERRCODE='22023'; END IF;
  IF (nullif(btrim(p_postal_code),'') IS NOT NULL AND (p_postal_code ~ '[^0-9[:space:].-]' OR char_length(coalesce(v_postal,''))<>8)) THEN RAISE EXCEPTION 'invalid_postal_code' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=v_timezone) OR v_timezone NOT IN
    ('America/Sao_Paulo','America/Fortaleza','America/Recife','America/Bahia','America/Belem','America/Manaus','America/Cuiaba','America/Porto_Velho','America/Boa_Vista','America/Rio_Branco','America/Noronha') THEN RAISE EXCEPTION 'invalid_timezone' USING ERRCODE='22023'; END IF;
  IF p_logo_path IS NOT NULL OR p_clear_logo THEN RAISE EXCEPTION 'invalid_logo_path' USING ERRCODE='22023'; END IF;
  UPDATE public.workspaces SET name=v_name,slug=v_slug WHERE id=p_workspace_id;
  UPDATE public.workspace_settings SET business_phone=v_phone,business_email=v_email,
    address=v_address,city=v_city,state=v_state,postal_code=v_postal,timezone=v_timezone,
    description=nullif(btrim(p_description),''),instagram=nullif(btrim(regexp_replace(coalesce(p_instagram,''),'^@+','')),'')
    WHERE workspace_id=p_workspace_id;
  RETURN jsonb_build_object('workspace_id',p_workspace_id,'name',v_name,'slug',v_slug,'timezone',v_timezone);
END $$;
REVOKE ALL ON FUNCTION app.update_workspace_settings(uuid,text,text,text,text,text,text,text,text,text,text,text,text,boolean) FROM PUBLIC,anon,authenticated;

;
INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('20261015054818','workspace_settings_validation',ARRAY[$source_20261015054818$-- Preserve the existing RPC signature; validate optional fields and serialize
-- with image swaps. Image references now have their own guarded lifecycle.
CREATE OR REPLACE FUNCTION app.update_workspace_settings(
  p_workspace_id uuid,p_name text,p_slug text,p_business_phone text,p_business_email text,
  p_description text,p_address text,p_city text,p_state text,p_postal_code text,p_instagram text,p_timezone text,
  p_logo_path text DEFAULT NULL,p_clear_logo boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_name text:=btrim(p_name); v_slug text:=app.slugify(p_slug);
  v_phone text:=app.normalize_phone(p_business_phone); v_email text:=nullif(lower(btrim(p_business_email)),'');
  v_address text:=nullif(btrim(p_address),''); v_city text:=nullif(btrim(p_city),'');
  v_state text:=nullif(upper(btrim(p_state)),''); v_postal text:=nullif(regexp_replace(coalesce(p_postal_code,''),'[^0-9]','','g'),'');
  v_timezone text:=coalesce(nullif(btrim(p_timezone),''),'America/Sao_Paulo');
BEGIN
  PERFORM app.require_workspace_manager(p_workspace_id);
  PERFORM 1 FROM public.workspace_settings WHERE workspace_id=p_workspace_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'workspace_settings_missing' USING ERRCODE='P0001'; END IF;
  IF v_name IS NULL OR char_length(v_name) NOT BETWEEN 2 AND 80 THEN RAISE EXCEPTION 'invalid_workspace_name' USING ERRCODE='22023'; END IF;
  IF v_slug IS NULL OR char_length(v_slug) NOT BETWEEN 3 AND 60 OR v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN RAISE EXCEPTION 'invalid_slug' USING ERRCODE='22023'; END IF;
  IF app.is_reserved_workspace_slug(v_slug) THEN RAISE EXCEPTION 'reserved_slug' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM public.workspaces WHERE slug=v_slug AND id<>p_workspace_id) THEN RAISE EXCEPTION 'slug_taken' USING ERRCODE='23505'; END IF;
  IF nullif(btrim(p_business_phone),'') IS NOT NULL AND v_phone IS NULL THEN RAISE EXCEPTION 'invalid_phone' USING ERRCODE='22023'; END IF;
  IF v_email IS NOT NULL AND v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' THEN RAISE EXCEPTION 'invalid_business_email' USING ERRCODE='22023'; END IF;
  IF v_address IS NOT NULL AND (char_length(v_address)>160 OR v_address ~ '[[:cntrl:]]') THEN RAISE EXCEPTION 'invalid_address' USING ERRCODE='22023'; END IF;
  IF v_city IS NOT NULL AND (char_length(v_city) NOT BETWEEN 2 AND 80 OR v_city ~ '[[:cntrl:]]') THEN RAISE EXCEPTION 'invalid_city' USING ERRCODE='22023'; END IF;
  IF v_state IS NOT NULL AND v_state NOT IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO') THEN RAISE EXCEPTION 'invalid_state' USING ERRCODE='22023'; END IF;
  IF (nullif(btrim(p_postal_code),'') IS NOT NULL AND (p_postal_code ~ '[^0-9[:space:].-]' OR char_length(coalesce(v_postal,''))<>8)) THEN RAISE EXCEPTION 'invalid_postal_code' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=v_timezone) OR v_timezone NOT IN
    ('America/Sao_Paulo','America/Fortaleza','America/Recife','America/Bahia','America/Belem','America/Manaus','America/Cuiaba','America/Porto_Velho','America/Boa_Vista','America/Rio_Branco','America/Noronha') THEN RAISE EXCEPTION 'invalid_timezone' USING ERRCODE='22023'; END IF;
  IF p_logo_path IS NOT NULL OR p_clear_logo THEN RAISE EXCEPTION 'invalid_logo_path' USING ERRCODE='22023'; END IF;
  UPDATE public.workspaces SET name=v_name,slug=v_slug WHERE id=p_workspace_id;
  UPDATE public.workspace_settings SET business_phone=v_phone,business_email=v_email,
    address=v_address,city=v_city,state=v_state,postal_code=v_postal,timezone=v_timezone,
    description=nullif(btrim(p_description),''),instagram=nullif(btrim(regexp_replace(coalesce(p_instagram,''),'^@+','')),'')
    WHERE workspace_id=p_workspace_id;
  RETURN jsonb_build_object('workspace_id',p_workspace_id,'name',v_name,'slug',v_slug,'timezone',v_timezone);
END $$;
REVOKE ALL ON FUNCTION app.update_workspace_settings(uuid,text,text,text,text,text,text,text,text,text,text,text,text,boolean) FROM PUBLIC,anon,authenticated;
$source_20261015054818$]);

-- Source 20261016075244_profiles_booking_whatsapp.sql; SHA256 f647bd497bb4af9a73b6e584da39e7d663bcda1c2a83993e70d0e58e2b44f31a
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

;
INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('20261016075244','profiles_booking_whatsapp',ARRAY[$source_20261016075244$-- Additive migration. No production execution authorized.
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
$source_20261016075244$]);

-- Source 20261016235000_require_confirmed_public_booking.sql; SHA256 86eefed61fb582aa02b559866848b4034e46241ff36455b9dee80169f7ce350c
-- Additive migration. No production execution authorized.
-- A confirmed Agendê account is required to insert a public appointment.
-- Losing e-mail confirmation mid-request must abort; it must not continue as a guest.

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

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT u.email_confirmed_at IS NOT NULL INTO v_confirmed
  FROM auth.users u
  WHERE u.id = v_uid;
  IF NOT COALESCE(v_confirmed, false) THEN
    RAISE EXCEPTION 'email_not_confirmed' USING ERRCODE = '42501';
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
REVOKE ALL ON FUNCTION app.create_public_appointment(text,uuid,uuid,timestamptz,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_public_appointment(text,uuid,uuid,timestamptz,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_public_appointment(text,uuid,uuid,timestamptz,text,text,text,text,text) TO authenticated;
COMMENT ON FUNCTION public.create_public_appointment(text,uuid,uuid,timestamptz,text,text,text,text,text) IS 'Authenticated client booking; verified email from Auth. Anonymous and unconfirmed sessions cannot insert. Atomic availability and authoritative pricing.';

;
INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('20261016235000','require_confirmed_public_booking',ARRAY[$source_20261016235000$-- Additive migration. No production execution authorized.
-- A confirmed Agendê account is required to insert a public appointment.
-- Losing e-mail confirmation mid-request must abort; it must not continue as a guest.

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

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT u.email_confirmed_at IS NOT NULL INTO v_confirmed
  FROM auth.users u
  WHERE u.id = v_uid;
  IF NOT COALESCE(v_confirmed, false) THEN
    RAISE EXCEPTION 'email_not_confirmed' USING ERRCODE = '42501';
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
REVOKE ALL ON FUNCTION app.create_public_appointment(text,uuid,uuid,timestamptz,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_public_appointment(text,uuid,uuid,timestamptz,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_public_appointment(text,uuid,uuid,timestamptz,text,text,text,text,text) TO authenticated;
COMMENT ON FUNCTION public.create_public_appointment(text,uuid,uuid,timestamptz,text,text,text,text,text) IS 'Authenticated client booking; verified email from Auth. Anonymous and unconfirmed sessions cannot insert. Atomic availability and authoritative pricing.';
$source_20261016235000$]);

-- Source 20261020162935_launch_discovery_eligibility.sql; SHA256 3f1ffbb0d1c2b6444fce81e49f9b1e02538a4c827f92f7c47b96bac055d26b79
-- Normalize whitespace in stored locality/name values and queries.
-- Professional name matches require an active linked public service.
CREATE OR REPLACE FUNCTION app.discovery_text(p_text text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT translate(lower(btrim(regexp_replace(coalesce(p_text,''), '[[:space:]]+', ' ', 'g'))),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucaaaaaeeeeiiiiooooouuuuc');
$$;

REINDEX INDEX public.workspace_settings_discovery_city;

CREATE OR REPLACE FUNCTION public.search_public_workspaces(
  p_city text DEFAULT NULL, p_state text DEFAULT NULL, p_query text DEFAULT NULL,
  p_postal_code text DEFAULT NULL, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_city text:=nullif(app.discovery_text(p_city),'');
  v_query text:=nullif(app.discovery_text(p_query),''); v_state text:=nullif(upper(btrim(p_state)),'');
BEGIN
  IF (v_city IS NULL AND v_query IS NULL)
    OR (v_city IS NOT NULL AND char_length(v_city) NOT BETWEEN 2 AND 80)
    OR (v_query IS NOT NULL AND char_length(v_query) NOT BETWEEN 2 AND 100)
    OR (v_state IS NOT NULL AND v_state !~ '^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$')
    OR p_postal_code IS NOT NULL OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50
    OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 10000 THEN
    RAISE EXCEPTION 'invalid_discovery_input' USING ERRCODE='22023';
  END IF;
  RETURN (
    WITH eligible AS MATERIALIZED (
      SELECT w.name,w.slug,s.description,s.city,s.state,s.logo_path,
        EXISTS(SELECT 1 FROM public.services svc
          JOIN public.professional_services ps ON ps.service_id=svc.id AND ps.workspace_id=svc.workspace_id
          JOIN public.professional_profiles pp ON pp.member_id=ps.professional_member_id AND pp.workspace_id=ps.workspace_id
          JOIN public.workspace_members m ON m.id=pp.member_id AND m.workspace_id=pp.workspace_id
          WHERE svc.workspace_id=w.id AND svc.active AND svc.archived_at IS NULL AND ps.active
            AND pp.booking_enabled AND m.status='active' AND m.role IN ('owner','admin','professional')) AS booking_open
      FROM public.workspace_settings s JOIN public.workspaces w ON w.id=s.workspace_id
      WHERE s.discovery_enabled AND app.workspace_has_entitlement(w.id)
        AND s.city IS NOT NULL AND s.state IS NOT NULL
        AND (v_city IS NULL OR app.discovery_text(s.city)=v_city)
        AND (v_state IS NULL OR s.state=v_state)
        AND (v_query IS NULL OR strpos(app.discovery_text(w.name),v_query)>0 OR EXISTS (
          SELECT 1 FROM public.professional_profiles pp JOIN public.workspace_members m ON m.id=pp.member_id AND m.workspace_id=pp.workspace_id
          WHERE pp.workspace_id=w.id AND pp.booking_enabled AND m.status='active'
            AND m.role IN ('owner','admin','professional')
            AND EXISTS (SELECT 1 FROM public.professional_services ps
              JOIN public.services svc ON svc.id=ps.service_id AND svc.workspace_id=ps.workspace_id
              WHERE ps.workspace_id=pp.workspace_id AND ps.professional_member_id=pp.member_id
                AND ps.active AND svc.active AND svc.archived_at IS NULL)
            AND strpos(app.discovery_text(pp.display_name),v_query)>0))
    ), page AS (SELECT * FROM eligible ORDER BY name COLLATE "C",slug LIMIT p_limit OFFSET p_offset)
    SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(to_jsonb(page) ORDER BY name COLLATE "C",slug) FROM page),'[]'::jsonb),
      'total',(SELECT count(*) FROM eligible))
  );
END;
$$;

NOTIFY pgrst, 'reload schema';

;
INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('20261020162935','launch_discovery_eligibility',ARRAY[$source_20261020162935$-- Normalize whitespace in stored locality/name values and queries.
-- Professional name matches require an active linked public service.
CREATE OR REPLACE FUNCTION app.discovery_text(p_text text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT translate(lower(btrim(regexp_replace(coalesce(p_text,''), '[[:space:]]+', ' ', 'g'))),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucaaaaaeeeeiiiiooooouuuuc');
$$;

REINDEX INDEX public.workspace_settings_discovery_city;

CREATE OR REPLACE FUNCTION public.search_public_workspaces(
  p_city text DEFAULT NULL, p_state text DEFAULT NULL, p_query text DEFAULT NULL,
  p_postal_code text DEFAULT NULL, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_city text:=nullif(app.discovery_text(p_city),'');
  v_query text:=nullif(app.discovery_text(p_query),''); v_state text:=nullif(upper(btrim(p_state)),'');
BEGIN
  IF (v_city IS NULL AND v_query IS NULL)
    OR (v_city IS NOT NULL AND char_length(v_city) NOT BETWEEN 2 AND 80)
    OR (v_query IS NOT NULL AND char_length(v_query) NOT BETWEEN 2 AND 100)
    OR (v_state IS NOT NULL AND v_state !~ '^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$')
    OR p_postal_code IS NOT NULL OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50
    OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 10000 THEN
    RAISE EXCEPTION 'invalid_discovery_input' USING ERRCODE='22023';
  END IF;
  RETURN (
    WITH eligible AS MATERIALIZED (
      SELECT w.name,w.slug,s.description,s.city,s.state,s.logo_path,
        EXISTS(SELECT 1 FROM public.services svc
          JOIN public.professional_services ps ON ps.service_id=svc.id AND ps.workspace_id=svc.workspace_id
          JOIN public.professional_profiles pp ON pp.member_id=ps.professional_member_id AND pp.workspace_id=ps.workspace_id
          JOIN public.workspace_members m ON m.id=pp.member_id AND m.workspace_id=pp.workspace_id
          WHERE svc.workspace_id=w.id AND svc.active AND svc.archived_at IS NULL AND ps.active
            AND pp.booking_enabled AND m.status='active' AND m.role IN ('owner','admin','professional')) AS booking_open
      FROM public.workspace_settings s JOIN public.workspaces w ON w.id=s.workspace_id
      WHERE s.discovery_enabled AND app.workspace_has_entitlement(w.id)
        AND s.city IS NOT NULL AND s.state IS NOT NULL
        AND (v_city IS NULL OR app.discovery_text(s.city)=v_city)
        AND (v_state IS NULL OR s.state=v_state)
        AND (v_query IS NULL OR strpos(app.discovery_text(w.name),v_query)>0 OR EXISTS (
          SELECT 1 FROM public.professional_profiles pp JOIN public.workspace_members m ON m.id=pp.member_id AND m.workspace_id=pp.workspace_id
          WHERE pp.workspace_id=w.id AND pp.booking_enabled AND m.status='active'
            AND m.role IN ('owner','admin','professional')
            AND EXISTS (SELECT 1 FROM public.professional_services ps
              JOIN public.services svc ON svc.id=ps.service_id AND svc.workspace_id=ps.workspace_id
              WHERE ps.workspace_id=pp.workspace_id AND ps.professional_member_id=pp.member_id
                AND ps.active AND svc.active AND svc.archived_at IS NULL)
            AND strpos(app.discovery_text(pp.display_name),v_query)>0))
    ), page AS (SELECT * FROM eligible ORDER BY name COLLATE "C",slug LIMIT p_limit OFFSET p_offset)
    SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(to_jsonb(page) ORDER BY name COLLATE "C",slug) FROM page),'[]'::jsonb),
      'total',(SELECT count(*) FROM eligible))
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
$source_20261020162935$]);

-- Keep creation paused after migrations restore their normal grants.
-- Separate authorization is required to run the reviewed resume script.
REVOKE EXECUTE ON FUNCTION public.create_public_appointment(text,uuid,uuid,timestamptz,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.create_appointment(uuid,uuid,uuid,uuid,timestamptz,text) FROM PUBLIC,anon,authenticated;
REVOKE INSERT ON public.appointments FROM PUBLIC,anon,authenticated;
DO $prelaunch_post$
BEGIN
 IF has_function_privilege('anon','public.create_public_appointment(text,uuid,uuid,timestamptz,text,text,text,text,text)','EXECUTE')
 OR has_function_privilege('authenticated','public.create_public_appointment(text,uuid,uuid,timestamptz,text,text,text,text,text)','EXECUTE')
 OR has_function_privilege('authenticated','public.create_appointment(uuid,uuid,uuid,uuid,timestamptz,text)','EXECUTE') THEN RAISE EXCEPTION 'prelaunch_pause_grants_failed'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='app' AND p.proname='create_public_appointment' AND p.prosrc LIKE '%v_uid := NULL%') THEN RAISE EXCEPTION 'prelaunch_guest_fallback_remains'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='professional-photos' AND NOT public) THEN RAISE EXCEPTION 'prelaunch_private_bucket_failed'; END IF;
END;
$prelaunch_post$;
NOTIFY pgrst, 'reload schema';
