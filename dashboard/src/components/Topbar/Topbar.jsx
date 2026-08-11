import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { exportUrl } from "../../api/client";
import styles from "./Topbar.module.css";

const TITLES = {
  dashboard: "Dashboard",
  planning: "Planning Keuangan",
  transaksi: "Transaksi",
  kategori: "Kategori & Budget",
};

export default function Topbar({ page }) {
  return (
    <header className={styles.topbar}>
      <h1 className={styles.title}>{TITLES[page]}</h1>
      <a className={styles.exportBtn} href={exportUrl()}>
        <DownloadSimpleIcon size={16} weight="bold" />
        Export Spreadsheet
      </a>
    </header>
  );
}
