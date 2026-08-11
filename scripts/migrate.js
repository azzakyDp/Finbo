// scripts/migrate.js
// Migrasi data lama dari keuangan_ran.xlsx ke Supabase.
// Jalankan sekali manual: node scripts/migrate.js
//
// Sebelum jalan, pastikan:
// 1. .env sudah diisi SUPABASE_URL & SUPABASE_KEY
// 2. keuangan_ran.xlsx ada di folder ini (atau ubah EXCEL_PATH di bawah)
// 3. Ganti TELEGRAM_CHAT_ID di bawah dengan chat_id Telegram kamu

require("dotenv").config();
const path = require("path");
const XLSX = require("xlsx");
const { getClient } = require("../src/config/supabase");

const EXCEL_PATH = path.join(__dirname, "..", "keuangan_ran.xlsx");
const TELEGRAM_CHAT_ID = process.env.MIGRATE_CHAT_ID || "GANTI_DENGAN_CHAT_ID_KAMU";

async function main() {
  const supabase = getClient();

  console.log("📖 Membaca", EXCEL_PATH);
  const wb = XLSX.readFile(EXCEL_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
  console.log(`   Ditemukan ${rows.length} baris.`);

  if (TELEGRAM_CHAT_ID === "GANTI_DENGAN_CHAT_ID_KAMU") {
    console.error(
      "❌ Set MIGRATE_CHAT_ID di .env dulu dengan chat_id Telegram kamu sebelum migrasi."
    );
    process.exit(1);
  }

  console.log("👤 Mencari/membuat user...");
  let { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_chat_id", String(TELEGRAM_CHAT_ID))
    .maybeSingle();

  if (!user) {
    const { data: created, error } = await supabase
      .from("users")
      .insert({ telegram_chat_id: String(TELEGRAM_CHAT_ID) })
      .select()
      .single();
    if (error) throw error;
    user = created;
  }
  console.log("   user_id:", user.id);

  const payload = rows
    .filter((r) => r.date && r.type && r.amount)
    .map((r) => ({
      user_id: user.id,
      date: new Date(r.date).toISOString().slice(0, 10),
      type: r.type,
      amount: Number(r.amount),
      note: r.note || "",
    }));

  console.log(`💾 Menyimpan ${payload.length} transaksi ke Supabase...`);
  const { error: insertErr } = await supabase.from("transactions").insert(payload);
  if (insertErr) throw insertErr;

  console.log("✅ Migrasi selesai.");
}

main().catch((err) => {
  console.error("❌ Migrasi gagal:", err.message);
  process.exit(1);
});
