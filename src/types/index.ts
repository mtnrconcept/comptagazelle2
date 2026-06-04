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
  accountingEntryId?: string;
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
  accountingEntryId?: string;
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

export interface AccountingLine {
  id: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  categoryId?: string;
  categoryName?: string;
  invoiceId?: string;
  supplierId?: string;
  transactionId?: string;
  vatRate?: number;
  kind: 'ht' | 'vat' | 'ttc' | 'bank' | 'other';
}

export interface AccountingEntry {
  id: string;
  date: string;
  description: string;
  reference?: string;
  invoiceId?: string;
  supplierId?: string;
  transactionId?: string;
  categoryId?: string;
  categoryName?: string;
  status: 'to_validate' | 'validated' | 'exported';
  source: 'invoice_scan' | 'bank_import' | 'manual';
  lines: AccountingLine[];
  createdAt: string;
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
