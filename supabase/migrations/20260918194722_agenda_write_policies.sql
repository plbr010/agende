CREATE POLICY professional_working_hours_insert_manager_or_own
  ON public.professional_working_hours
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT app.has_workspace_role(
      workspace_id,
      VARIADIC ARRAY['owner'::public.member_role, 'admin'::public.member_role]
    ))
    OR (
      professional_member_id IN (
        SELECT m.id
        FROM public.workspace_members m
        WHERE m.user_id = (SELECT auth.uid())
          AND m.workspace_id = professional_working_hours.workspace_id
          AND m.status = 'active'
          AND m.role = 'professional'::public.member_role
      )
    )
  );

CREATE POLICY professional_working_hours_update_manager_or_own
  ON public.professional_working_hours
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT app.has_workspace_role(
      workspace_id,
      VARIADIC ARRAY['owner'::public.member_role, 'admin'::public.member_role]
    ))
    OR (
      professional_member_id IN (
        SELECT m.id
        FROM public.workspace_members m
        WHERE m.user_id = (SELECT auth.uid())
          AND m.workspace_id = professional_working_hours.workspace_id
          AND m.status = 'active'
          AND m.role = 'professional'::public.member_role
      )
    )
  )
  WITH CHECK (
    (SELECT app.has_workspace_role(
      workspace_id,
      VARIADIC ARRAY['owner'::public.member_role, 'admin'::public.member_role]
    ))
    OR (
      professional_member_id IN (
        SELECT m.id
        FROM public.workspace_members m
        WHERE m.user_id = (SELECT auth.uid())
          AND m.workspace_id = professional_working_hours.workspace_id
          AND m.status = 'active'
          AND m.role = 'professional'::public.member_role
      )
    )
  );

CREATE POLICY professional_working_hours_delete_manager_or_own
  ON public.professional_working_hours
  FOR DELETE
  TO authenticated
  USING (
    (SELECT app.has_workspace_role(
      workspace_id,
      VARIADIC ARRAY['owner'::public.member_role, 'admin'::public.member_role]
    ))
    OR (
      professional_member_id IN (
        SELECT m.id
        FROM public.workspace_members m
        WHERE m.user_id = (SELECT auth.uid())
          AND m.workspace_id = professional_working_hours.workspace_id
          AND m.status = 'active'
          AND m.role = 'professional'::public.member_role
      )
    )
  );

CREATE POLICY professional_breaks_insert_manager_or_own
  ON public.professional_breaks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT app.has_workspace_role(
      workspace_id,
      VARIADIC ARRAY['owner'::public.member_role, 'admin'::public.member_role]
    ))
    OR (
      professional_member_id IN (
        SELECT m.id
        FROM public.workspace_members m
        WHERE m.user_id = (SELECT auth.uid())
          AND m.workspace_id = professional_breaks.workspace_id
          AND m.status = 'active'
          AND m.role = 'professional'::public.member_role
      )
    )
  );

CREATE POLICY professional_breaks_update_manager_or_own
  ON public.professional_breaks
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT app.has_workspace_role(
      workspace_id,
      VARIADIC ARRAY['owner'::public.member_role, 'admin'::public.member_role]
    ))
    OR (
      professional_member_id IN (
        SELECT m.id
        FROM public.workspace_members m
        WHERE m.user_id = (SELECT auth.uid())
          AND m.workspace_id = professional_breaks.workspace_id
          AND m.status = 'active'
          AND m.role = 'professional'::public.member_role
      )
    )
  )
  WITH CHECK (
    (SELECT app.has_workspace_role(
      workspace_id,
      VARIADIC ARRAY['owner'::public.member_role, 'admin'::public.member_role]
    ))
    OR (
      professional_member_id IN (
        SELECT m.id
        FROM public.workspace_members m
        WHERE m.user_id = (SELECT auth.uid())
          AND m.workspace_id = professional_breaks.workspace_id
          AND m.status = 'active'
          AND m.role = 'professional'::public.member_role
      )
    )
  );

CREATE POLICY professional_breaks_delete_manager_or_own
  ON public.professional_breaks
  FOR DELETE
  TO authenticated
  USING (
    (SELECT app.has_workspace_role(
      workspace_id,
      VARIADIC ARRAY['owner'::public.member_role, 'admin'::public.member_role]
    ))
    OR (
      professional_member_id IN (
        SELECT m.id
        FROM public.workspace_members m
        WHERE m.user_id = (SELECT auth.uid())
          AND m.workspace_id = professional_breaks.workspace_id
          AND m.status = 'active'
          AND m.role = 'professional'::public.member_role
      )
    )
  );

CREATE POLICY professional_time_blocks_insert_staff_or_own
  ON public.professional_time_blocks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT app.has_workspace_role(
      workspace_id,
      VARIADIC ARRAY[
        'owner'::public.member_role,
        'admin'::public.member_role,
        'receptionist'::public.member_role
      ]
    ))
    OR (
      professional_member_id IN (
        SELECT m.id
        FROM public.workspace_members m
        WHERE m.user_id = (SELECT auth.uid())
          AND m.workspace_id = professional_time_blocks.workspace_id
          AND m.status = 'active'
          AND m.role = 'professional'::public.member_role
      )
    )
  );

CREATE POLICY professional_time_blocks_update_staff_or_own
  ON public.professional_time_blocks
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT app.has_workspace_role(
      workspace_id,
      VARIADIC ARRAY[
        'owner'::public.member_role,
        'admin'::public.member_role,
        'receptionist'::public.member_role
      ]
    ))
    OR (
      professional_member_id IN (
        SELECT m.id
        FROM public.workspace_members m
        WHERE m.user_id = (SELECT auth.uid())
          AND m.workspace_id = professional_time_blocks.workspace_id
          AND m.status = 'active'
          AND m.role = 'professional'::public.member_role
      )
    )
  )
  WITH CHECK (
    (SELECT app.has_workspace_role(
      workspace_id,
      VARIADIC ARRAY[
        'owner'::public.member_role,
        'admin'::public.member_role,
        'receptionist'::public.member_role
      ]
    ))
    OR (
      professional_member_id IN (
        SELECT m.id
        FROM public.workspace_members m
        WHERE m.user_id = (SELECT auth.uid())
          AND m.workspace_id = professional_time_blocks.workspace_id
          AND m.status = 'active'
          AND m.role = 'professional'::public.member_role
      )
    )
  );

CREATE POLICY professional_time_blocks_delete_staff_or_own
  ON public.professional_time_blocks
  FOR DELETE
  TO authenticated
  USING (
    (SELECT app.has_workspace_role(
      workspace_id,
      VARIADIC ARRAY[
        'owner'::public.member_role,
        'admin'::public.member_role,
        'receptionist'::public.member_role
      ]
    ))
    OR (
      professional_member_id IN (
        SELECT m.id
        FROM public.workspace_members m
        WHERE m.user_id = (SELECT auth.uid())
          AND m.workspace_id = professional_time_blocks.workspace_id
          AND m.status = 'active'
          AND m.role = 'professional'::public.member_role
      )
    )
  );
