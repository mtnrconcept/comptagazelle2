// Types for Gazelle Comptabilité

export interface Period {
  start: string;
  end: string;
}

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

export interface MonthlyData {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export interface AccountingEntry {
  id: string;
  date: string;
  description: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  category: string;
  sourceType: 'transaction' | 'invoice' | 'manual' | 'demo';
  sourceId: string;
  validated: boolean;
  demo?: boolean;
}

export interface BalanceSheet {
  assets: {
    bank: number;
    cash: number;
    receivables: number;
    stock: number;
    fixedAssets: number;
    vatRecoverable: number;
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

export interface IncomeStatementReport {
  revenue: number;
  purchases: number;
  grossMargin: number;
  personnel: number;
  fixedCharges: number;
  variableCharges: number;
  ebitda: number;
  netResult: number;
}

export interface ReportDataQuality {
  complete: boolean;
  validated: boolean;
  issues: string[];
}

export interface Alert {
  id: string;
  type: 'warning' | 'danger' | 'info';
  message: string;
  date: string;
}
