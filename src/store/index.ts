import { create } from 'zustand';
import { Transaction, Invoice, Supplier, AccountingCategory, AccountingEntry, MonthlyData, Alert } from '../types';

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

const SUPPLIER_DEBT_ACCOUNT = { code: '2000', name: 'Dettes fournisseurs' };
const VAT_RECOVERABLE_ACCOUNT = { code: '1170', name: 'TVA récupérable' };
const BANK_ACCOUNT = { code: '1020', name: 'Banque' };
const SALES_ACCOUNT = { code: '3000', name: 'Chiffre d\'affaires' };

interface InvoiceAccountingPayload {
  invoice: Invoice;
  categoryName?: string;
}

interface InvoiceAccountingResult {
  invoice: Invoice;
  supplier: Supplier;
  transaction: Transaction;
  accountingEntry: AccountingEntry;
}

interface AppState {
  transactions: Transaction[];
  invoices: Invoice[];
  suppliers: Supplier[];
  categories: AccountingCategory[];
  accountingEntries: AccountingEntry[];
  alerts: Alert[];
  monthlyData: MonthlyData[];
  addTransaction: (t: Transaction) => void;
  addTransactions: (ts: Transaction[]) => void;
  addInvoice: (inv: Invoice) => void;
  saveInvoiceAccountingFlow: (payload: InvoiceAccountingPayload) => InvoiceAccountingResult;
  updateInvoice: (id: string, inv: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;
}

const normalize = (value: string) => value.trim().toLowerCase();
const rounded = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;

const findAccountingCategory = (categories: AccountingCategory[], categoryName?: string) => {
  const fallback = categories.find((c) => c.name === 'Frais administratifs') || categories.find((c) => c.type === 'expense') || categories[0];
  if (!categoryName) return fallback;

  const normalized = normalize(categoryName);
  return categories.find((c) => normalize(c.name) === normalized)
    || categories.find((c) => normalized.includes(normalize(c.name)) || normalize(c.name).includes(normalized))
    || fallback;
};

const buildSupplier = (suppliers: Supplier[], invoice: Invoice, supplierId: string): Supplier => {
  const existing = suppliers.find((s) => normalize(s.name) === normalize(invoice.supplier));
  if (existing) {
    return {
      ...existing,
      category: invoice.category || existing.category,
      invoiceCount: existing.invoiceCount + 1,
      totalAmount: rounded(existing.totalAmount + invoice.amountTTC),
    };
  }

  return {
    id: supplierId,
    name: invoice.supplier,
    category: invoice.category,
    invoiceCount: 1,
    totalAmount: rounded(invoice.amountTTC),
  };
};

const transactionToAccountingEntry = (transaction: Transaction, categories: AccountingCategory[]): AccountingEntry => {
  const category = transaction.type === 'credit'
    ? categories.find((c) => c.type === 'revenue' && c.name === transaction.category) || categories.find((c) => c.type === 'revenue')
    : findAccountingCategory(categories, transaction.category);
  const entryId = transaction.accountingEntryId || `entry-${transaction.id}`;
  const lineBase = `${entryId}-line`;
  const amount = rounded(transaction.amount);
  const description = transaction.description || 'Transaction importée';

  return {
    id: entryId,
    date: transaction.date,
    description,
    reference: transaction.reference,
    transactionId: transaction.id,
    categoryId: category?.id,
    categoryName: category?.name || transaction.category,
    status: transaction.reconciled ? 'validated' : 'to_validate',
    source: 'bank_import',
    createdAt: new Date().toISOString(),
    lines: transaction.type === 'credit'
      ? [
          {
            id: `${lineBase}-bank`,
            accountCode: BANK_ACCOUNT.code,
            accountName: BANK_ACCOUNT.name,
            debit: amount,
            credit: 0,
            transactionId: transaction.id,
            kind: 'bank',
          },
          {
            id: `${lineBase}-revenue`,
            accountCode: category?.code || SALES_ACCOUNT.code,
            accountName: category?.name || SALES_ACCOUNT.name,
            debit: 0,
            credit: amount,
            categoryId: category?.id,
            categoryName: category?.name || transaction.category,
            transactionId: transaction.id,
            kind: 'ht',
          },
        ]
      : [
          {
            id: `${lineBase}-expense`,
            accountCode: category?.code || '6200',
            accountName: category?.name || transaction.category || 'Charge',
            debit: amount,
            credit: 0,
            categoryId: category?.id,
            categoryName: category?.name || transaction.category,
            transactionId: transaction.id,
            kind: 'ht',
          },
          {
            id: `${lineBase}-bank`,
            accountCode: BANK_ACCOUNT.code,
            accountName: BANK_ACCOUNT.name,
            debit: 0,
            credit: amount,
            transactionId: transaction.id,
            kind: 'bank',
          },
        ],
  };
};

export const useStore = create<AppState>((set, get) => ({
  transactions: [],
  invoices: [],
  suppliers: [],
  categories: defaultCategories,
  accountingEntries: [],
  alerts: [],
  monthlyData: [],
  addTransaction: (t) => set((state) => ({
    transactions: [...state.transactions, t],
    accountingEntries: [...state.accountingEntries, transactionToAccountingEntry(t, state.categories)],
  })),
  addTransactions: (ts) => set((state) => ({
    transactions: [...state.transactions, ...ts],
    accountingEntries: [
      ...state.accountingEntries,
      ...ts.map((transaction) => transactionToAccountingEntry(transaction, state.categories)),
    ],
  })),
  addInvoice: (inv) => set((state) => ({ invoices: [...state.invoices, inv] })),
  saveInvoiceAccountingFlow: ({ invoice, categoryName }) => {
    const state = get();
    const timestamp = Date.now();
    const category = findAccountingCategory(state.categories, categoryName || invoice.category);
    const existingSupplier = state.suppliers.find((s) => normalize(s.name) === normalize(invoice.supplier));
    const supplierId = existingSupplier?.id || `sup-${timestamp}`;
    const transactionId = invoice.transactionId || `trx-${timestamp}`;
    const accountingEntryId = invoice.accountingEntryId || `entry-${timestamp}`;
    const finalInvoice: Invoice = {
      ...invoice,
      category: category?.name || invoice.category,
      transactionId,
      accountingEntryId,
    };
    const supplier = buildSupplier(state.suppliers, finalInvoice, supplierId);
    const amountHT = rounded(finalInvoice.amountHT);
    const tva = rounded(finalInvoice.tva);
    const amountTTC = rounded(finalInvoice.amountTTC || amountHT + tva);
    const transaction: Transaction = {
      id: transactionId,
      date: finalInvoice.date,
      description: `Dette fournisseur — ${finalInvoice.supplier} ${finalInvoice.invoiceNumber}`.trim(),
      amount: amountTTC,
      type: 'debit',
      category: finalInvoice.category,
      reference: finalInvoice.invoiceNumber,
      invoiceId: finalInvoice.id,
      accountingEntryId,
      reconciled: false,
    };
    const accountingEntry: AccountingEntry = {
      id: accountingEntryId,
      date: finalInvoice.date,
      description: `Facture fournisseur ${finalInvoice.supplier} ${finalInvoice.invoiceNumber}`.trim(),
      reference: finalInvoice.invoiceNumber,
      invoiceId: finalInvoice.id,
      supplierId,
      transactionId,
      categoryId: category?.id,
      categoryName: category?.name || finalInvoice.category,
      status: 'to_validate',
      source: 'invoice_scan',
      createdAt: new Date().toISOString(),
      lines: [
        {
          id: `${accountingEntryId}-ht`,
          accountCode: category?.code || '6200',
          accountName: category?.name || finalInvoice.category,
          debit: amountHT,
          credit: 0,
          categoryId: category?.id,
          categoryName: category?.name || finalInvoice.category,
          invoiceId: finalInvoice.id,
          supplierId,
          transactionId,
          kind: 'ht',
        },
        {
          id: `${accountingEntryId}-vat`,
          accountCode: VAT_RECOVERABLE_ACCOUNT.code,
          accountName: VAT_RECOVERABLE_ACCOUNT.name,
          debit: tva,
          credit: 0,
          invoiceId: finalInvoice.id,
          supplierId,
          transactionId,
          vatRate: amountHT > 0 ? rounded((tva / amountHT) * 100) : undefined,
          kind: 'vat',
        },
        {
          id: `${accountingEntryId}-ttc`,
          accountCode: SUPPLIER_DEBT_ACCOUNT.code,
          accountName: SUPPLIER_DEBT_ACCOUNT.name,
          debit: 0,
          credit: amountTTC,
          invoiceId: finalInvoice.id,
          supplierId,
          transactionId,
          kind: 'ttc',
        },
      ],
    };

    set((current) => ({
      invoices: [...current.invoices, finalInvoice],
      suppliers: existingSupplier
        ? current.suppliers.map((s) => (s.id === existingSupplier.id ? supplier : s))
        : [...current.suppliers, supplier],
      transactions: [...current.transactions, transaction],
      accountingEntries: [...current.accountingEntries, accountingEntry],
    }));

    return { invoice: finalInvoice, supplier, transaction, accountingEntry };
  },
  updateInvoice: (id, updates) => set((state) => ({
    invoices: state.invoices.map((inv) => inv.id === id ? { ...inv, ...updates } : inv),
  })),
  deleteInvoice: (id) => set((state) => ({
    invoices: state.invoices.filter((inv) => inv.id !== id),
    accountingEntries: state.accountingEntries.filter((entry) => entry.invoiceId !== id),
    transactions: state.transactions.filter((transaction) => transaction.invoiceId !== id),
  })),
}));
