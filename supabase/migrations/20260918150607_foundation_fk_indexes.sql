CREATE INDEX subscriptions_plan_idx ON public.subscriptions (plan);
CREATE INDEX workspace_invites_accepted_by_idx ON public.workspace_invites (accepted_by);
CREATE INDEX workspace_invites_created_by_idx ON public.workspace_invites (created_by);
