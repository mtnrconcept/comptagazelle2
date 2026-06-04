import { create } from 'zustand';
import { Transaction, Invoice, Supplier, AccountingCategory, MonthlyData, Alert } from '../types';

const normalizeSupplierName = (name: string) => (name.trim() || 'Inconnu')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .toLocaleLowerCase('fr-CH');

const createSupplierFromInvoice = (invoice: Invoice): Supplier => ({
  id: `supplier-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  name: invoice.supplier.trim() || 'Inconnu',
  category: invoice.category || 'Non catégorisé',
  invoiceCount: 1,
  totalAmount: invoice.amountTTC,
});

const recalculateSuppliers = (invoices: Invoice[], existingSuppliers: Supplier[]): Supplier[] => {
  const suppliersByName = new Map<string, Supplier>();

  existingSuppliers.forEach((supplier) => {
    suppliersByName.set(normalizeSupplierName(supplier.name), {
      ...supplier,
      invoiceCount: 0,
      totalAmount: 0,
    });
  });

  invoices.forEach((invoice) => {
    const supplierName = invoice.supplier.trim() || 'Inconnu';
    const normalizedName = normalizeSupplierName(supplierName);
    const existingSupplier = suppliersByName.get(normalizedName);

    if (existingSupplier) {
      suppliersByName.set(normalizedName, {
        ...existingSupplier,
        name: existingSupplier.name || supplierName,
        category: invoice.category || existingSupplier.category,
        invoiceCount: existingSupplier.invoiceCount + 1,
        totalAmount: existingSupplier.totalAmount + invoice.amountTTC,
      });
      return;
    }

    suppliersByName.set(normalizedName, createSupplierFromInvoice(invoice));
  });

  return Array.from(suppliersByName.values()).filter((supplier) => supplier.invoiceCount > 0);
};

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
  addInvoice: (inv) => set((state) => {
    const invoices = [...state.invoices, inv];
    const normalizedName = normalizeSupplierName(inv.supplier || 'Inconnu');
    const existingSupplier = state.suppliers.find(
      (supplier) => normalizeSupplierName(supplier.name) === normalizedName,
    );

    if (!existingSupplier) {
      return {
        invoices,
        suppliers: [...state.suppliers, createSupplierFromInvoice(inv)],
      };
    }

    return {
      invoices,
      suppliers: state.suppliers.map((supplier) => (
        supplier.id === existingSupplier.id
          ? {
              ...supplier,
              category: inv.category || supplier.category,
              invoiceCount: supplier.invoiceCount + 1,
              totalAmount: supplier.totalAmount + inv.amountTTC,
            }
          : supplier
      )),
    };
  }),
  updateInvoice: (id, updates) => set((state) => {
    const invoices = state.invoices.map((inv) => inv.id === id ? { ...inv, ...updates } : inv);

    return {
      invoices,
      suppliers: recalculateSuppliers(invoices, state.suppliers),
    };
  }),
  deleteInvoice: (id) => set((state) => {
    const invoices = state.invoices.filter((inv) => inv.id !== id);

    return {
      invoices,
      suppliers: recalculateSuppliers(invoices, state.suppliers),
    };
  }),
}));
