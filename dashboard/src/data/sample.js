// src/data/sample.js
export const SAMPLE = {
  transactions: [
    { id: 1, date: "2026-08-04", type: "pengeluaran", amount: 25000, note: "Nasi padang", category: "Makanan" },
    { id: 2, date: "2026-08-04", type: "pengeluaran", amount: 8000, note: "Parkir stasiun", category: "Transport" },
    { id: 3, date: "2026-08-03", type: "pemasukan", amount: 1500000, note: "Freelance project", category: "Pemasukan" },
    { id: 4, date: "2026-08-02", type: "pengeluaran", amount: 45000, note: "Laundry bulanan", category: "Kos" },
    { id: 5, date: "2026-08-01", type: "pengeluaran", amount: 60000, note: "Beli buku", category: "Lainnya" },
    { id: 6, date: "2026-07-30", type: "pengeluaran", amount: 22000, note: "Kopi + kerja", category: "Makanan" },
  ],
  weekly: [
    { label: "Sen", amount: 25000 }, { label: "Sel", amount: 40000 },
    { label: "Rab", amount: 12000 }, { label: "Kam", amount: 60000 },
    { label: "Jum", amount: 33000 }, { label: "Sab", amount: 15000 },
    { label: "Min", amount: 8000 },
  ],
  monthly: [
    { label: "Mgg 1", amount: 210000 }, { label: "Mgg 2", amount: 340000 },
    { label: "Mgg 3", amount: 180000 }, { label: "Mgg 4", amount: 260000 },
  ],
  planning: {
    wishlist: [
      { title: "Keyboard mechanical", target_amount: 750000 },
      { title: "Sepatu lari", target_amount: 400000 },
    ],
    goal: [
      { title: "DP Motor", target_amount: 3000000, saved_amount: 1200000, deadline: "2026-12-01" },
      { title: "Dana darurat", target_amount: 5000000, saved_amount: 2100000, deadline: "2027-02-01" },
    ],
  },
  categories: [
    { category: "Makanan", spent: 420000, monthly_limit: 700000 },
    { category: "Transport", spent: 150000, monthly_limit: 300000 },
    { category: "Kos", spent: 45000, monthly_limit: 500000 },
    { category: "Lainnya", spent: 260000, monthly_limit: 200000 },
  ],
};
