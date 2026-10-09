-- Sync every student's Codeforces data every 3 hours via the `sync` edge function.
-- The shared secret is generated inside Postgres and kept in Supabase Vault; it never leaves the server.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select vault.create_secret(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 'rte_cron_secret')
where not exists (select 1 from vault.secrets where name = 'rte_cron_secret');

-- Lets the edge function (service role only) check the header without ever reading the secret.
create or replace function public.cron_secret_ok(s text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'rte_cron_secret' and decrypted_secret = s)
$$;
revoke execute on function public.cron_secret_ok(text) from public, anon, authenticated;
grant execute on function public.cron_secret_ok(text) to service_role;

select cron.schedule('codeforces-sync', '0 */3 * * *', $$
  select net.http_post(
    url := 'https://dnipidktyzcwxigckyqi.supabase.co/functions/v1/sync',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'rte_cron_secret')),
    body := '{"all": true}'::jsonb,
    timeout_milliseconds := 150000)
$$);
