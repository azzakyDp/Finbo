// src/bot/telegramBot.js
// Telegram bot untuk pencatatan keuangan dengan alur percakapan sederhana.
// Command utama:
// /pemasukan       -> tambah pemasukan
// /pengeluaran     -> tambah pengeluaran
// /cek_saldo       -> lihat saldo
// /cek_pengeluaran -> lihat pengeluaran minggu/bulan
// /menu            -> bantuan
// /undo            -> batalkan transaksi terakhir

require("dotenv").config();
const { Telegraf } = require("telegraf");
const parserService = require("../services/parserService");
const txService = require("../services/transactionService");

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// State percakapan disimpan di memory. Cocok untuk 1 instance bot.
// Jika nanti deploy multi-instance/serverless, pindahkan state ke Redis/Supabase.
const sessions = new Map();

function formatRupiah(n) {
  return `Rp${Number(n || 0).toLocaleString("id-ID")}`;
}

function withIdempotency(items, ctx) {
  const baseKey = `${ctx.chat?.id ?? "unknown"}:${ctx.from?.id ?? "unknown"}:${ctx.message?.message_id ?? "manual"}`;
  return items.map((item, index) => ({
    ...item,
    idempotencyKey: `${baseKey}:${index}`,
  }));
}

function todayLabel() {
  return new Date().toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const MENU_TEXT = `*MENU BOT RAN*
  /pemasukan
Tambah uang masuk ke saldo.

/pengeluaran
Catat barang dan harga yang dibeli.

/cek_saldo
Lihat saldo, total pemasukan, dan pengeluaran.

/cek_pengeluaran
Lihat pengeluaran mingguan atau bulanan, lengkap dengan total biaya dan daftar barang.

/menu
Tampilkan menu ini.

/undo
Batalkan transaksi terakhir.

Kamu juga masih bisa mengetik format langsung, misalnya:
pemasukan = 500000 gaji
pengeluaran = 25000 makan + 10000 parkir`;

function clearSession(chatId) {
  sessions.delete(String(chatId));
}

function setSession(chatId, state) {
  sessions.set(String(chatId), state);
}

function getSession(chatId) {
  return sessions.get(String(chatId));
}

function parseAmountAndNote(text) {
  const raw = String(text || "").trim();

  // 500000 gaji
  let m = raw.match(/^rp?\s*([\d.,]+)\s*(?:[|=-]\s*)?(.*)$/i);
  if (m) {
    const amount = parserService.toNumber(m[1]);
    const note = (m[2] || "").trim();
    if (Number.isFinite(amount) && amount > 0) {
      return { amount, note };
    }
  }

  // gaji 500000
  m = raw.match(/^(.*?)\s+rp?\s*([\d.,]+)$/i);
  if (m) {
    const amount = parserService.toNumber(m[2]);
    const note = m[1].trim();
    if (Number.isFinite(amount) && amount > 0) {
      return { amount, note };
    }
  }

  return null;
}

function parseDateOptional(text) {
  const raw = String(text || "").trim();
  if (!raw) return new Date();

  const parsed = parserService.parseMessage(`pemasukan ${raw} = 1`);
  if (parsed.ok && parsed.date) return parsed.date;

  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return d;

  return null;
}

function formatDate(date) {
  return new Date(date).toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

async function ensureUser(ctx) {
  return txService.findOrCreateUserByChatId(
    ctx.chat.id,
    ctx.from?.first_name
  );
}

function createBot() {
  if (!BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN belum diset di .env");
  }

  const bot = new Telegraf(BOT_TOKEN);

  bot.start(async (ctx) => {
    clearSession(ctx.chat.id);
    await ctx.reply(
      "Halo! 👋 Saya Ran, pencatat keuanganmu.\n\n" +
      "Mau catat pemasukan, pengeluaran, atau cek saldo? " +
      "Ketik /menu untuk melihat semua pilihan."
    );
  });

  // Satu-satunya cara resmi Telegram mengisi window.Telegram.WebApp.initData
  // di sisi dashboard: user membuka URL lewat tombol bertipe web_app.
  // DASHBOARD_URL wajib HTTPS (ngrok saat development, domain asli saat production).
  bot.command("dashboard", async (ctx) => {
    const url = process.env.DASHBOARD_URL;
    if (!url) {
      return ctx.reply("DASHBOARD_URL belum diset di .env — minta admin mengisinya dulu.");
    }
    if (!url.startsWith("https://")) {
      return ctx.reply("DASHBOARD_URL harus HTTPS supaya Telegram mau membukanya sebagai Web App.");
    }
    return ctx.reply("Buka dashboard:", {
      reply_markup: {
        inline_keyboard: [[{ text: "Buka Dashboard", web_app: { url } }]],
      },
    });
  });

  bot.command("menu", async (ctx) => {
    clearSession(ctx.chat.id);
    await ctx.replyWithMarkdown(MENU_TEXT);
  });

  // =========================
  // PEMASUKAN
  // =========================
  bot.command("pemasukan", async (ctx) => {
    const args = ctx.message.text.replace(/^\/pemasukan(?:@\w+)?/i, "").trim();

    if (args) {
      const parsed = parserService.parseMessage(`pemasukan ${args}`);
      if (parsed.ok) {
        try {
          const user = await ensureUser(ctx);
          const added = await txService.addTransactions(
            user.id,
            parsed.date,
            "pemasukan",
            withIdempotency(parsed.items, ctx)
          );
          const totals = await txService.getTotals(user.id, "all");
          clearSession(ctx.chat.id);
          return ctx.reply(
            `Pemasukan berhasil dicatat.\n\n` +
            added.map((a) => `• ${a.note || "Pemasukan"} — ${formatRupiah(a.amount)}`).join("\n") +
            `\n ${formatDate(parsed.date)}\n Saldo sekarang: ${formatRupiah(totals.saldo)}`
          );
        } catch (err) {
          console.error(err);
          return ctx.reply(" Gagal menyimpan pemasukan: " + err.message);
        }
      }
    }

    setSession(ctx.chat.id, { type: "pemasukan", step: "amount" });
    await ctx.reply(
      "Siap, kita tambah pemasukan. \n\n" +
      "Mau menambahkan berapa?\n" +
      "Contoh: `500000` atau `500000 gaji`"
    );
  });

  // =========================
  // PENGELUARAN
  // =========================
  bot.command("pengeluaran", async (ctx) => {
    const args = ctx.message.text.replace(/^\/pengeluaran(?:@\w+)?/i, "").trim();

    if (args) {
      const parsed = parserService.parseMessage(`pengeluaran ${args}`);
      if (parsed.ok) {
        try {
          const user = await ensureUser(ctx);
          const added = await txService.addTransactions(
            user.id,
            parsed.date,
            "pengeluaran",
            withIdempotency(parsed.items, ctx)
          );
          const totals = await txService.getTotals(user.id, "all");
          clearSession(ctx.chat.id);
          return ctx.reply(
            `Pengeluaran berhasil dicatat.\n\n` +
            added.map((a) => `• ${a.note || "Barang"} — ${formatRupiah(a.amount)}`).join("\n") +
            `\n${formatDate(parsed.date)}\nSaldo sekarang: ${formatRupiah(totals.saldo)}`
          );
        } catch (err) {
          console.error(err);
          return ctx.reply(" Gagal menyimpan pengeluaran: " + err.message);
        }
      }
    }

    setSession(ctx.chat.id, { type: "pengeluaran", step: "items" });
    await ctx.reply(
      "Oke, kita catat pengeluaran. 🛒\n\n" +
      "Tulis barang dan harganya. Bisa satu atau beberapa sekaligus.\n\n" +
      "Contoh:\n" +
      "`beras 50000`\n" +
      "atau\n" +
      "`beras 50000 + telur 20000 + sabun 10000`\n\n" +
      "Tanggal boleh ditambahkan nanti. Kalau tidak disebutkan, Saya pakai hari ini."
    );
  });

  // =========================
  // CEK SALDO
  // =========================
  const saldoHandler = async (ctx) => {
    try {
      clearSession(ctx.chat.id);
      const user = await ensureUser(ctx);
      const totals = await txService.getTotals(user.id, "all");

      await ctx.reply(
        `*Saldo saat ini*\n\n` +
        `Saldo: ${formatRupiah(totals.saldo)}\n` +
        `Pemasukan: ${formatRupiah(totals.totalPemasukan)}\n` +
        `Pengeluaran: ${formatRupiah(totals.totalPengeluaran)}`,
        { parse_mode: "Markdown" }
      );
    } catch (err) {
      console.error(err);
      await ctx.reply(" Gagal mengambil saldo: " + err.message);
    }
  };

  bot.command("cek_saldo", saldoHandler);
  bot.command("saldo", saldoHandler);
  bot.command("cek", saldoHandler);

  // =========================
  // REKAP PENGELUARAN
  // =========================
  async function sendExpenseReport(ctx, range) {
    try {
      const user = await ensureUser(ctx);
      const rows = await txService.getTransactions(user.id, range);
      const expenses = rows.filter((r) => r.type === "pengeluaran");
      const total = expenses.reduce((sum, r) => sum + Number(r.amount), 0);

      const title =
        range === "weekly"
          ? "7 hari terakhir"
          : "bulan berjalan";

      if (expenses.length === 0) {
        return ctx.reply(
          `Belum ada pengeluaran untuk ${title}.`
        );
      }

      const lines = expenses.map((r, i) => {
        const date = new Date(r.date).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "2-digit",
        });
        return `${i + 1}. ${date} — ${r.note || "Tanpa nama"}: ${formatRupiah(r.amount)}`;
      });

      await ctx.reply(
        `*Pengeluaran ${title}*\n\n` +
        `Total biaya: *${formatRupiah(total)}*\n` +
        `Jumlah transaksi: ${expenses.length}\n\n` +
        `*Barang & biaya:*\n${lines.join("\n")}`,
        { parse_mode: "Markdown" }
      );
    } catch (err) {
      console.error(err);
      await ctx.reply(" Gagal mengambil pengeluaran: " + err.message);
    }
  }

  bot.command("cek_pengeluaran", async (ctx) => {
    const args = ctx.message.text
      .replace(/^\/cek_pengeluaran(?:@\w+)?/i, "")
      .trim()
      .toLowerCase();

    if (args.includes("bulan") || args.includes("monthly")) {
      return sendExpenseReport(ctx, "monthly");
    }

    if (args.includes("minggu") || args.includes("week")) {
      return sendExpenseReport(ctx, "weekly");
    }

    await ctx.reply(
      "Mau lihat yang mana?\n\n" +
      "• /cek_pengeluaran_minggu_ini\n" +
      "• /cek_pengeluaran_bulan_ini"
    );
  });

  // Alias agar lebih natural
  bot.command("pengeluaran_minggu_ini", (ctx) =>
    sendExpenseReport(ctx, "weekly")
  );
  bot.command("pengeluaran_bulan_ini", (ctx) =>
    sendExpenseReport(ctx, "monthly")
  );

  bot.command("rekap", async (ctx) => {
    await ctx.reply(
      "Untuk rekap pengeluaran, gunakan:\n" +
      "/cek_pengeluaran_minggu_ini\n" +
      "/cek_pengeluaran_bulan_ini"
    );
  });

  // =========================
  // UNDO
  // =========================
  bot.command("undo", async (ctx) => {
    try {
      const user = await ensureUser(ctx);
      const deleted = await txService.deleteLastTransaction(user.id);
      if (!deleted) {
        return ctx.reply("Belum ada transaksi yang bisa dibatalkan.");
      }
      await ctx.reply(`Transaksi #${deleted.id} sudah dibatalkan.`);
    } catch (err) {
      console.error(err);
      await ctx.reply(" Gagal membatalkan transaksi: " + err.message);
    }
  });

  // =========================
  // PESAN TEKS + STATE
  // =========================
  bot.on("text", async (ctx) => {
    const text = ctx.message.text.trim();
    if (!text || text.startsWith("/")) return;

    const session = getSession(ctx.chat.id);

    // Tahap pemasukan: nominal
    if (session?.type === "pemasukan" && session.step === "amount") {
      const parsed = parseAmountAndNote(text);

      if (!parsed) {
        return ctx.reply(
          "Nominalnya belum terbaca 😄\n" +
          "Coba tulis seperti `500000` atau `500000 gaji`."
        );
      }

      session.amount = parsed.amount;
      session.note = parsed.note || null;
      session.step = "date";
      setSession(ctx.chat.id, session);

      return ctx.reply(
        "Sip, sudah Saya catat nominalnya.\n" +
        "Uangnya dari mana? " +
        (session.note
          ? `Saya tangkap sebagai *${session.note}*.\n\n`
          : "Contoh: `gaji`, `transfer orang tua`, atau `bonus`.\n\n") +
        "Kalau mau pakai tanggal tertentu, tulis setelah sumber, misalnya:\n" +
        "`gaji | 08-08-2026`\n\n" +
        "Kalau tanggalnya tidak penting, balas `hari ini`.",
        { parse_mode: "Markdown" }
      );
    }

    // Tahap pemasukan: sumber/tanggal
    if (session?.type === "pemasukan" && session.step === "date") {
      let note = session.note;
      let date = new Date();
      const separator = text.split("|");

      if (separator.length >= 2) {
        note = separator[0].trim() || note;
        const parsedDate = parseDateOptional(separator.slice(1).join("|"));
        if (!parsedDate) {
          return ctx.reply("Tanggalnya belum Saya paham,i. Contoh: `08-08-2026`.");
        }
        date = parsedDate;
      } else if (!/^hari\s*ini$/i.test(text)) {
        // Kalau session sudah punya note dari input nominal, teks ini dianggap tanggal.
        // Kalau belum, teks dianggap sumber pemasukan.
        if (!note && !/\d/.test(text)) {
          note = text;
        } else {
          const parsedDate = parseDateOptional(text);
          if (!parsedDate) {
            return ctx.reply(
              "Boleh tulis `hari ini`, atau tanggal seperti `08-08-2026`."
            );
          }
          date = parsedDate;
        }
      }

      try {
        const user = await ensureUser(ctx);
        const added = await txService.addTransactions(
          user.id,
          date,
          "pemasukan",
          withIdempotency([{ amount: session.amount, note: note || "Pemasukan" }], ctx)
        );
        const totals = await txService.getTotals(user.id, "all");
        clearSession(ctx.chat.id);

        return ctx.reply(
          `Beres, pemasukan sudah masuk.\n\n` +
            `${note || "Pemasukan"}: ${formatRupiah(added[0].amount)}\n` +
          `${formatDate(date)}\n` +
          `Saldo sekarang: ${formatRupiah(totals.saldo)}`
        );
      } catch (err) {
        console.error(err);
        return ctx.reply(" Gagal menyimpan pemasukan: " + err.message);
      }
    }

    // Tahap pengeluaran: barang + harga
    if (session?.type === "pengeluaran" && session.step === "items") {
      const parsed = parserService.parseMessage(`pengeluaran ${text}`);

      if (!parsed.ok) {
        return ctx.reply(
          "Saya belum bisa membaca barang dan harganya 😅\n\n" +
          "Contoh: `beras 50000 + telur 20000`"
        );
      }

      session.items = parsed.items;
      session.date = parsed.date || new Date();
      session.step = "confirm_date";
      setSession(ctx.chat.id, session);

      const preview = session.items
        .map((i) => `• ${i.note}: ${formatRupiah(i.amount)}`)
        .join("\n");

      return ctx.reply(
        `Oke, barangnya sudah Saya tangkap:\n\n${preview}\n\n` +
        `Tanggal: ${formatDate(session.date)}\n\n` +
        "Kalau tanggalnya sudah benar, balas `ya`.\n" +
        "Kalau mau ganti tanggal, balas misalnya `08-08-2026`."
      );
    }

    // Tahap pengeluaran: konfirmasi tanggal
    if (session?.type === "pengeluaran" && session.step === "confirm_date") {
      let date = session.date;

      if (!/^ya$/i.test(text)) {
        const parsedDate = parseDateOptional(text);
        if (!parsedDate) {
          return ctx.reply(
            "Tanggalnya belum Saya pahami. Balas `ya` untuk hari ini, atau tulis `08-08-2026`."
          );
        }
        date = parsedDate;
      }

      try {
        const user = await ensureUser(ctx);
        const added = await txService.addTransactions(
          user.id,
          date,
          "pengeluaran",
          withIdempotency(session.items, ctx)
        );
        const totals = await txService.getTotals(user.id, "all");
        const total = added.reduce((sum, a) => sum + Number(a.amount), 0);
        clearSession(ctx.chat.id);

        return ctx.reply(
          `Pengeluaran sudah dicatat.\n\n` +
          added.map((a) => `• ${a.note}: ${formatRupiah(a.amount)}`).join("\n") +
          `\n\nTotal: ${formatRupiah(total)}` +
          `\n${formatDate(date)}` +
          `\nSisa saldo: ${formatRupiah(totals.saldo)}`
        );
      } catch (err) {
        console.error(err);
        return ctx.reply(" Gagal menyimpan pengeluaran: " + err.message);
      }
    }

    // Fallback: parser transaksi lama tetap dipertahankan.
    if (parserService.isMenuCommand(text)) {
      return ctx.replyWithMarkdown(MENU_TEXT);
    }

    const totalType = parserService.matchTotalCommand(text);
    if (totalType) {
      try {
        const user = await ensureUser(ctx);
        const totals = await txService.getTotals(user.id, "all");
        const val =
          totalType === "pengeluaran"
            ? totals.totalPengeluaran
            : totals.totalPemasukan;
        return ctx.reply(
          `Total ${totalType}: ${formatRupiah(val)}`
        );
      } catch (err) {
        console.error(err);
        return ctx.reply(" Gagal mengambil total: " + err.message);
      }
    }

    const result = parserService.parseMessage(text);

    if (!result.ok) {
      if (result.reason === "no_type") {
        return ctx.reply(
          "Saya tidak faham, Coba /menu untuk melihat pilihannya."
        );
      }
      if (result.reason === "no_items") {
        return ctx.reply(
          "Belum ada nominal/barang. Contoh: `pengeluaran 25000 makan`."
        );
      }
      if (result.reason === "unrecognized_items") {
        return ctx.reply(
          `Saya belum mengenali: ${result.badItems.join(" ; ")}`
        );
      }
      return ctx.reply(" Pesannya belum bisa diproses.");
    }

    try {
      const user = await ensureUser(ctx);
      const added = await txService.addTransactions(
        user.id,
        result.date,
        result.type,
        withIdempotency(result.items, ctx)
      );

      const totals = await txService.getTotals(user.id, "all");
      const total = added.reduce((sum, a) => sum + Number(a.amount), 0);

      ctx.reply(
        `${result.type === "pemasukan" ? "Pemasukan" : "Pengeluaran"} sudah dicatat.\n\n` +
          added
            .map((a) => `• ${a.note}: ${formatRupiah(a.amount)}`)
            .join("\n") +
          `\n\  ${result.type === "pemasukan" ? "Saldo sekarang" : "Sisa saldo"}: ${formatRupiah(totals.saldo)}`
      );
    } catch (err) {
      console.error(err);
      ctx.reply(" Gagal menyimpan transaksi: " + err.message);
    }
  });

  return bot;
}

module.exports = { createBot };