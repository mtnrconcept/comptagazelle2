import { create } from 'zustand';
import { Transaction, Invoice, Supplier, AccountingCategory, AccountingEntry, MonthlyData, Alert } from '../types';
import {
  AccountingCategory,
  AccountingDocument,
  AccountingEntry,
  Alert,
  Invoice,
  MonthlyData,
  PersistentStateSnapshot,
  Supplier,
  Transaction,
} from '../types';
import {
  PersistenceStatus,
  buildBackup,
  deleteRecord,
  loadSnapshot,
  replaceSnapshot,
  upsertRecords,
} from './persistence';

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
  documents: AccountingDocument[];
  accountingEntries: AccountingEntry[];
  alerts: Alert[];
  monthlyData: MonthlyData[];
  persistenceStatus: PersistenceStatus;
  persistenceError?: string;
  lastSyncedAt?: string;
  initializePersistence: () => Promise<void>;
  exportBackup: () => string;
  importBackup: (backupJson: string) => Promise<void>;
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

const createSupplierFromInvoice = (invoice: Invoice): Supplier => ({
  id: `supplier-${invoice.supplier.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}`,
  name: invoice.supplier,
  category: invoice.category,
  invoiceCount: 1,
  totalAmount: invoice.amountTTC,
});

const mergeSuppliers = (suppliers: Supplier[], invoices: Invoice[]): Supplier[] => {
  const byName = new Map<string, Supplier>();

  suppliers.forEach((supplier) => {
    byName.set(supplier.name.toLowerCase(), { ...supplier, invoiceCount: 0, totalAmount: 0 });
  });

  invoices.forEach((invoice) => {
    const key = invoice.supplier.toLowerCase();
    const existing = byName.get(key) ?? createSupplierFromInvoice(invoice);
    byName.set(key, {
      ...existing,
      category: existing.category || invoice.category,
      invoiceCount: existing.invoiceCount + 1,
      totalAmount: existing.totalAmount + invoice.amountTTC,
    });
  });

  return Array.from(byName.values());
};

const buildInvoiceDocument = (invoice: Invoice): AccountingDocument | undefined => {
  if (!invoice.fileName && !invoice.fileUrl) return undefined;

  return {
    id: `document-${invoice.id}`,
    entityType: 'invoice',
    entityId: invoice.id,
    fileName: invoice.fileName ?? `facture-${invoice.invoiceNumber}.pdf`,
    fileUrl: invoice.fileUrl,
    uploadedAt: new Date().toISOString(),
  };
};

const buildInvoiceEntry = (invoice: Invoice): AccountingEntry => ({
  id: `entry-invoice-${invoice.id}`,
  date: invoice.date,
  label: `Facture ${invoice.invoiceNumber} - ${invoice.supplier}`,
  sourceType: 'invoice',
  sourceId: invoice.id,
  createdAt: new Date().toISOString(),
  lines: [
    {
      accountCode: '4000',
      label: invoice.category,
      debit: invoice.amountHT,
      credit: 0,
    },
    {
      accountCode: '1170',
      label: 'TVA déductible',
      debit: invoice.tva,
      credit: 0,
    },
    {
      accountCode: '2000',
      label: `Dette fournisseur ${invoice.supplier}`,
      debit: 0,
      credit: invoice.amountTTC,
    },
  ],
});

const buildTransactionEntry = (transaction: Transaction): AccountingEntry => ({
  id: `entry-transaction-${transaction.id}`,
  date: transaction.date,
  label: transaction.description,
  sourceType: 'transaction',
  sourceId: transaction.id,
  createdAt: new Date().toISOString(),
  lines: transaction.type === 'credit'
    ? [
        { accountCode: '1020', label: 'Banque', debit: transaction.amount, credit: 0 },
        { accountCode: '3000', label: transaction.category, debit: 0, credit: transaction.amount },
      ]
    : [
        { accountCode: '4000', label: transaction.category, debit: transaction.amount, credit: 0 },
        { accountCode: '1020', label: 'Banque', debit: 0, credit: transaction.amount },
      ],
});

const syncOperation = async (operation: () => Promise<void>, set: (partial: Partial<AppState>) => void) => {
  set({ persistenceStatus: 'syncing', persistenceError: undefined });

  try {
    await operation();
    set({ persistenceStatus: 'synced', lastSyncedAt: new Date().toISOString(), persistenceError: undefined });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue pendant la sauvegarde.';
    set({ persistenceStatus: 'error', persistenceError: message });
  }
};

const snapshotFromState = (state: AppState): PersistentStateSnapshot => ({
  invoices: state.invoices,
  transactions: state.transactions,
  suppliers: state.suppliers,
  categories: state.categories,
  documents: state.documents,
  accountingEntries: state.accountingEntries,
});

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
  documents: [],
  accountingEntries: [],
  alerts: [],
  monthlyData: [],
  persistenceStatus: 'idle',
  initializePersistence: async () => {
    set({ persistenceStatus: 'loading', persistenceError: undefined });

    try {
      const snapshot = await loadSnapshot();
      const categories = snapshot.categories.length > 0 ? snapshot.categories : defaultCategories;
      const suppliers = mergeSuppliers(snapshot.suppliers, snapshot.invoices);

      set({
        ...snapshot,
        categories,
        suppliers,
        persistenceStatus: 'synced',
        lastSyncedAt: new Date().toISOString(),
      });

      if (snapshot.categories.length === 0) {
        await upsertRecords('categories', defaultCategories);
      }

      if (suppliers.length !== snapshot.suppliers.length) {
        await upsertRecords('suppliers', suppliers);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossible de charger les données locales.';
      set({ persistenceStatus: 'error', persistenceError: message });
    }
  },
  exportBackup: () => JSON.stringify(buildBackup(snapshotFromState(get())), null, 2),
  importBackup: async (backupJson) => {
    set({ persistenceStatus: 'syncing', persistenceError: undefined });

    try {
      const parsed = JSON.parse(backupJson) as { stores?: PersistentStateSnapshot };

      if (!parsed.stores) {
        throw new Error('Le fichier de sauvegarde ne contient pas de données importables.');
      }

      const snapshot = parsed.stores;
      await replaceSnapshot(snapshot);
      set({
        ...snapshot,
        categories: snapshot.categories.length > 0 ? snapshot.categories : defaultCategories,
        persistenceStatus: 'synced',
        lastSyncedAt: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import de sauvegarde impossible.';
      set({ persistenceStatus: 'error', persistenceError: message });
    }
  },
  addTransaction: (transaction) => {
    const entry = buildTransactionEntry(transaction);
    set((state) => ({
      transactions: [...state.transactions, transaction],
      accountingEntries: [...state.accountingEntries, entry],
    }));

    void syncOperation(
      () => Promise.all([
        upsertRecords('transactions', [transaction]),
        upsertRecords('accounting_entries', [entry]),
      ]).then(() => undefined),
      set,
    );
  },
  addTransactions: (transactions) => {
    const entries = transactions.map(buildTransactionEntry);
    set((state) => ({
      transactions: [...state.transactions, ...transactions],
      accountingEntries: [...state.accountingEntries, ...entries],
    }));

    void syncOperation(
      () => Promise.all([
        upsertRecords('transactions', transactions),
        upsertRecords('accounting_entries', entries),
      ]).then(() => undefined),
      set,
    );
  },
  addInvoice: (invoice) => {
    const document = buildInvoiceDocument(invoice);
    const entry = buildInvoiceEntry(invoice);

    set((state) => {
      const invoices = [...state.invoices, invoice];
      return {
        invoices,
        suppliers: mergeSuppliers(state.suppliers, invoices),
        documents: document ? [...state.documents, document] : state.documents,
        accountingEntries: [...state.accountingEntries, entry],
      };
    });

    void syncOperation(async () => {
      const state = get();
      await Promise.all([
        upsertRecords('invoices', [invoice]),
        upsertRecords('suppliers', state.suppliers),
        document ? upsertRecords('documents', [document]) : Promise.resolve(),
        upsertRecords('accounting_entries', [entry]),
      ]);
    }, set);
  },
  updateInvoice: (id, updates) => {
    let updatedInvoice: Invoice | undefined;

    set((state) => {
      const invoices = state.invoices.map((invoice) => {
        if (invoice.id !== id) return invoice;
        updatedInvoice = { ...invoice, ...updates };
        return updatedInvoice;
      });

      return {
        invoices,
        suppliers: mergeSuppliers(state.suppliers, invoices),
        accountingEntries: state.accountingEntries.map((entry) => (
          entry.id === `entry-invoice-${id}` && updatedInvoice ? buildInvoiceEntry(updatedInvoice) : entry
        )),
      };
    });

    if (updatedInvoice) {
      void syncOperation(async () => {
        const state = get();
        await Promise.all([
          upsertRecords('invoices', [updatedInvoice]),
          upsertRecords('suppliers', state.suppliers),
          upsertRecords('accounting_entries', [buildInvoiceEntry(updatedInvoice)]),
        ]);
      }, set);
    }
  },
  deleteInvoice: (id) => {
    set((state) => {
      const invoices = state.invoices.filter((invoice) => invoice.id !== id);
      return {
        invoices,
        suppliers: mergeSuppliers(state.suppliers, invoices),
        documents: state.documents.filter((document) => document.entityId !== id),
        accountingEntries: state.accountingEntries.filter((entry) => entry.sourceId !== id),
      };
    });

    void syncOperation(async () => {
      await Promise.all([
        deleteRecord('invoices', id),
        deleteRecord('documents', `document-${id}`),
        deleteRecord('accounting_entries', `entry-invoice-${id}`),
      ]);
      await replaceSnapshot(snapshotFromState(get()));
    }, set);
  },
}));
