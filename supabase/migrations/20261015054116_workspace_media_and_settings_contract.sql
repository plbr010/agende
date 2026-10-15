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

