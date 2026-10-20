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
