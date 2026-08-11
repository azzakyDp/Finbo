import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar/Sidebar";
import Topbar from "./components/Topbar/Topbar";
import DashboardPage from "./pages/DashboardPage";
import PlanningPage from "./pages/PlanningPage";
import TransaksiPage from "./pages/TransaksiPage";
import KategoriPage from "./pages/KategoriPage";
import { deleteTransaction, fetchTransactions } from "./api/client";
import "./styles/global.css";
import styles from "./App.module.css";

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState("");

  async function loadTransactions() {
    try {
      setError("");
      const data = await fetchTransactions();
      setTransactions(data);
    } catch (err) {
      setError(err.message || "Gagal memuat transaksi");
    }
  }

  useEffect(() => {
    loadTransactions();
  }, []);

  async function handleDelete(id) {
    try {
      await deleteTransaction(id);
      await loadTransactions();
    } catch (err) {
      setError(err.message || "Gagal menghapus transaksi");
    }
  }

  return (
    <div className={styles.app}>
      <Sidebar active={page} onNavigate={setPage} />
      <main className={styles.main}>
        <Topbar page={page} />
        {error && <div className={styles.error}>{error}</div>}
        {page === "dashboard" && <DashboardPage transactions={transactions} />} 
        {page === "planning" && <PlanningPage />}
        {page === "transaksi" && <TransaksiPage transactions={transactions} onDelete={handleDelete} />}
        {page === "kategori" && <KategoriPage />}
      </main>
    </div>
  );
}
