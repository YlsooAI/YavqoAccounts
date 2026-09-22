-- Apply before deploying the OAuth passkey step-up flow.
-- One-time, short-lived request records prevent a verified passkey session
-- from being reused to approve the same consent form again.
create table if not exists public.id_oauth_passkey_challenges (
  nonce uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '10 minutes',
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists id_oauth_passkey_challenges_expiry_idx
  on public.id_oauth_passkey_challenges (expires_at);

alter table public.id_oauth_passkey_challenges enable row level security;
revoke all on table public.id_oauth_passkey_challenges from public, anon, authenticated;
grant select, insert on table public.id_oauth_passkey_challenges to authenticated;
grant update (consumed_at) on table public.id_oauth_passkey_challenges to authenticated;

drop policy if exists "Users can read own OAuth passkey challenges"
  on public.id_oauth_passkey_challenges;
create policy "Users can read own OAuth passkey challenges"
  on public.id_oauth_passkey_challenges for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create own OAuth passkey challenges"
  on public.id_oauth_passkey_challenges;
create policy "Users can create own OAuth passkey challenges"
  on public.id_oauth_passkey_challenges for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- Authenticated users may only mark their own live challenge as consumed;
-- they cannot edit the owner, nonce or expiration, nor reset a consumed row.
drop policy if exists "Users can consume own OAuth passkey challenges"
  on public.id_oauth_passkey_challenges;
create policy "Users can consume own OAuth passkey challenges"
  on public.id_oauth_passkey_challenges for update
  to authenticated
  using ((select auth.uid()) = user_id and consumed_at is null and expires_at > now())
  with check ((select auth.uid()) = user_id and consumed_at is not null);

drop function if exists public.oauth_consume_passkey_challenge(uuid);

notify pgrst, 'reload schema';
