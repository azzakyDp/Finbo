import { useState } from "react";
import styles from "./PlanningGrid.module.css";

export default function PlanningGrid() {
  const [tab] = useState("wishlist");

  return (
    <div>
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === "wishlist" ? styles.active : ""}`} type="button">Wishlist</button>
        <button className={`${styles.tab} ${tab === "goal" ? styles.active : ""}`} type="button">Target Nabung</button>
      </div>
      <div className={styles.grid}>
        <div className={styles.card}>Belum ada data perencanaan dari backend.</div>
      </div>
    </div>
  );
}
