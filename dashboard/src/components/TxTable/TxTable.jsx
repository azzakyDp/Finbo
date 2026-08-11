import { useState } from "react";
import { TrashIcon } from "@phosphor-icons/react";
import { fmtRp, fmtDate } from "../../api/client";
import styles from "./TxTable.module.css";

const FILTERS = [
  { key: "all", label: "Semua" },
  { key: "daily", label: "Harian" },
  { key: "weekly", label: "Mingguan" },
  { key: "monthly", label: "Bulanan" },
];

export default function TxTable({ transactions, onDelete }) {
  const [filter, setFilter] = useState("all");
  const now = new Date();

  let rows = [...transactions];
  if (filter === "daily") rows = rows.filter((t) => new Date(t.date).toDateString() === now.toDateString());
  if (filter === "weekly") { const w = new Date(); w.setDate(now.getDate() - 7); rows = rows.filter((t) => new Date(t.date) >= w); }
  if (filter === "monthly") rows = rows.filter((t) => { const d = new Date(t.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
  rows.sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <h2>Semua Transaksi</h2>
        <div className={styles.toggleGroup}>
          {FILTERS.map((f) => (
            <button key={f.key} className={`${styles.toggleBtn} ${filter === f.key ? styles.active : ""}`} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <table className={styles.table}>
        <thead>
          <tr><th>Tanggal</th><th>Catatan</th><th>Kategori</th><th className={styles.num}>Jumlah</th><th></th></tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id}>
              <td>{fmtDate(t.date)}</td>
              <td>{t.note}</td>
              <td>{t.category || "-"}</td>
              <td className={`${styles.num} ${t.type === "pemasukan" ? styles.in : styles.out}`}>
                {t.type === "pemasukan" ? "+" : "−"}{fmtRp(t.amount)}
              </td>
              <td>
                <button className={styles.del} title="Hapus" onClick={() => onDelete?.(t.id)}>
                  <TrashIcon size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
