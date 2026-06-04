import { create } from 'zustand';
import { Transaction, Invoice, Supplier, AccountingCategory, MonthlyData, Alert, AccountingEntry } from '../types';
import { entriesFromInvoice, entriesFromTransaction } from '../utils/accounting';

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

const replaceSourceEntries = (
  entries: AccountingEntry[],
  sourceType: AccountingEntry['sourceType'],
  sourceId: string,
  replacements: AccountingEntry[],
) => [
  ...entries.filter((entry) => entry.sourceType !== sourceType || entry.sourceId !== sourceId),
  ...replacements,
];

interface AppState {
  transactions: Transaction[];
  invoices: Invoice[];
  suppliers: Supplier[];
  categories: AccountingCategory[];
  alerts: Alert[];
  monthlyData: MonthlyData[];
  accountingEntries: AccountingEntry[];
  demoMode: boolean;
  addTransaction: (t: Transaction) => void;
  addTransactions: (ts: Transaction[]) => void;
  addInvoice: (inv: Invoice) => void;
  updateInvoice: (id: string, inv: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;
  setDemoMode: (enabled: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  transactions: [],
  invoices: [],
  suppliers: [],
  categories: defaultCategories,
  alerts: [],
  monthlyData: [],
  accountingEntries: [],
  demoMode: false,
  addTransaction: (transaction) => set((state) => ({
    transactions: [...state.transactions, transaction],
    accountingEntries: [
      ...state.accountingEntries,
      ...entriesFromTransaction(transaction, state.categories),
    ],
  })),
  addTransactions: (transactions) => set((state) => ({
    transactions: [...state.transactions, ...transactions],
    accountingEntries: [
      ...state.accountingEntries,
      ...transactions.flatMap((transaction) => entriesFromTransaction(transaction, state.categories)),
    ],
  })),
  addInvoice: (invoice) => set((state) => ({
    invoices: [...state.invoices, invoice],
    accountingEntries: [
      ...state.accountingEntries,
      ...entriesFromInvoice(invoice, state.categories),
    ],
  })),
  updateInvoice: (id, updates) => set((state) => {
    const invoices = state.invoices.map((invoice) => invoice.id === id ? { ...invoice, ...updates } : invoice);
    const updatedInvoice = invoices.find((invoice) => invoice.id === id);
    return {
      invoices,
      accountingEntries: updatedInvoice
        ? replaceSourceEntries(state.accountingEntries, 'invoice', id, entriesFromInvoice(updatedInvoice, state.categories))
        : state.accountingEntries,
    };
  }),
  deleteInvoice: (id) => set((state) => ({
    invoices: state.invoices.filter((invoice) => invoice.id !== id),
    accountingEntries: state.accountingEntries.filter((entry) => entry.sourceType !== 'invoice' || entry.sourceId !== id),
  })),
  setDemoMode: (enabled) => set({ demoMode: enabled }),
}));
