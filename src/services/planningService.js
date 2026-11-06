const { getClient } = require("../config/supabase");
const { toDateOnlyString } = require("./dateUtils");
const { SAVINGS_WITHDRAW_THRESHOLD } = require("../config/constants");

const ALLOWED_TYPES = ["specific", "saving", "emergency"];

function requiresTarget(type) {
  return type === "specific" || type === "emergency";
}

async function getPlanningItems(userId, type = null) {
  const supabase = getClient();
  let query = supabase
    .from("planning_items")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (type) {
    if (!ALLOWED_TYPES.includes(type)) throw new Error("Jenis planning tidak valid.");
    query = query.eq("type", type);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function getSavingItems(userId) {
  return getPlanningItems(userId, "saving");
}

async function withdrawForExpense(userId, { planningId, items, date }) {
  const supabase = getClient();
  const normalizedDate = toDateOnlyString(date instanceof Date ? date : new Date(date || Date.now()));

  try {
    const { data, error } = await supabase.rpc("withdraw_savings_for_expense", {
      p_user_id: userId,
      p_planning_id: planningId,
      p_date: normalizedDate,
      p_items: items,
      p_threshold: SAVINGS_WITHDRAW_THRESHOLD,
    });

    if (error) {
      // Error dari Postgres/RPC (RAISE EXCEPTION membawa error.message berbahasa Indonesia)
      throw new Error(error.message || "Gagal melakukan penarikan tabungan.");
    }

    return data;
  } catch (err) {
    if (err && err.message) {
      throw err;
    }
    throw new Error("Gagal melakukan penarikan tabungan.");
  }
}

async function undoWithdrawal(userId, withdrawalId) {
  const supabase = getClient();

  try {
    const { data, error } = await supabase.rpc("undo_savings_withdrawal", {
      p_user_id: userId,
      p_withdrawal_id: withdrawalId,
    });

    if (error) {
      throw new Error(error.message || "Gagal membatalkan penarikan tabungan.");
    }

    return data;
  } catch (err) {
    if (err && err.message) {
      throw err;
    }
    throw new Error("Gagal membatalkan penarikan tabungan.");
  }
}

async function createPlanningItem(userId, payload) {
  const supabase = getClient();
  const { type, title, targetAmount, deadline = null } = payload;

  if (!ALLOWED_TYPES.includes(type)) {
    throw new Error("Jenis planning tidak valid.");
  }
  if (!title?.trim()) {
    throw new Error("Nama planning wajib diisi.");
  }

  let target = null;
  const hasTargetInput = targetAmount != null && targetAmount !== "";

  if (requiresTarget(type)) {
    target = Number(targetAmount);
    if (!Number.isFinite(target) || target <= 0) {
      throw new Error("Target harus lebih besar dari 0.");
    }
  } else if (hasTargetInput) {
    // type "saving": target opsional, tapi kalau diisi tetap divalidasi
    target = Number(targetAmount);
    if (!Number.isFinite(target) || target <= 0) {
      throw new Error("Kalau diisi, target harus lebih besar dari 0.");
    }
  }

  const { data, error } = await supabase
    .from("planning_items")
    .insert({
      user_id: userId,
      type,
      title: title.trim(),
      target_amount: target,
      saved_amount: 0,
      deadline: type === "specific" ? deadline : null,
      is_done: false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function addProgress(userId, id, amount) {
  const supabase = getClient();
  const addedAmount = Number(amount);
  if (!Number.isFinite(addedAmount) || addedAmount <= 0) {
    throw new Error("Jumlah tabungan tidak valid.");
  }

  const { data: item, error: findError } = await supabase
    .from("planning_items")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (findError) throw findError;

  const target = item.target_amount != null ? Number(item.target_amount) : null;
  const rawNewAmount = Number(item.saved_amount || 0) + addedAmount;
  const finalAmount = target != null ? Math.min(rawNewAmount, target) : rawNewAmount;
  const isDone = target != null ? finalAmount >= target : false;

  const { data, error } = await supabase
    .from("planning_items")
    .update({ saved_amount: finalAmount, is_done: isDone })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function deletePlanningItem(userId, id) {
  const supabase = getClient();
  const { error } = await supabase
    .from("planning_items")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
  return true;
}

module.exports = {
  ALLOWED_TYPES,
  getPlanningItems,
  getSavingItems,
  withdrawForExpense,
  undoWithdrawal,
  createPlanningItem,
  addProgress,
  deletePlanningItem,
};