import TxTable from "../components/TxTable/TxTable";

export default function TransaksiPage({ transactions, onDelete }) {
  return <TxTable transactions={transactions} onDelete={onDelete} />;
}
