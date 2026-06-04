// Types for Gazelle Comptabilité

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  category: string;
  reference?: string;
  invoiceId?: string;
  reconciled: boolean;
}

export interface Invoice {
  id: string;
  supplier: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  amountHT: number;
  tva: number;
  amountTTC: number;
  currency: string;
  category: string;
  status: 'pending' | 'paid' | 'overdue';
  fileName?: string;
  fileUrl?: string;
  transactionId?: string;
  iban?: string;
  paymentTerms?: string;
}

export interface Supplier {
  id: string;
  name: string;
  category: string;
  invoiceCount: number;
  totalAmount: number;
}

export interface AccountingCategory {
  id: string;
  name: string;
  type: 'revenue' | 'expense' | 'asset' | 'liability';
  code: string;
  parentId?: string;
}


export interface AccountingDocument {
  id: string;
  entityType: 'invoice' | 'transaction' | 'supplier' | 'accounting_entry';
  entityId: string;
  fileName: string;
  mimeType?: string;
  fileUrl?: string;
  checksum?: string;
  uploadedAt: string;
}

export interface AccountingEntryLine {
  accountCode: string;
  label: string;
  debit: number;
  credit: number;
}

export interface AccountingEntry {
  id: string;
  date: string;
  label: string;
  sourceType: 'invoice' | 'transaction' | 'manual';
  sourceId?: string;
  lines: AccountingEntryLine[];
  createdAt: string;
}

export interface PersistentStateSnapshot {
  invoices: Invoice[];
  transactions: Transaction[];
  suppliers: Supplier[];
  categories: AccountingCategory[];
  documents: AccountingDocument[];
  accountingEntries: AccountingEntry[];
}

export interface MonthlyData {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export interface BalanceSheet {
  assets: {
    bank: number;
    cash: number;
    receivables: number;
    stock: number;
    fixedAssets: number;
  };
  liabilities: {
    supplierDebts: number;
    taxDebts: number;
    vatPayable: number;
    loans: number;
    equity: number;
    netResult: number;
  };
}

export interface VATReport {
  period: string;
  collected: number;
  deductible: number;
  netPayable: number;
}

export interface Alert {
  id: string;
  type: 'warning' | 'danger' | 'info';
  message: string;
  date: string;
}
