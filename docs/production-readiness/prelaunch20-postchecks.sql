-- Run only after the separately authorized migration transaction commits.
-- Read-only catalog gates; behavioral authorization still requires smoke tests.
BEGIN READ ONLY;
SELECT 'public_booking_no_anon' AS gate, NOT has_function_privilege('anon','public.create_public_appointment(text,uuid,uuid,timestamptz,text,text,text,text,text)','EXECUTE') AS passed
UNION ALL SELECT 'public_booking_authenticated',has_function_privilege('authenticated','public.create_public_appointment(text,uuid,uuid,timestamptz,text,text,text,text,text)','EXECUTE')
UNION ALL SELECT 'private_booking_no_direct_authenticated',NOT has_function_privilege('authenticated','app.create_public_appointment(text,uuid,uuid,timestamptz,text,text,text,text,text)','EXECUTE')
UNION ALL SELECT 'confirmed_gate_no_guest_fallback',EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='app' AND p.proname='create_public_appointment' AND p.prosrc LIKE '%app.require_confirmed_email()%' AND p.prosrc LIKE '%email_not_confirmed%' AND p.prosrc NOT LIKE '%v_uid := NULL%' AND p.prosrc NOT LIKE '%v_uid := null%')
UNION ALL SELECT 'internal_team_rpc_preserved',has_function_privilege('authenticated','public.create_appointment(uuid,uuid,uuid,uuid,timestamptz,text)','EXECUTE')
UNION ALL SELECT 'public_tables_rls',NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity)
UNION ALL SELECT 'private_cleanup_forced',count(*)=3 AND bool_and(c.relrowsecurity AND c.relforcerowsecurity) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app' AND c.relname IN ('workspace_image_cleanup','professional_photo_cleanup','avatar_cleanup_queue')
UNION ALL SELECT 'photo_bucket_private',EXISTS(SELECT 1 FROM storage.buckets WHERE id='professional-photos' AND NOT public AND file_size_limit=2097152 AND allowed_mime_types=ARRAY['image/webp'])
UNION ALL SELECT 'avatar_bucket_private',EXISTS(SELECT 1 FROM storage.buckets WHERE id='account-avatars' AND NOT public)
UNION ALL SELECT 'discovery_index_valid',EXISTS(SELECT 1 FROM pg_index WHERE indexrelid=to_regclass('public.workspace_settings_discovery_city') AND indisvalid AND indisready)
UNION ALL SELECT 'discovery_eligibility_body',EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='search_public_workspaces' AND p.prosrc LIKE '%professional_services%' AND p.prosrc LIKE '%ps.active AND svc.active%');
SELECT 'review_contract_forced' AS gate,EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('public.appointment_reviews') AND relrowsecurity AND relforcerowsecurity) AS passed
UNION ALL SELECT 'reschedule_slots_authenticated',COALESCE(has_function_privilege('authenticated',to_regprocedure('public.list_my_reschedule_slots(uuid,uuid,date)'),'EXECUTE'),false)
UNION ALL SELECT 'seat_reconciliation_guard',EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='app' AND p.proname='sync_billing_subscription' AND p.prosrc LIKE '%v_effective_status%');
SELECT p.proname,has_function_privilege('anon',p.oid,'EXECUTE') AS anon,has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated,has_function_privilege('service_role',p.oid,'EXECUTE') AS service_role
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('get_appointment_whatsapp','get_related_client_avatar','queue_professional_photo','swap_professional_photo','claim_professional_photo_cleanup','finish_professional_photo_cleanup','queue_workspace_image_upload','swap_workspace_image','claim_workspace_image_cleanup','finish_workspace_image_cleanup','get_public_workspace_cover','get_professional_photo') ORDER BY p.proname;
-- Phone/avatar RPCs: anon=false/authenticated=true; photo mutations/cleanup:
-- anon=false/authenticated=false/service_role=true; workspace mutations:
-- anon=false/authenticated=true; public cover/photo reads: anon=true.
SELECT workspace_id IS NOT NULL AS valid_workspace_reference,count(*) FROM public.workspace_settings GROUP BY 1;
COMMIT;
