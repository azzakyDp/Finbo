const TZ = "Asia/Jakarta";

function getParts(dateLike, timeZone = TZ) {
  const date = dateLike instanceof Date ? new Date(dateLike) : new Date(dateLike);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function toDateOnlyString(dateLike) {
  const { year, month, day } = getParts(dateLike);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDateOnlyString(dateLike) {
  if (!dateLike) return null;
  if (typeof dateLike === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateLike)) {
    return new Date(`${dateLike}T00:00:00+07:00`);
  }
  return new Date(dateLike);
}

function toDisplayDate(dateLike) {
  const date = parseDateOnlyString(dateLike);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("id-ID", {
    timeZone: TZ,
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function getDateRange(range = "all", now = new Date()) {
  const today = getParts(now);

  if (range === "monthly") {
    return {
      start: `${today.year}-${String(today.month).padStart(2, "0")}-01`,
      end: `${today.year}-${String(today.month).padStart(2, "0")}-${String(new Date(today.year, today.month, 0).getDate()).padStart(2, "0")}`,
    };
  }

  if (range === "weekly") {
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 6);
    return {
      start: toDateOnlyString(startDate),
      end: toDateOnlyString(now),
    };
  }

  if (range === "daily") {
    const day = toDateOnlyString(now);
    return { start: day, end: day };
  }

  if (range === "yearly") {
    return {
      start: `${today.year}-01-01`,
      end: `${today.year}-12-31`,
    };
  }

  return null;
}

module.exports = {
  TZ,
  toDateOnlyString,
  parseDateOnlyString,
  toDisplayDate,
  getDateRange,
};
