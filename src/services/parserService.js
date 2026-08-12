function toNumber(str) {
  if (!str) return NaN;
  let s = String(str)
    .replace(/[^\d.,-]/g, "")
    .trim();
  if (s.indexOf(".") !== -1 && s.indexOf(",") !== -1) {
    s = s.replace(/\./g, "").replace(/,/g, ".");
  } else if (s.indexOf(".") !== -1) {
    s = s.replace(/\./g, "");
  } else if (s.indexOf(",") !== -1) {
    s = s.replace(/,/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
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

  for (const raw of rawItems) {
    let item = raw.replace(/^[=:\s]+/, "").trim();
    let m;

    m = item.match(/^([+\d][\d.,]*)\s+(.+)$/);
    if (m) {
      const price = toNumber(m[1]);
      const name = m[2].trim();
      if (!isNaN(price)) {
        parsed.push({ amount: price, note: name });
        continue;
      }
    }

    m = item.match(/^(.+?)\s+([+\d][\d.,]*)$/);
    if (m) {
      const name = m[1].trim();
      const price = toNumber(m[2]);
      if (!isNaN(price)) {
        parsed.push({ amount: price, note: name });
        continue;
      }
    }

    m = item.match(/([+\d][\d.,]*)/);
    if (m) {
      const price = toNumber(m[1]);
      const name = item.replace(m[1], "").trim();
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
