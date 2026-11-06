alter table transactions add column if not exists withdrawal_id uuid;
create index if not exists idx_tx_withdrawal on transactions(withdrawal_id) where withdrawal_id is not null;

create table if not exists savings_withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  planning_id bigint references planning_items(id) on delete set null,
  amount numeric not null check (amount > 0),
  created_at timestamptz default now()
);

create or replace function withdraw_savings_for_expense(
  p_user_id uuid, p_planning_id bigint, p_date date, p_items jsonb, p_threshold numeric default 30000
) returns jsonb language plpgsql as $$
declare
  v_saved numeric; v_saldo numeric; v_total numeric; v_short numeric; v_wid uuid := gen_random_uuid();
begin
  select saved_amount into v_saved from planning_items
   where id = p_planning_id and user_id = p_user_id and type = 'saving' for update;
  if not found then raise exception 'Tabungan tidak ditemukan atau bukan tipe simpanan.'; end if;

  select greatest(coalesce(sum(case when type = 'pemasukan' then amount else -amount end), 0), 0)
    into v_saldo from transactions where user_id = p_user_id;
  select coalesce(sum((i->>'amount')::numeric), 0) into v_total from jsonb_array_elements(p_items) i;

  if v_total <= 0 then raise exception 'Total pengeluaran tidak valid.'; end if;
  if v_saldo >= p_threshold then raise exception 'Saldo biasa masih di atas batas, gunakan /pengeluaran.'; end if;
  v_short := v_total - v_saldo;
  if v_short <= 0 then raise exception 'Saldo biasa cukup, gunakan /pengeluaran.'; end if;
  if v_saved < v_short then raise exception 'Saldo tabungan tidak cukup.'; end if;

  insert into transactions(user_id, date, type, amount, note, withdrawal_id)
  select p_user_id, p_date, 'pengeluaran', (i->>'amount')::numeric, coalesce(i->>'note', ''), v_wid
  from jsonb_array_elements(p_items) i;

  insert into transactions(user_id, date, type, amount, note, category, withdrawal_id)
  values (p_user_id, p_date, 'pemasukan', v_short, 'Tarik tabungan', 'tarik_tabungan', v_wid);

  update planning_items set saved_amount = saved_amount - v_short, is_done = false where id = p_planning_id;
  insert into savings_withdrawals(id, user_id, planning_id, amount) values (v_wid, p_user_id, p_planning_id, v_short);

  return jsonb_build_object('withdrawal_id', v_wid, 'total', v_total, 'saldo_used', v_saldo,
                            'from_savings', v_short, 'saved_after', v_saved - v_short);
end $$;

create or replace function undo_savings_withdrawal(p_user_id uuid, p_withdrawal_id uuid)
returns jsonb language plpgsql as $$
declare v_amount numeric; v_planning bigint;
begin
  select amount, planning_id into v_amount, v_planning from savings_withdrawals
   where id = p_withdrawal_id and user_id = p_user_id for update;
  if not found then raise exception 'Penarikan tabungan tidak ditemukan.'; end if;

  delete from transactions where withdrawal_id = p_withdrawal_id and user_id = p_user_id;
  if v_planning is not null then
    update planning_items
       set saved_amount = saved_amount + v_amount,
           is_done = (target_amount is not null and saved_amount + v_amount >= target_amount)
     where id = v_planning and user_id = p_user_id;
  end if;
  delete from savings_withdrawals where id = p_withdrawal_id;
  return jsonb_build_object('restored', v_amount, 'planning_id', v_planning);
end $$;

revoke execute on function withdraw_savings_for_expense(uuid, bigint, date, jsonb, numeric) from public, anon, authenticated;
revoke execute on function undo_savings_withdrawal(uuid, uuid) from public, anon, authenticated;