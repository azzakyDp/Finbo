import { GaugeIcon, NotePencilIcon, ListBulletsIcon, SquaresFourIcon } from "@phosphor-icons/react";
import styles from "./Sidebar.module.css";

const MENUS = [
  { key: "dashboard", label: "Dashboard", icon: GaugeIcon },
  { key: "planning", label: "Planning Keuangan", icon: NotePencilIcon },
  { key: "transaksi", label: "Transaksi", icon: ListBulletsIcon },
  { key: "kategori", label: "Kategori & Budget", icon: SquaresFourIcon },
];

export default function Sidebar({ active, onNavigate }) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.brandMark}>R</span>
        <span className={styles.brandName}>Ran</span>
      </div>

      <nav className={styles.nav}>
        {MENUS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={`${styles.navItem} ${active === key ? styles.active : ""}`}
            onClick={() => onNavigate(key)}
          >
            <Icon size={17} weight={active === key ? "fill" : "regular"} />
            {label}
          </button>
        ))}
      </nav>

      <div className={styles.foot}>
        <div className={styles.note}>Dicatat lewat Telegram,<br />ditinjau di sini.</div>
      </div>
    </aside>
  );
}
