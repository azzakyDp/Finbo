import { fmtRp } from "../../api/client";
import styles from "./CategoryGrid.module.css";

export default function CategoryGrid({ transactions = [] }) {
  const categories = Object.values(
    transactions.reduce((acc, tx) => {
      if (tx.type !== "pengeluaran") return acc;
      const key = tx.category || "Lainnya";
      if (!acc[key]) acc[key] = { category: key, spent: 0 };
      acc[key].spent += Number(tx.amount || 0);
      return acc;
    }, {})
  );

  if (!categories.length) {
    return <div className={styles.grid}><div className={styles.card}>Belum ada transaksi pengeluaran.</div></div>;
  }

  return (
    <div className={styles.grid}>
      {categories.map((c) => {
        const pct = Math.min(100, Math.round((c.spent / Math.max(1, c.spent)) * 100));
        return (
          <div className={styles.card} key={c.category}>
            <div className={styles.head}>
              <span className={styles.name}>{c.category}</span>
              <span className={styles.limit}>{fmtRp(c.spent)}</span>
            </div>
            <div className={styles.barBg}>
              <div className={styles.barFill} style={{ width: `${pct}%`, background: "var(--teal)" }} />
            </div>
            <div className={styles.status}>Total pengeluaran kategori ini</div>
          </div>
        );
      })}
    </div>
  );
}
