-- Supabase grants EXECUTE directly to anon through default privileges.
-- Revoking only PUBLIC does not remove that grant.
revoke execute on function
  public.is_admin(),
  public.save_configuration(uuid, integer, text, jsonb),
  public.my_workshops(),
  public.join_workshop(text),
  public.submit_configuration(uuid, uuid),
  public.review_submission(uuid)
from anon;
