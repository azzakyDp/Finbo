-- 004_withdraw_savings_direct.sql
-- Fungsi penarikan tabungan langsung ke dompet (tutup minus / cadangan saldo)

create or replace function withdraw_savings_direct(
  p_user_id uuid,
  p_planning_id bigint,
  p_amount numeric,
  p_note text default 'Tarik tabungan'
) returns jsonb language plpgsql as $$
declare
  v_saved numeric;
  v_wid uuid := gen_random_uuid();
  v_date date := current_date;
begin
  if p_amount <= 0 then
    raise exception 'Nominal penarikan harus lebih dari 0.';
  end if;

  select saved_amount into v_saved from planning_items
   where id = p_planning_id and user_id = p_user_id and type in ('saving', 'emergency') for update;
  if not found then
    raise exception 'Tabungan tidak ditemukan atau bukan tipe simpanan/dana darurat.';
  end if;

  if v_saved < p_amount then
    raise exception 'Saldo tabungan tidak mencukupi (tersedia: Rp%).', to_char(v_saved, 'FM999,999,999,999');
  end if;

  -- 1. Tambah transaksi pemasukan ke dompet
  insert into transactions(user_id, date, type, amount, note, category, withdrawal_id)
  values (p_user_id, v_date, 'pemasukan', p_amount, coalesce(p_note, 'Tarik tabungan'), 'tarik_tabungan', v_wid);

  -- 2. Kurangi tabungan
  update planning_items
     set saved_amount = saved_amount - p_amount,
         is_done = false
   where id = p_planning_id;

  -- 3. Catat di savings_withdrawals
  insert into savings_withdrawals(id, user_id, planning_id, amount)
  values (v_wid, p_user_id, p_planning_id, p_amount);

  return jsonb_build_object(
    'withdrawal_id', v_wid,
    'amount', p_amount,
    'saved_after', v_saved - p_amount
  );
end $$;

revoke execute on function withdraw_savings_direct(uuid, bigint, numeric, text) from public, anon, authenticated;

