-- Covering indexes for composite FKs and split FOR ALL write policies
-- so SELECT is a single permissive policy (Performance Advisor).

CREATE INDEX IF NOT EXISTS appointments_client_workspace_idx
  ON public.appointments (client_id, workspace_id);
CREATE INDEX IF NOT EXISTS appointments_professional_workspace_idx
  ON public.appointments (professional_member_id, workspace_id);
CREATE INDEX IF NOT EXISTS appointments_service_workspace_idx
  ON public.appointments (service_id, workspace_id);

CREATE INDEX IF NOT EXISTS professional_working_hours_member_workspace_idx
  ON public.professional_working_hours (professional_member_id, workspace_id);
CREATE INDEX IF NOT EXISTS professional_breaks_member_workspace_idx
  ON public.professional_breaks (professional_member_id, workspace_id);
CREATE INDEX IF NOT EXISTS professional_time_blocks_member_workspace_idx
  ON public.professional_time_blocks (professional_member_id, workspace_id);

DROP POLICY professional_working_hours_write_manager_or_own ON public.professional_working_hours;
DROP POLICY professional_breaks_write_manager_or_own ON public.professional_breaks;
DROP POLICY professional_time_blocks_write_staff_or_own ON public.professional_time_blocks;

