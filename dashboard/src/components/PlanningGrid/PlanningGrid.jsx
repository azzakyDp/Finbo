import { useEffect, useState } from "react";
import { fmtRp, fmtDate, fetchPlanningItems, addPlanningProgress } from "../../api/client";
import styles from "./PlanningGrid.module.css";

const TABS = [
  { key: "specific", label: "Tabungan Spesifik" },
  { key: "saving", label: "Simpanan" },
  { key: "emergency", label: "Dana Darurat" },
];

export default function PlanningGrid() {
  const [tab, setTab] = useState("specific");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPlanningItems(tab);
      setItems(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function handleNabung(id) {
    const input = window.prompt("Nabung berapa? (angka saja)");
    if (!input) return;
    const amount = Number(input.replace(/[^\d]/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      window.alert("Jumlah tidak valid.");
      return;
    }
    try {
      await addPlanningProgress(id, amount);
      await load();
    } catch (err) {
      window.alert(err.message);
    }
  }

  return (
    <div>
      <div className={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`${styles.tab} ${tab === t.key ? styles.active : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div className={styles.card}>Memuat...</div>}
      {error && <div className={styles.card}>Gagal memuat: {error}</div>}

      {!loading && !error && items.length === 0 && (
        <div className={styles.card}>Belum ada planning di kategori ini.</div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className={styles.grid}>
          {items.map((it) => {
            const hasTarget = it.target_amount != null;
            const pct = hasTarget ? Math.min(100, Math.round((it.saved_amount / it.target_amount) * 100)) : null;
            return (
              <div className={styles.card} key={it.id}>
                <div className={styles.title}>{it.title}{it.is_done ? " ✓" : ""}</div>
                <div className={styles.target}>
                  {fmtRp(it.saved_amount)} {hasTarget ? `/ ${fmtRp(it.target_amount)}` : "(tanpa target)"}
                </div>
                {hasTarget && (
                  <div className={styles.barBg}>
                    <div className={styles.barFill} style={{ width: `${pct}%` }} />
                  </div>
                )}
                {it.deadline && (
                  <div className={styles.deadline}>Target: {fmtDate(it.deadline)}{hasTarget ? ` · ${pct}%` : ""}</div>
                )}
                <button
                  type="button"
                  className={styles.tab}
                  style={{ marginTop: 10 }}
                  onClick={() => handleNabung(it.id)}
                >
                  + Nabung
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}