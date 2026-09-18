CREATE OR REPLACE FUNCTION app.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_full_name text;
  v_phone text;
  v_intended public.signup_intent;
  v_terms timestamptz;
  v_privacy timestamptz;
BEGIN
  v_full_name := nullif(btrim(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), '');
  v_phone := app.normalize_phone(COALESCE(NEW.raw_user_meta_data->>'phone', ''));

  IF NEW.raw_user_meta_data->>'intended_use' = 'professional' THEN
    v_intended := 'professional';
  ELSE
    v_intended := 'client';
  END IF;

  IF COALESCE((NEW.raw_user_meta_data->>'terms_accepted')::boolean, false) THEN
    v_terms := COALESCE(NEW.created_at, now());
  END IF;
  IF COALESCE((NEW.raw_user_meta_data->>'privacy_accepted')::boolean, false) THEN
    v_privacy := COALESCE(NEW.created_at, now());
  END IF;

  INSERT INTO public.profiles (
    user_id,
    full_name,
    email,
    phone,
    intended_use,
    terms_accepted_at,
    privacy_accepted_at
  ) VALUES (
    NEW.id,
    COALESCE(v_full_name, 'Usuário'),
    lower(btrim(NEW.email)),
    v_phone,
    v_intended,
    v_terms,
    v_privacy
  );

  IF v_intended = 'client' THEN
    INSERT INTO public.client_profiles (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app.sync_profile_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    PERFORM set_config('app.bypass_protected_columns', 'on', true);
    UPDATE public.profiles
    SET email = lower(btrim(NEW.email)),
        updated_at = now()
    WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
