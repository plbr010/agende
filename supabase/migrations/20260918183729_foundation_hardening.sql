-- Foundation hardening: BR phone, invite email bind, concurrency-safe seats, least-privilege GRANTs.
-- Does not rewrite previously applied migrations.

CREATE OR REPLACE FUNCTION app.is_valid_br_national(p_national text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT
    CASE
      WHEN p_national ~ '^[1-9][0-9]9[0-9]{8}$' THEN true
      WHEN p_national ~ '^[1-9][0-9][2-9][0-9]{7}$' THEN true
      ELSE false
    END;
$$;

CREATE OR REPLACE FUNCTION app.normalize_phone(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  digits text;
  national text;
BEGIN
  digits := regexp_replace(coalesce(input, ''), '\D', '', 'g');
  IF digits = '' THEN
    RETURN NULL;
  END IF;

  -- Country code 55 only when the remainder is a valid 10/11-digit national number.
  -- This keeps DDD 55 (e.g. (55) 99999-9999) instead of treating it as +55.
  IF left(digits, 2) = '55' AND length(digits) >= 12 THEN
    national := substr(digits, 3);
    IF app.is_valid_br_national(national) THEN
      RETURN '+55' || national;
    END IF;
  END IF;

  IF app.is_valid_br_national(digits) THEN
    RETURN '+55' || digits;
  END IF;

  RETURN NULL;
END;
$$;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_phone_e164;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_phone_br_e164;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_phone_br_e164
  CHECK (
    phone IS NULL
    OR (
      phone ~ '^\+55[0-9]+$'
      AND app.is_valid_br_national(substr(phone, 4))
    )
  );

-- Trigger runs as the table owner so authenticated does not need EXECUTE on normalize_phone.
CREATE OR REPLACE FUNCTION app.protect_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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
