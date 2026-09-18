CREATE OR REPLACE FUNCTION app.protect_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_setting('app.bypass_protected_columns', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'profile_user_id_immutable' USING ERRCODE = '42501';
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'profile_email_immutable' USING ERRCODE = '42501';
  END IF;
  IF NEW.intended_use IS DISTINCT FROM OLD.intended_use THEN
    RAISE EXCEPTION 'profile_intended_use_immutable' USING ERRCODE = '42501';
  END IF;
  IF NEW.terms_accepted_at IS DISTINCT FROM OLD.terms_accepted_at THEN
    RAISE EXCEPTION 'profile_terms_immutable' USING ERRCODE = '42501';
  END IF;
  IF NEW.privacy_accepted_at IS DISTINCT FROM OLD.privacy_accepted_at THEN
    RAISE EXCEPTION 'profile_privacy_immutable' USING ERRCODE = '42501';
  END IF;

  NEW.phone := app.normalize_phone(NEW.phone);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app.protect_workspace_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_setting('app.bypass_protected_columns', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
    RAISE EXCEPTION 'workspace_owner_immutable' USING ERRCODE = '42501';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'workspace_id_immutable' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app.protect_membership_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_setting('app.bypass_protected_columns', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'membership_identity_immutable' USING ERRCODE = '42501';
    END IF;
    IF NEW.role IS DISTINCT FROM OLD.role OR NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'membership_role_change_denied' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app.protect_subscription_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_setting('app.bypass_protected_columns', true) = 'on' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'subscription_mutation_denied' USING ERRCODE = '42501';
END;
$$;

CREATE OR REPLACE FUNCTION app.protect_trial_claim_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_setting('app.bypass_protected_columns', true) = 'on' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'trial_claim_mutation_denied' USING ERRCODE = '42501';
END;
$$;
