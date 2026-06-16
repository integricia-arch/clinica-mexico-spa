-- Trigger: notificar admins cuando un usuario nuevo se registra
-- Llama a la edge function notify-new-user via net.http_post

CREATE OR REPLACE FUNCTION auth.notify_new_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public, extensions
AS $$
DECLARE
  _url   text;
  _key   text;
  _body  jsonb;
BEGIN
  _url  := current_setting('app.supabase_url',  true);
  _key  := current_setting('app.service_role_key', true);

  -- fallback: leer de secrets si no están en config
  IF _url IS NULL OR _url = '' THEN
    _url := 'https://kyfkvdyxpvpiacyymldc.supabase.co';
  END IF;

  _body := jsonb_build_object(
    'user_id',    NEW.id,
    'email',      NEW.email,
    'full_name',  COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    'created_at', NEW.created_at
  );

  PERFORM net.http_post(
    url     := _url || '/functions/v1/notify-new-user',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || _key
    ),
    body    := _body
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- No bloquear el registro si el email falla
  RAISE WARNING '[notify_new_user_signup] Error al notificar: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_notify ON auth.users;
CREATE TRIGGER on_auth_user_created_notify
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auth.notify_new_user_signup();
