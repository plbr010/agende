-- Prepared locally. Production rollout requires separate authorization.
-- No backfill: managers must explicitly publish each establishment.
ALTER TABLE public.workspace_settings ADD COLUMN discovery_enabled boolean NOT NULL DEFAULT false;

CREATE FUNCTION app.discovery_text(p_text text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT translate(lower(btrim(coalesce(p_text,''))),
    'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');
$$;
CREATE INDEX workspace_settings_discovery_city ON public.workspace_settings
  (app.discovery_text(city), state, workspace_id) WHERE discovery_enabled;

CREATE FUNCTION public.get_workspace_discovery(p_workspace_id uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM app.require_confirmed_email();
  IF NOT app.has_workspace_role(p_workspace_id,VARIADIC ARRAY['owner'::public.member_role,'admin'::public.member_role]) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';
  END IF;
  RETURN (SELECT discovery_enabled FROM public.workspace_settings WHERE workspace_id=p_workspace_id);
END;
$$;
CREATE FUNCTION public.set_workspace_discovery(p_workspace_id uuid, p_enabled boolean) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM app.lock_workspace_membership(p_workspace_id);
  PERFORM app.require_confirmed_email();
  IF NOT app.has_workspace_role(p_workspace_id,VARIADIC ARRAY['owner'::public.member_role,'admin'::public.member_role]) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';
  END IF;
  IF p_enabled IS NULL THEN RAISE EXCEPTION 'invalid_discovery_input' USING ERRCODE='22023'; END IF;
  IF p_enabled THEN
    PERFORM app.assert_workspace_entitled(p_workspace_id);
    IF NOT EXISTS (SELECT 1 FROM public.workspace_settings WHERE workspace_id=p_workspace_id
      AND city IS NOT NULL AND state IS NOT NULL) THEN
      RAISE EXCEPTION 'discovery_locality_required' USING ERRCODE='22023';
    END IF;
  END IF;
  UPDATE public.workspace_settings SET discovery_enabled=p_enabled, updated_at=now()
    WHERE workspace_id=p_workspace_id;
  RETURN p_enabled;
END;
$$;

CREATE FUNCTION public.search_public_workspaces(
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
          SELECT 1 FROM public.professional_profiles pp JOIN public.workspace_members m ON m.id=pp.member_id
          WHERE pp.workspace_id=w.id AND pp.booking_enabled AND m.status='active'
            AND m.role IN ('owner','admin','professional') AND strpos(app.discovery_text(pp.display_name),v_query)>0))
    ), page AS (SELECT * FROM eligible ORDER BY name COLLATE "C",slug LIMIT p_limit OFFSET p_offset)
    SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(to_jsonb(page) ORDER BY name COLLATE "C",slug) FROM page),'[]'::jsonb),
      'total',(SELECT count(*) FROM eligible))
  );
END;
$$;
CREATE FUNCTION public.list_public_localities(p_state text DEFAULT NULL,p_query text DEFAULT NULL,p_limit integer DEFAULT 8)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_query text:=app.discovery_text(p_query); v_state text:=nullif(upper(btrim(p_state)),'');
BEGIN
  IF char_length(v_query) NOT BETWEEN 2 AND 80 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50
    OR (v_state IS NOT NULL AND v_state !~ '^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$') THEN
    RAISE EXCEPTION 'invalid_discovery_input' USING ERRCODE='22023';
  END IF;
  RETURN (SELECT jsonb_build_object('localities',coalesce(jsonb_agg(to_jsonb(x) ORDER BY city COLLATE "C",state),'[]'::jsonb)) FROM (
    SELECT min(s.city COLLATE "C") city,s.state,count(*) workspace_count
    FROM public.workspace_settings s WHERE s.discovery_enabled AND s.city IS NOT NULL AND s.state IS NOT NULL
      AND app.workspace_has_entitlement(s.workspace_id) AND (v_state IS NULL OR s.state=v_state)
      AND strpos(app.discovery_text(s.city),v_query)>0
    GROUP BY app.discovery_text(s.city),s.state ORDER BY min(s.city COLLATE "C"),s.state LIMIT p_limit
  ) x);
END;
$$;
REVOKE ALL ON FUNCTION app.discovery_text(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_workspace_discovery(uuid),public.set_workspace_discovery(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_workspace_discovery(uuid),public.set_workspace_discovery(uuid,boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.search_public_workspaces(text,text,text,text,integer,integer),public.list_public_localities(text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_public_workspaces(text,text,text,text,integer,integer),public.list_public_localities(text,text,integer) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
