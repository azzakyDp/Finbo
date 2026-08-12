const AUTH_TOKEN_KEY = "bot-kos-auth-token";

export const fmtRp = (n) => "Rp" + Number(n || 0).toLocaleString("id-ID");
export const fmtDate = (d) =>
  new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short" });

function getStoredToken() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(AUTH_TOKEN_KEY);
}

function setStoredToken(token) {
  if (typeof window === "undefined") return;
  if (token) {
    window.sessionStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    window.sessionStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

async function ensureAuthToken() {
  const storedToken = getStoredToken();
  if (storedToken) return storedToken;

  if (typeof window !== "undefined" && window.Telegram?.WebApp?.initData) {
    const res = await fetch(`/api/auth/telegram`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: window.Telegram.WebApp.initData }),
    });

    const text = await res.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error("Respons autentikasi bukan JSON");
      }
    }

    if (!res.ok || !payload?.success) {
      throw new Error(payload?.message || "Gagal login Telegram");
    }

    setStoredToken(payload.token);
    return payload.token;
  }

  throw new Error("Dashboard harus dibuka dari Telegram Web App yang terautentikasi");
}

async function requestJson(path, options = {}) {
  const token = await ensureAuthToken();
  const res = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
    ...options,
  });

  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();

  if (!text) {
    throw new Error("Respons kosong dari server");
  }

  let payload = null;
  if (contentType.includes("application/json")) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error("Respons JSON tidak valid");
    }
  } else {
    throw new Error(`Respons server bukan JSON (${contentType || "unknown"})`);
  }

  if (!res.ok) {
    throw new Error(payload.message || "Request failed");
  }

  return payload;
}

export async function fetchTransactions() {
  const json = await requestJson(`/api/transactions`);
  return json.data || [];
}

export async function fetchTotals() {
  const json = await requestJson(`/api/total`);
  return {
    totalPemasukan: Number(json.totalPemasukan || 0),
    totalPengeluaran: Number(json.totalPengeluaran || 0),
    saldo: Number(json.saldo || 0),
  };
}

export async function deleteTransaction(id) {
  return requestJson(`/api/transaction/${id}`, { method: "DELETE" });
}

export function exportUrl() {
  return `/api/export`;
}
