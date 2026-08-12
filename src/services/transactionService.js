// Akses transaksi database
const { getClient } = require("../config/supabase");
const { getDateRange, toDateOnlyString } = require("./dateUtils");

async function findOrCreateUserByChatId(chatId, name) {
  const supabase = getClient();
  const chatIdStr = String(chatId);

  const { data: existing, error: findErr } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_chat_id", chatIdStr)
    .maybeSingle();

  if (findErr) throw findErr;
  if (existing) return existing;

  const { data: created, error: createErr } = await supabase
    .from("users")
    .insert({ telegram_chat_id: chatIdStr, name: name || null })
    .select()
    .single();

  if (createErr) throw createErr;
  return created;
}

async function addTransaction({ userId, date, type, amount, note, category, idempotencyKey }) {
  const supabase = getClient();
  const normalizedDate = toDateOnlyString(date instanceof Date ? date : new Date(date));

  if (idempotencyKey) {
    const { data: existing, error: searchErr } = await supabase
      .from("transactions")
      .select("id")
      .eq("user_id", userId)
      .eq("note", note || "")
      .eq("amount", Number(amount))
      .eq("date", normalizedDate)
      .eq("type", type)
      .order("created_at", { ascending: false })
      .limit(1);

    if (searchErr) throw searchErr;
    if (existing && existing.length) {
      return existing[0];
    }
  }

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      date: normalizedDate,
      type,
      amount,
      note: note || "",
      category: category || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function addTransactions(userId, date, type, items) {
  const results = [];
  for (const item of items) {
    results.push(
      await addTransaction({
        userId,
        date,
        type,
        amount: item.amount,
        note: item.note,
        category: item.category,
        idempotencyKey: item.idempotencyKey,
      })
    );
  }
  return results;
}

async function getTransactions(userId, range = "all") {
  const supabase = getClient();

  let query = supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  const dateRange = getDateRange(range);

  if (dateRange) {
    query = query.gte("date", dateRange.start).lte("date", dateRange.end);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function getTotals(userId, range = "all") {
  const rows = await getTransactions(userId, range);

  const totalPemasukan = rows
    .filter((r) => r.type === "pemasukan")
    .reduce((s, r) => s + Number(r.amount), 0);

  const totalPengeluaran = rows
    .filter((r) => r.type === "pengeluaran")
    .reduce((s, r) => s + Number(r.amount), 0);

  return {
    totalPemasukan,
    totalPengeluaran,
    saldo: totalPemasukan - totalPengeluaran,
  };
}

async function getExpenseReport(userId, range) {
  const rows = await getTransactions(userId, range);
  const expenses = rows.filter((r) => r.type === "pengeluaran");

  const total = expenses.reduce((sum, r) => sum + Number(r.amount), 0);

  const items = expenses.map((r) => ({
    id: r.id,
    date: r.date,
    note: r.note || "Tanpa nama",
    amount: Number(r.amount),
    category: r.category || null,
  }));

  return {
    total,
    count: items.length,
    items,
  };
}

async function deleteLastTransaction(userId) {
  const supabase = getClient();

  const { data: rows, error: findErr } = await supabase
    .from("transactions")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (findErr) throw findErr;
  if (!rows || rows.length === 0) return null;

  const { error: delErr } = await supabase
    .from("transactions")
    .delete()
    .eq("id", rows[0].id)
    .eq("user_id", userId);

  if (delErr) throw delErr;
  return rows[0];
}

async function deleteTransactionById(userId, id) {
  const supabase = getClient();
  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;
  return true;
}

module.exports = {
  findOrCreateUserByChatId,
  addTransaction,
  addTransactions,
  getTransactions,
  getTotals,
  getExpenseReport,
  deleteLastTransaction,
  deleteTransactionById,
};
