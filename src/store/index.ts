import { create } from 'zustand';
import { Transaction, Invoice, Supplier, AccountingCategory, MonthlyData, Alert } from '../types';

const defaultCategories: AccountingCategory[] = [
  { id: '1', name: 'Chiffre d\'affaires', type: 'revenue', code: '3000' },
  { id: '2', name: 'Achats marchandises', type: 'expense', code: '4000' },
  { id: '3', name: 'Charges de personnel', type: 'expense', code: '5000' },
  { id: '4', name: 'Loyer', type: 'expense', code: '6000' },
  { id: '5', name: 'Charges d\'exploitation', type: 'expense', code: '6100' },
  { id: '6', name: 'Frais administratifs', type: 'expense', code: '6200' },
  { id: '7', name: 'Frais bancaires', type: 'expense', code: '6800' },
  { id: '8', name: 'Assurances', type: 'expense', code: '6300' },
  { id: '9', name: 'Entretien', type: 'expense', code: '6400' },
  { id: '10', name: 'Marketing', type: 'expense', code: '6500' },
  { id: '11', name: 'Impôts / taxes', type: 'expense', code: '7000' },
  { id: '12', name: 'Fournisseurs alimentaires', type: 'expense', code: '4100' },
  { id: '13', name: 'Boissons', type: 'expense', code: '4200' },
  { id: '14', name: 'Électricité / gaz / eau', type: 'expense', code: '6110' },
  { id: '15', name: 'Matériel', type: 'expense', code: '6600' },
];

interface AppState {
  transactions: Transaction[];
  invoices: Invoice[];
  suppliers: Supplier[];
  categories: AccountingCategory[];
  alerts: Alert[];
  monthlyData: MonthlyData[];
  addTransaction: (t: Transaction) => void;
  addTransactions: (ts: Transaction[]) => void;
  addInvoice: (inv: Invoice) => void;
  updateInvoice: (id: string, inv: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;
}

export const useStore = create<AppState>((set) => ({
  transactions: [],
  invoices: [],
  suppliers: [],
  categories: defaultCategories,
  alerts: [],
  monthlyData: [],
  addTransaction: (t) => set((state) => ({ transactions: [...state.transactions, t] })),
  addTransactions: (ts) => set((state) => ({ transactions: [...state.transactions, ...ts] })),
  addInvoice: (inv) => set((state) => ({ invoices: [...state.invoices, inv] })),
  updateInvoice: (id, updates) => set((state) => ({
    invoices: state.invoices.map((inv) => inv.id === id ? { ...inv, ...updates } : inv),
  })),
  deleteInvoice: (id) => set((state) => ({
    invoices: state.invoices.filter((inv) => inv.id !== id),
  })),
}));
