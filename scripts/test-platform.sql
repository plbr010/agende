-- Synthetic Auth/Storage/Cron interfaces used only in isolated test databases.
-- No real Auth server, email delivery, Storage API or scheduler is provided.
create schema auth; create schema extensions; create schema storage; create schema cron;
    create table auth.users (
      id uuid primary key, instance_id uuid, aud text, role text, email text,
      encrypted_password text, email_confirmed_at timestamptz,
      raw_app_meta_data jsonb default '{}', raw_user_meta_data jsonb default '{}',
      created_at timestamptz, updated_at timestamptz, confirmation_token text,
      recovery_token text, email_change_token_new text, email_change text,
      is_sso_user boolean, is_anonymous boolean, phone_confirmed_at timestamptz
    );
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
    $$;
    create function auth.role() returns text language sql stable as $$
      select nullif(current_setting('request.jwt.claim.role',true),'');
    $$;
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb;
    $$;
    grant usage on schema auth, extensions to anon, authenticated, service_role;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, metadata jsonb);
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon, authenticated, service_role;
    grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
    create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/'); $$;
    create table cron.job (jobid bigint generated always as identity primary key, jobname text, schedule text, command text);
    create function cron.schedule(text,text,text) returns bigint language sql as $$ insert into cron.job(jobname,schedule,command) values($1,$2,$3) returning jobid; $$;
    create function cron.unschedule(bigint) returns boolean language sql as $$ delete from cron.job where jobid=$1 returning true; $$;

