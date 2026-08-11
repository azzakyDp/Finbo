import { useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip,
} from "chart.js";
import styles from "./SpendChart.module.css";

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip);

export default function SpendChart({ transactions = [] }) {
  const [range, setRange] = useState("weekly");

  const chartData = useMemo(() => {
    const filtered = (transactions || []).filter((t) => t.type === "pengeluaran");
    const now = new Date();
    const labelMap = new Map();

    filtered.forEach((t) => {
      const d = new Date(t.date);
      let key = "";
      let label = "";

      if (range === "monthly") {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        label = d.toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
      } else {
        key = d.toISOString().slice(0, 10);
        label = d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
      }

      if (range === "monthly") {
        if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) {
          return;
        }
      } else {
        const start = new Date(now);
        start.setDate(now.getDate() - 6);
        if (d < start || d > now) {
          return;
        }
      }

      if (!labelMap.has(key)) {
        labelMap.set(key, { label, amount: 0 });
      }

      labelMap.get(key).amount += Number(t.amount || 0);
    });

    const sorted = Array.from(labelMap.values()).sort((a, b) => a.label.localeCompare(b.label));
    return {
      labels: sorted.map((item) => item.label),
      datasets: [{
        data: sorted.map((item) => item.amount),
        borderColor: "#E2654B",
        backgroundColor: "rgba(226,101,75,0.08)",
        borderWidth: 2.5,
        tension: 0.35,
        fill: true,
        pointRadius: 3,
        pointBackgroundColor: "#E2654B",
      }],
    };
  }, [range, transactions]);

  const options = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      y: { ticks: { callback: (v) => "Rp" + v / 1000 + "k", font: { family: "IBM Plex Mono", size: 10 } }, grid: { color: "#DDD6C4" } },
      x: { ticks: { font: { family: "IBM Plex Mono", size: 10 } }, grid: { display: false } },
    },
  };

  if (!chartData.labels.length) {
    return <div className={styles.panel}><div className={styles.head}><h2>Arus Pengeluaran</h2></div><p>Belum ada transaksi pengeluaran.</p></div>;
  }

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <h2>Arus Pengeluaran</h2>
        <div className={styles.toggleGroup}>
          <button className={`${styles.toggleBtn} ${range === "weekly" ? styles.active : ""}`} onClick={() => setRange("weekly")}>Mingguan</button>
          <button className={`${styles.toggleBtn} ${range === "monthly" ? styles.active : ""}`} onClick={() => setRange("monthly")}>Bulanan</button>
        </div>
      </div>
      <Line data={chartData} options={options} height={90} />
    </div>
  );
}
