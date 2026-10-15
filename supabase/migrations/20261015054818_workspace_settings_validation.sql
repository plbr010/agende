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
