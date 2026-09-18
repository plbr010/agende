-- Cover composite FKs and merge overlapping permissive policies from the catalog module.
-- Does not rewrite previously applied migrations.

CREATE INDEX professional_services_member_workspace_idx
  ON public.professional_services (professional_member_id, workspace_id);

CREATE INDEX professional_services_service_workspace_idx
  ON public.professional_services (service_id, workspace_id);

DROP POLICY professional_profiles_update_owner_admin ON public.professional_profiles;
DROP POLICY professional_profiles_update_own ON public.professional_profiles;

CREATE POLICY professional_profiles_update_manager_or_own
  ON public.professional_profiles
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT app.has_workspace_role(
      workspace_id,
      VARIADIC ARRAY['owner'::public.member_role, 'admin'::public.member_role]
    ))
    OR member_id IN (
      SELECT m.id
      FROM public.workspace_members m
      WHERE m.user_id = (SELECT auth.uid())
        AND m.status = 'active'
        AND m.role IN ('owner'::public.member_role, 'admin'::public.member_role, 'professional'::public.member_role)
    )
  )
  WITH CHECK (
    (SELECT app.has_workspace_role(
      workspace_id,
      VARIADIC ARRAY['owner'::public.member_role, 'admin'::public.member_role]
    ))
    OR member_id IN (
      SELECT m.id
      FROM public.workspace_members m
      WHERE m.user_id = (SELECT auth.uid())
        AND m.status = 'active'
        AND m.role IN ('owner'::public.member_role, 'admin'::public.member_role, 'professional'::public.member_role)
    )
  );

DROP POLICY profiles_select_own ON public.profiles;
DROP POLICY profiles_select_workspace_colleague ON public.profiles;

CREATE POLICY profiles_select_self_or_colleague
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.workspace_members me
      JOIN public.workspace_members them
        ON them.workspace_id = me.workspace_id
      WHERE me.user_id = (SELECT auth.uid())
        AND me.status = 'active'
        AND them.user_id = profiles.user_id
    )
  );
