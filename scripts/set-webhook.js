// Jalankan SEKALI setelah tiap deploy Vercel (atau kalau domain berubah):
//   node scripts/set-webhook.js
//
// Telegram tidak tahu URL webhook kita secara otomatis — ini yang
// memberitahunya. Tanpa ini, bot tidak akan menerima pesan sama sekali
// saat berjalan di Vercel (mode webhook, bukan polling).

require("dotenv").config();
const { Telegraf } = require("telegraf");

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DASHBOARD_URL = process.env.DASHBOARD_URL;

async function main() {
  if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN belum diset di .env");
  if (!DASHBOARD_URL) throw new Error("DASHBOARD_URL belum diset di .env");
  if (!DASHBOARD_URL.startsWith("https://")) {
    throw new Error("DASHBOARD_URL harus HTTPS (domain Vercel kamu)");
  }

  const bot = new Telegraf(BOT_TOKEN);
  const webhookUrl = `${DASHBOARD_URL}/api/telegram-webhook`;

  await bot.telegram.setWebhook(webhookUrl);
  const info = await bot.telegram.getWebhookInfo();

  console.log("Webhook terdaftar:", webhookUrl);
  console.log(info);
}

main().catch((err) => {
  console.error("Gagal set webhook:", err.message);
  process.exit(1);
});
