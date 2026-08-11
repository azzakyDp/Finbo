import { fmtRp, fmtDate } from "../../api/client";
import styles from "./ReceiptList.module.css";

export default function ReceiptList({ transactions }) {
  const recent = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);

  return (
    <div className={styles.panel}>
      <div className={styles.head}><h2>Transaksi Terbaru</h2></div>
      <div className={styles.strip}>
        {!recent.length ? (
          <div className={styles.row}>Belum ada transaksi.</div>
        ) : recent.map((t) => (
          <div className={styles.row} key={t.id}>
            <span className={styles.date}>{fmtDate(t.date)}</span>
            <span>
              <span className={styles.note}>{t.note}</span>
              <span className={styles.cat}>{t.category || "Tanpa kategori"}</span>
            </span>
            <span className={`${styles.amount} ${t.type === "pemasukan" ? styles.in : styles.out}`}>
              {t.type === "pemasukan" ? "+" : "−"}{fmtRp(t.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
