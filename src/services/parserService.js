function toNumber(str) {
  if (!str) return NaN;
  let raw = String(str).trim().toLowerCase();

  // Bersihkan prefix 'rp' jika ada
  raw = raw.replace(/^rp\s*/i, "").trim();

  // Cek multiplier: k/rb/ribu (1.000), jt/juta (1.000.000)
  let multiplier = 1;
  const unitMatch = raw.match(/^(.*?)\s*(ribu|rb|k|juta|jt)$/i);
  if (unitMatch) {
    const unit = unitMatch[2].toLowerCase();
    if (unit === "k" || unit === "rb" || unit === "ribu") {
      multiplier = 1000;
    } else if (unit === "jt" || unit === "juta") {
      multiplier = 1000000;
    }
    raw = unitMatch[1].trim();
  }

  let s = raw.replace(/[^\d.,-]/g, "").trim();
  if (!s) return NaN;

  if (s.indexOf(".") !== -1 && s.indexOf(",") !== -1) {
    s = s.replace(/\./g, "").replace(/,/g, ".");
  } else if (s.indexOf(".") !== -1) {
    // Jika ada multiplier (misal 2.5k atau 1.5jt), titik berfungsi sebagai desimal
    if (multiplier > 1) {
      s = s.replace(/,/g, ".");
    } else {
      s = s.replace(/\./g, "");
    }
  } else if (s.indexOf(",") !== -1) {
    if (multiplier > 1) {
      s = s.replace(/,/g, ".");
    } else {
      s = s.replace(/,/g, "");
    }
  }

  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return NaN;

  const total = Math.round(n * multiplier);

  // Validasi batas minimal nominal rupiah:
  // Jika pengguna hanya mengetik angka satuan kecil (misal "2" tanpa k/ribu),
  // tolak (return NaN) karena tidak valid sebagai nominal rupiah (minimal Rp100).
  if (total < 100) {
    return NaN;
  }

  return total;
}

function parseDate(text) {
  let date = new Date();

  // Kata kunci relatif: "hari ini", "kemarin"
  if (/\bhari\s*ini\b/i.test(text)) {
    return { date, matchedText: text.match(/\bhari\s*ini\b/i)[0] };
  }
  if (/\bkemarin\b/i.test(text)) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return { date: d, matchedText: text.match(/\bkemarin\b/i)[0] };
  }

  const dateMatch = text.match(/(\b\d{1,4}[-/]\d{1,2}[-/]\d{1,4}\b)/);
  if (dateMatch) {
    const dstr = dateMatch[1].replace(/\//g, "-");
    const parts = dstr.split("-").map((p) => p.padStart(2, "0"));
    if (parts[0].length === 4) {
      date = new Date(`${parts[0]}-${parts[1]}-${parts[2]}`);
    } else {
      const day = Number(parts[0]);
      const month = Number(parts[1]) - 1;
      let year = Number(parts[2]);
      if (parts[2].length === 2) year += 2000;
      date = new Date(year, month, day);
    }
  }
  return { date, matchedText: dateMatch ? dateMatch[1] : null };
}

// opsi menu 
function isMenuCommand(text) {
  return /^menu$/i.test(text.trim());
}

// opsi pengeluaran
function matchTotalCommand(text) {
  const lower = text.trim().toLowerCase();
  const m = /^total (pengeluaran|pemasukan)$/i.test(lower);
  if (!m) return null;
  return lower.includes("pengeluaran") ? "pengeluaran" : "pemasukan";
}

// menerjemahkan text
function parseMessage(rawText) {
  const original = String(rawText || "");
  const text = original.trim();

  if (!text) {
    return { ok: false, reason: "empty" };
  }

  let autoType = null;

  if (!text.match(/pemasukan|pengeluaran/i)) {
    const hasNote = /[a-zA-Z]+/.test(text.replace(/\d|[-=+/ ]/g, ""));
    const onlyNumbers = text.includes("=") && !hasNote;
    if (onlyNumbers) autoType = "pemasukan";
  }

  const type = autoType
    ? autoType
    : /(^|\s)pemasukan\b/i.test(text)
    ? "pemasukan"
    : /(^|\s)pengeluaran\b/i.test(text)
    ? "pengeluaran"
    : null;

  if (!type) {
    return { ok: false, reason: "no_type" };
  }

  const { date, matchedText } = parseDate(text);

  let body = text
    .replace(new RegExp(`(^|\\s)${type}\\b`, "i"), "")
    .replace(/(\b\d{1,4}[-/]\d{1,2}[-/]\d{1,4}\b)/, "");

  if (matchedText) {
    body = body.replace(new RegExp(matchedText.replace(/\s+/g, "\\s*"), "i"), "");
  }

  body = body.replace(/^[\s:=-]+/, "").trim();

  if (!body) {
    return { ok: false, reason: "no_items" };
  }

  const rawItems = body
    .split(/\s*[+,\n;]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

  const parsed = [];
  const badItems = [];

  const AMOUNT_PATTERN = "([+\\d][\\d.,]*(?:\\s*(?:k|rb|ribu|jt|juta))?)";
  const amountRegex = new RegExp(`^${AMOUNT_PATTERN}\\s+(.+)$`, "i");
  const reverseRegex = new RegExp(`^(.+?)\\s+${AMOUNT_PATTERN}$`, "i");
  const standaloneRegex = new RegExp(`\\b${AMOUNT_PATTERN}\\b`, "i");

  for (const raw of rawItems) {
    let item = raw.replace(/^[=:\s]+/, "").trim();
    let m;

    m = item.match(amountRegex);
    if (m) {
      const price = toNumber(m[1]);
      const name = m[2].trim();
      if (!isNaN(price)) {
        parsed.push({ amount: price, note: name });
        continue;
      }
    }

    m = item.match(reverseRegex);
    if (m) {
      const name = m[1].trim();
      const price = toNumber(m[2]);
      if (!isNaN(price)) {
        parsed.push({ amount: price, note: name });
        continue;
      }
    }

    m = item.match(standaloneRegex);
    if (m) {
      const price = toNumber(m[1]);
      const name = item.replace(m[0], "").trim();
      if (!isNaN(price)) {
        parsed.push({ amount: price, note: name || "(tanpa catatan)" });
        continue;
      }
    }

    badItems.push(raw);
  }

  if (parsed.length === 0) {
    return { ok: false, reason: "unrecognized_items", badItems };
  }

  return { ok: true, type, date, items: parsed, badItems };
}

module.exports = {
  parseMessage,
  isMenuCommand,
  matchTotalCommand,
  toNumber,
};