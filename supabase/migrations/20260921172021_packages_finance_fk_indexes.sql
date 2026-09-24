
create index if not exists service_packages_created_by_idx
  on public.service_packages(created_by);

create index if not exists service_package_items_package_workspace_idx
  on public.service_package_items(package_id, workspace_id);

create index if not exists client_packages_client_workspace_fk_idx
  on public.client_packages(client_id, workspace_id);

create index if not exists client_package_items_package_workspace_idx
  on public.client_package_items(client_package_id, workspace_id);

create index if not exists package_redemptions_appointment_workspace_idx
  on public.package_redemptions(appointment_id, workspace_id);
