import SummaryCards from "../components/SummaryCards/SummaryCards";
import SpendChart from "../components/SpendChart/SpendChart";
import ReceiptList from "../components/ReceiptList/ReceiptList";

export default function DashboardPage({ transactions }) {
  return (
    <>
      <SummaryCards transactions={transactions} />
      <SpendChart transactions={transactions} />
      <ReceiptList transactions={transactions} />
    </>
  );
}
