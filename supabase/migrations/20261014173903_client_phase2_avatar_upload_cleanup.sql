-- Lease pending uploads before Storage writes. Interrupted uploads are retried after an hour.
ALTER TABLE app.avatar_cleanup_queue ADD COLUMN not_before timestamptz NOT NULL DEFAULT now();
CREATE FUNCTION public.queue_account_avatar_upload(p_user_id uuid,p_path text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF p_path IS NULL OR p_path !~ ('^avatars/'||p_user_id::text||'/[0-9a-f-]{36}\.webp$')
    OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE user_id=p_user_id) THEN
    RAISE EXCEPTION 'invalid_avatar_path' USING ERRCODE='22023';
  END IF;
  INSERT INTO app.avatar_cleanup_queue(path,not_before) VALUES(p_path,clock_timestamp()+interval '1 hour');
END; $$;
CREATE OR REPLACE FUNCTION public.list_avatar_cleanup() RETURNS SETOF text
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  SELECT q.path FROM app.avatar_cleanup_queue q WHERE q.not_before<=clock_timestamp()
    AND NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.avatar_path=q.path)
    ORDER BY q.created_at LIMIT 50;
$$;
-- A committed profile reference cancels its pending-upload cleanup lease atomically.
CREATE FUNCTION app.finish_committed_avatar_upload() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.avatar_path IS NOT NULL THEN DELETE FROM app.avatar_cleanup_queue WHERE path=NEW.avatar_path; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER profiles_avatar_commit_cleanup AFTER UPDATE OF avatar_path ON public.profiles
FOR EACH ROW EXECUTE FUNCTION app.finish_committed_avatar_upload();
REVOKE ALL ON FUNCTION app.finish_committed_avatar_upload(),public.queue_account_avatar_upload(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.queue_account_avatar_upload(uuid,text) TO service_role;
NOTIFY pgrst,'reload schema';
