-- Additive service write contract. Approval required before production rollout.
-- Saves service and professional links in one transaction; never deletes rows.
-- Depends on the observed membership lock reproduced by 20261009172028.
CREATE FUNCTION app.save_service_with_professionals(
  p_workspace_id uuid, p_service_id uuid, p_name text, p_description text,
  p_duration_minutes integer, p_price_cents integer, p_active boolean,
  p_professional_member_ids uuid[]
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_uid uuid;
  v_service_id uuid;
  v_members uuid[];
BEGIN
  v_uid := app.require_workspace_manager(p_workspace_id);
  PERFORM app.lock_workspace_membership(p_workspace_id);
  IF p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 2 AND 80
     OR char_length(p_description) > 500
     OR p_duration_minutes IS NULL OR p_duration_minutes NOT BETWEEN 5 AND 480
     OR p_price_cents IS NULL OR p_price_cents NOT BETWEEN 0 AND 10000000
     OR p_active IS NULL THEN
    RAISE EXCEPTION 'invalid_service' USING ERRCODE='22023';
  END IF;
  IF p_professional_member_ids IS NULL OR cardinality(p_professional_member_ids) NOT BETWEEN 1 AND 100
     OR array_position(p_professional_member_ids,NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'invalid_professionals' USING ERRCODE='22023';
  END IF;
  SELECT array_agg(DISTINCT member_id) INTO v_members FROM unnest(p_professional_member_ids) member_id;
  IF (SELECT count(*) FROM public.professional_profiles p
      JOIN public.workspace_members m ON m.id=p.member_id AND m.workspace_id=p.workspace_id
      WHERE p.workspace_id=p_workspace_id AND p.member_id=ANY(v_members)
        AND m.status='active' AND m.role IN ('owner','admin','professional')) <> cardinality(v_members) THEN
    RAISE EXCEPTION 'professional_not_found' USING ERRCODE='42501';
  END IF;
  IF p_service_id IS NULL THEN
    INSERT INTO public.services(workspace_id,name,description,duration_minutes,price_cents,active,created_by)
    VALUES(p_workspace_id,btrim(p_name),nullif(btrim(p_description),''),p_duration_minutes,p_price_cents,p_active,v_uid)
    RETURNING id INTO v_service_id;
  ELSE
    SELECT id INTO v_service_id FROM public.services
      WHERE id=p_service_id AND workspace_id=p_workspace_id AND archived_at IS NULL FOR UPDATE;
    IF v_service_id IS NULL THEN RAISE EXCEPTION 'service_not_found' USING ERRCODE='42501'; END IF;
    UPDATE public.services SET name=btrim(p_name),description=nullif(btrim(p_description),''),
      duration_minutes=p_duration_minutes,price_cents=p_price_cents,active=p_active
      WHERE id=v_service_id AND workspace_id=p_workspace_id;
  END IF;
  UPDATE public.professional_services SET active=(professional_member_id=ANY(v_members))
    WHERE workspace_id=p_workspace_id AND service_id=v_service_id;
  INSERT INTO public.professional_services(workspace_id,professional_member_id,service_id,active)
    SELECT p_workspace_id,member_id,v_service_id,true FROM unnest(v_members) member_id
    ON CONFLICT (professional_member_id,service_id) DO UPDATE SET active=true;
  RETURN v_service_id;
END;
$$;
REVOKE ALL ON FUNCTION app.save_service_with_professionals(uuid,uuid,text,text,integer,integer,boolean,uuid[]) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.save_service_with_professionals(
  p_workspace_id uuid, p_service_id uuid, p_name text, p_description text,
  p_duration_minutes integer, p_price_cents integer, p_active boolean,
  p_professional_member_ids uuid[]
)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  SELECT app.save_service_with_professionals(p_workspace_id,p_service_id,p_name,p_description,
    p_duration_minutes,p_price_cents,p_active,p_professional_member_ids);
$$;
REVOKE ALL ON FUNCTION public.save_service_with_professionals(uuid,uuid,text,text,integer,integer,boolean,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_service_with_professionals(uuid,uuid,text,text,integer,integer,boolean,uuid[]) TO authenticated;
COMMENT ON FUNCTION public.save_service_with_professionals(uuid,uuid,text,text,integer,integer,boolean,uuid[]) IS
  'Atomic manager-only service and professional links. Confirmed membership, tenant scope, entitlement and empty search_path. No deletion.';
NOTIFY pgrst, 'reload schema';
