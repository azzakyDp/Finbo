require("dotenv").config();
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const path = require("path");
const txService = require("./services/transactionService");
const sessionService = require("./services/sessionService");
const planningService = require("./services/planningServices");
const { createBot } = require("./bot/telegramBot");

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "dashboard", "dist")));

function parseTelegramInitData(initData) {
  if (!initData || typeof initData !== "string") {
    throw new Error("initData tidak valid");
  }

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) throw new Error("hash telegram tidak ditemukan");

  const dataCheckString = Array.from(params.entries())
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (computedHash !== hash) {
    throw new Error("signature telegram tidak valid");
  }

  const authDate = Number(params.get("auth_date") || 0);
  const MAX_AGE_SECONDS = 60 * 60 * 24; // initData dianggap basi setelah 24 jam
  if (!authDate || Date.now() / 1000 - authDate > MAX_AGE_SECONDS) {
    throw new Error("initData telegram sudah kedaluwarsa");
  }

  const user = params.get("user");
  if (!user) throw new Error("user telegram tidak ditemukan");

  return JSON.parse(user);
}

async function requireAuthenticatedUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    const token = authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;

    if (!token) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const session = await sessionService.getSession(token);
    if (!session) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    req.authenticatedUserId = session.user_id;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
}

app.post("/api/auth/telegram", async (req, res) => {
  try {
    if (!BOT_TOKEN) {
      return res.status(500).json({ success: false, message: "TELEGRAM_BOT_TOKEN belum diset" });
    }

    const body = req.body || {};
    const initData = typeof body === "string" ? body : body.initData;
    const telegramUser = parseTelegramInitData(initData);
    const chatId = String(telegramUser.id);
    const user = await txService.findOrCreateUserByChatId(chatId, telegramUser.first_name || telegramUser.username || "telegram");
    if (process.env.NODE_ENV !== "production") {
      console.log("[AUTH] Login sukses untuk chatId:", chatId);
    }

    const sessionToken = await sessionService.createSession(user.id);

    return res.json({
      success: true,
      token: sessionToken,
      user: {
        id: user.id,
        chatId,
        name: telegramUser.first_name || telegramUser.username || null,
      },
    });
  } catch (err) {
    return res.status(401).json({ success: false, message: err.message || "Unauthorized" });
  }
});

let botInstance = null;
function getBot() {
  if (!botInstance && BOT_TOKEN) {
    botInstance = createBot();
  }
  return botInstance;
}

app.post("/api/telegram-webhook", async (req, res) => {
  try {
    const bot = getBot();

    if (!bot) return res.status(500).json({ success: false, message: "Bot belum diinisialisasi" });
    await bot.handleUpdate(req.body);
  } catch (err) {
    console.error("Webhook error:", err.message);
  }

  res.status(200).end();
});

app.use("/api", requireAuthenticatedUser);

app.get("/api/transactions", async (req, res) => {
  try {
    const { range = "all" } = req.query;
    const data = await txService.getTransactions(req.authenticatedUserId, range);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/total", async (req, res) => {
  try {
    const { range = "all" } = req.query;
    const totals = await txService.getTotals(req.authenticatedUserId, range);
    res.json({ success: true, ...totals });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete("/api/transaction/:id", async (req, res) => {
  try {
    const deleted = await txService.deleteTransactionById(req.authenticatedUserId, req.params.id);
    res.json({ success: true, message: deleted ? `Transaksi #${req.params.id} dihapus.` : `Transaksi #${req.params.id} tidak ditemukan.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/planning", async (req, res) => {
  try {
    const data = await planningService.createPlanningItem(req.authenticatedUserId, req.body || {});
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.post("/api/planning/:id/progress", async (req, res) => {
  try {
    const { amount } = req.body || {};
    const data = await planningService.addProgress(req.authenticatedUserId, req.params.id, amount);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.use("/api", (req, res) => {
  res.status(404).json({ success: false, message: "Endpoint tidak ditemukan" });
});

app.use((err, req, res, next) => {
  res.status(500).json({ success: false, message: "Internal server error" });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Dashboard API running at http://localhost:${PORT}`);
  });

  if (BOT_TOKEN) {
    try {
      const bot = getBot();
      bot.launch();
      console.log("Bot Telegram aktif (polling mode, development)");
      process.once("SIGINT", () => bot.stop("SIGINT"));
      process.once("SIGTERM", () => bot.stop("SIGTERM"));
    } catch (err) {
      console.error("Gagal start bot Telegram:", err.message);
    }
  } else {
    console.warn("TELEGRAM_BOT_TOKEN belum diset. bot Telegram tidak berjalan.");
  }
}

module.exports = app;