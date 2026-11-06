import { fmtRp } from "../../api/client";
import styles from "./SummaryCards.module.css";

export default function SummaryCards({ transactions }) {
  const now = new Date();
  const thisMonth = transactions.filter((t) => {
    const d = new Date(t.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  // Pemasukan reguler bulan ini (mengecualikan 'tarik_tabungan')
  const regularIncomeThisMonth = thisMonth.filter(
    (t) => t.type === "pemasukan" && t.category !== "tarik_tabungan"
  );
  const totalIn = regularIncomeThisMonth.reduce((s, t) => s + Number(t.amount), 0);

  const totalOut = thisMonth.filter((t) => t.type === "pengeluaran").reduce((s, t) => s + Number(t.amount), 0);
  
  // Total Saldo tetap: semua pemasukan (termasuk tarik_tabungan) - semua pengeluaran
  const allIn = transactions.filter((t) => t.type === "pemasukan").reduce((s, t) => s + Number(t.amount), 0);
  const allOut = transactions.filter((t) => t.type === "pengeluaran").reduce((s, t) => s + Number(t.amount), 0);
  const fromSavingsAll = transactions
    .filter((t) => t.type === "pemasukan" && t.category === "tarik_tabungan")
    .reduce((s, t) => s + Number(t.amount), 0);

  const saldoSub = fromSavingsAll > 0 ? `termasuk ${fmtRp(fromSavingsAll)} dari tabungan` : "per hari ini";

  const cards = [
    { label: "Total Saldo", value: fmtRp(allIn - allOut), sub: saldoSub, cls: "" },
    { label: "Pemasukan Bulan Ini", value: fmtRp(totalIn), sub: `${regularIncomeThisMonth.length} transaksi`, cls: styles.in },
    { label: "Pengeluaran Bulan Ini", value: fmtRp(totalOut), sub: `${thisMonth.filter((t) => t.type === "pengeluaran").length} transaksi`, cls: styles.out },
    { label: "Transaksi Tercatat", value: thisMonth.length, sub: "bulan ini", cls: "" },
  ];

  return (
    <div className={styles.cards}>
      {cards.map((c) => (
        <div className={styles.card} key={c.label}>
          <span className={styles.label}>{c.label}</span>
          <span className={`${styles.value} ${c.cls}`}>{c.value}</span>
          <span className={styles.sub}>{c.sub}</span>
        </div>
      ))}
    </div>
  );
}