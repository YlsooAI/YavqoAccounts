-- Yavqo Giftcard redemption setup — run once in the Supabase SQL editor.
-- Creates the `giftcard_codes` and `giftcard_balances` tables, strict RLS
-- policies, and the atomic `redeem_giftcard_code` RPC. Idempotent: safe to re-run.

-- 1) Giftcard codes table
create table if not exists public.giftcard_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'EUR',
  is_redeemed boolean not null default false,
  redeemed_by uuid references auth.users (id) on delete set null,
  redeemed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists giftcard_codes_redeemed_by_idx
  on public.giftcard_codes (redeemed_by, redeemed_at desc);

alter table public.giftcard_codes enable row level security;

revoke all on table public.giftcard_codes from anon, authenticated;
grant select on table public.giftcard_codes to authenticated;

drop policy if exists "Users can read own redeemed giftcard codes" on public.giftcard_codes;
create policy "Users can read own redeemed giftcard codes"
  on public.giftcard_codes for select
  to authenticated
  using ((select auth.uid()) = redeemed_by);

-- 2) Per-user giftcard balance table
create table if not exists public.giftcard_balances (
  user_id uuid primary key references auth.users (id) on delete cascade,
  balance_cents integer not null default 0 check (balance_cents >= 0),
  currency text not null default 'EUR',
  updated_at timestamptz not null default now()
);

alter table public.giftcard_balances enable row level security;

revoke all on table public.giftcard_balances from anon, authenticated;
grant select on table public.giftcard_balances to authenticated;

drop policy if exists "Users can read own giftcard balance" on public.giftcard_balances;
create policy "Users can read own giftcard balance"
  on public.giftcard_balances for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- 3) Atomic redemption RPC (SECURITY DEFINER so unredeemed codes stay hidden
--    and users cannot modify their own balance directly)
create or replace function public.redeem_giftcard_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_normalized text := upper(btrim(coalesce(p_code, '')));
  v_card public.giftcard_codes%rowtype;
  v_new_balance integer;
  v_now timestamptz := now();
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'You must be signed in to redeem a gift card.');
  end if;

  if v_normalized = '' then
    return jsonb_build_object('ok', false, 'error', 'Enter a gift card code.');
  end if;

  select *
    into v_card
    from public.giftcard_codes
   where upper(btrim(code)) = v_normalized
     for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Gift card code not found. Check the code and try again.');
  end if;

  if v_card.is_redeemed or v_card.redeemed_by is not null then
    return jsonb_build_object('ok', false, 'error', 'This gift card code has already been redeemed.');
  end if;

  if v_card.expires_at is not null and v_card.expires_at < v_now then
    return jsonb_build_object('ok', false, 'error', 'This gift card code has expired.');
  end if;

  update public.giftcard_codes
     set is_redeemed = true,
         redeemed_by = v_user_id,
         redeemed_at = v_now
   where id = v_card.id;

  insert into public.giftcard_balances (user_id, balance_cents, currency, updated_at)
  values (v_user_id, v_card.amount_cents, v_card.currency, v_now)
  on conflict (user_id) do update
    set balance_cents = public.giftcard_balances.balance_cents + excluded.balance_cents,
        updated_at = v_now
  returning balance_cents into v_new_balance;

  return jsonb_build_object(
    'ok', true,
    'id', v_card.id,
    'code', v_card.code,
    'amount_cents', v_card.amount_cents,
    'currency', v_card.currency,
    'balance_cents', v_new_balance,
    'redeemed_at', v_now
  );
end;
$$;

revoke all on function public.redeem_giftcard_code(text) from public, anon;
grant execute on function public.redeem_giftcard_code(text) to authenticated;
