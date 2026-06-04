import { AccountingCategory, AccountingEntry, BalanceSheet, IncomeStatementReport, Invoice, Period, ReportDataQuality, Transaction, VATReport } from '../types';

export const SWISS_VAT_RATES = {
  standard: 8.1,
  reduced: 2.6,
  hotel: 3.8,
} as const;

export const formatCHF = (value: number) => new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF' }).format(value);

export const getCurrentMonthPeriod = (): Period => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  return {
    start: new Date(year, month, 1).toISOString().slice(0, 10),
    end: new Date(year, month + 1, 0).toISOString().slice(0, 10),
  };
};

export const periodFromMonthValue = (value: string): Period => {
  const [year, month] = value.split('-').map(Number);
  return {
    start: new Date(year, month - 1, 1).toISOString().slice(0, 10),
    end: new Date(year, month, 0).toISOString().slice(0, 10),
  };
};

export const periodToMonthValue = (period: Period) => period.start.slice(0, 7);

export const formatPeriod = (period: Period) => {
  const start = new Date(`${period.start}T00:00:00`);
  const end = new Date(`${period.end}T00:00:00`);
  const sameMonth = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
  if (sameMonth) {
    return new Intl.DateTimeFormat('fr-CH', { month: 'long', year: 'numeric' }).format(start);
  }
  return `${new Intl.DateTimeFormat('fr-CH').format(start)} – ${new Intl.DateTimeFormat('fr-CH').format(end)}`;
};

export const formatDate = (date: string) => new Intl.DateTimeFormat('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${date}T00:00:00`));

const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const findCategoryCode = (categoryName: string, categories: AccountingCategory[]) =>
  categories.find((category) => normalize(category.name) === normalize(categoryName))?.code;

const expenseAccountForCategory = (categoryName: string, categories: AccountingCategory[]) => {
  const normalized = normalize(categoryName);
  if (normalized.includes('personnel')) return '5000';
  if (normalized.includes('loyer')) return '6000';
  if (normalized.includes('assurance')) return '6300';
  if (normalized.includes('exploitation')) return '6100';
  if (normalized.includes('marchandise')) return '4000';
  return findCategoryCode(categoryName, categories) ?? '6100';
};

const accountName = (code: string, categories: AccountingCategory[]) => {
  const standard: Record<string, string> = {
    '1020': 'Banque',
    '1100': 'Créances clients',
    '1170': 'TVA récupérable',
    '2000': 'Dettes fournisseurs',
    '2200': 'TVA due',
    '2800': 'Capitaux propres',
  };
  return categories.find((category) => category.code === code)?.name ?? standard[code] ?? `Compte ${code}`;
};

const entry = (partial: Omit<AccountingEntry, 'id'> & { idSeed: string }): AccountingEntry => ({
  id: `${partial.sourceType}-${partial.sourceId}-${partial.idSeed}`,
  date: partial.date,
  description: partial.description,
  accountCode: partial.accountCode,
  accountName: partial.accountName,
  debit: partial.debit,
  credit: partial.credit,
  category: partial.category,
  sourceType: partial.sourceType,
  sourceId: partial.sourceId,
  validated: partial.validated,
  demo: partial.demo,
});

export const entriesFromTransaction = (transaction: Transaction, categories: AccountingCategory[]): AccountingEntry[] => {
  const amount = Math.abs(transaction.amount);
  const revenueCode = findCategoryCode(transaction.category, categories) ?? '3000';
  const expenseCode = expenseAccountForCategory(transaction.category, categories);
  const isCredit = transaction.type === 'credit';
  const validated = transaction.reconciled;
  return isCredit ? [
    entry({ idSeed: 'bank-dr', date: transaction.date, description: transaction.description, accountCode: '1020', accountName: accountName('1020', categories), debit: amount, credit: 0, category: transaction.category, sourceType: 'transaction', sourceId: transaction.id, validated }),
    entry({ idSeed: 'revenue-cr', date: transaction.date, description: transaction.description, accountCode: revenueCode, accountName: accountName(revenueCode, categories), debit: 0, credit: amount, category: transaction.category, sourceType: 'transaction', sourceId: transaction.id, validated }),
  ] : [
    entry({ idSeed: 'expense-dr', date: transaction.date, description: transaction.description, accountCode: expenseCode, accountName: accountName(expenseCode, categories), debit: amount, credit: 0, category: transaction.category, sourceType: 'transaction', sourceId: transaction.id, validated }),
    entry({ idSeed: 'bank-cr', date: transaction.date, description: transaction.description, accountCode: '1020', accountName: accountName('1020', categories), debit: 0, credit: amount, category: transaction.category, sourceType: 'transaction', sourceId: transaction.id, validated }),
  ];
};

export const entriesFromInvoice = (invoice: Invoice, categories: AccountingCategory[]): AccountingEntry[] => {
  const validated = invoice.status === 'paid';
  const expenseCode = expenseAccountForCategory(invoice.category, categories);
  return [
    entry({ idSeed: 'expense-dr', date: invoice.date, description: `Facture ${invoice.supplier} ${invoice.invoiceNumber}`, accountCode: expenseCode, accountName: accountName(expenseCode, categories), debit: invoice.amountHT, credit: 0, category: invoice.category, sourceType: 'invoice', sourceId: invoice.id, validated }),
    entry({ idSeed: 'vat-dr', date: invoice.date, description: `TVA facture ${invoice.supplier} ${invoice.invoiceNumber}`, accountCode: '1170', accountName: accountName('1170', categories), debit: invoice.tva, credit: 0, category: 'TVA récupérable', sourceType: 'invoice', sourceId: invoice.id, validated }),
    entry({ idSeed: 'supplier-cr', date: invoice.date, description: `Dette ${invoice.supplier} ${invoice.invoiceNumber}`, accountCode: '2000', accountName: accountName('2000', categories), debit: 0, credit: invoice.amountTTC, category: invoice.category, sourceType: 'invoice', sourceId: invoice.id, validated }),
  ];
};

export const filterEntriesByPeriod = (entries: AccountingEntry[], period: Period, includeDemo = false) =>
  entries.filter((entry) => entry.date >= period.start && entry.date <= period.end && (includeDemo || !entry.demo));

const balance = (entries: AccountingEntry[], code: string) =>
  entries.filter((entry) => entry.accountCode === code).reduce((sum, entry) => sum + entry.debit - entry.credit, 0);

const creditBalance = (entries: AccountingEntry[], code: string) => -balance(entries, code);

const sumDebits = (entries: AccountingEntry[], predicate: (entry: AccountingEntry) => boolean) =>
  entries.filter(predicate).reduce((sum, entry) => sum + entry.debit, 0);

const sumCredits = (entries: AccountingEntry[], predicate: (entry: AccountingEntry) => boolean) =>
  entries.filter(predicate).reduce((sum, entry) => sum + entry.credit, 0);

const isRevenue = (entry: AccountingEntry) => entry.accountCode.startsWith('3');
const isExpense = (entry: AccountingEntry) => /^[45678]/.test(entry.accountCode);

export const buildIncomeStatement = (entries: AccountingEntry[]): IncomeStatementReport => {
  const revenue = sumCredits(entries, isRevenue) - sumDebits(entries, isRevenue);
  const purchases = sumDebits(entries, (entry) => entry.accountCode.startsWith('4')) - sumCredits(entries, (entry) => entry.accountCode.startsWith('4'));
  const personnel = sumDebits(entries, (entry) => entry.accountCode.startsWith('5')) - sumCredits(entries, (entry) => entry.accountCode.startsWith('5'));
  const fixedCharges = sumDebits(entries, (entry) => ['6000', '6300'].includes(entry.accountCode)) - sumCredits(entries, (entry) => ['6000', '6300'].includes(entry.accountCode));
  const variableCharges = sumDebits(entries, (entry) => isExpense(entry) && !entry.accountCode.startsWith('4') && !entry.accountCode.startsWith('5') && !['6000', '6300'].includes(entry.accountCode)) - sumCredits(entries, (entry) => isExpense(entry) && !entry.accountCode.startsWith('4') && !entry.accountCode.startsWith('5') && !['6000', '6300'].includes(entry.accountCode));
  const grossMargin = revenue - purchases;
  const ebitda = grossMargin - personnel - fixedCharges - variableCharges;
  return { revenue, purchases, grossMargin, personnel, fixedCharges, variableCharges, ebitda, netResult: ebitda };
};

export const buildVATReport = (entries: AccountingEntry[], period: Period): VATReport => {
  const collected = creditBalance(entries, '2200');
  const deductible = balance(entries, '1170');
  return { period: formatPeriod(period), collected, deductible, netPayable: collected - deductible };
};

export const buildBalanceSheet = (entriesUntilDate: AccountingEntry[]): BalanceSheet => {
  const bank = balance(entriesUntilDate, '1020');
  const receivables = balance(entriesUntilDate, '1100');
  const vatRecoverable = Math.max(balance(entriesUntilDate, '1170'), 0);
  const supplierDebts = Math.max(creditBalance(entriesUntilDate, '2000'), 0);
  const vatPayable = Math.max(creditBalance(entriesUntilDate, '2200') - vatRecoverable, 0);
  const netResult = buildIncomeStatement(entriesUntilDate).netResult;
  const totalKnownAssets = bank + receivables + vatRecoverable;
  const totalKnownLiabilities = supplierDebts + vatPayable + netResult;
  const equity = totalKnownAssets - totalKnownLiabilities;
  return {
    assets: { bank, cash: 0, receivables, stock: 0, fixedAssets: 0, vatRecoverable },
    liabilities: { supplierDebts, taxDebts: 0, vatPayable, loans: 0, equity, netResult },
  };
};

export const buildMonthlyData = (entries: AccountingEntry[], year: number) =>
  Array.from({ length: 12 }, (_, month) => {
    const period = periodFromMonthValue(`${year}-${String(month + 1).padStart(2, '0')}`);
    const statement = buildIncomeStatement(entries.filter((entry) => entry.date >= period.start && entry.date <= period.end));
    return {
      month: new Intl.DateTimeFormat('fr-CH', { month: 'short' }).format(new Date(year, month, 1)),
      revenue: statement.revenue,
      expenses: statement.purchases + statement.personnel + statement.fixedCharges + statement.variableCharges,
      profit: statement.netResult,
    };
  });

export const assessDataQuality = (entries: AccountingEntry[], periodEntries: AccountingEntry[]): ReportDataQuality => {
  const issues: string[] = [];
  if (entries.length === 0) issues.push('Aucune écriture comptable source n’est disponible.');
  if (periodEntries.length === 0) issues.push('Aucune écriture comptable ne correspond à la période sélectionnée.');
  const unvalidatedCount = periodEntries.filter((entry) => !entry.validated).length;
  if (unvalidatedCount > 0) issues.push(`${unvalidatedCount} écriture(s) de la période ne sont pas validée(s) ou rapprochée(s).`);
  const totalDebits = periodEntries.reduce((sum, entry) => sum + entry.debit, 0);
  const totalCredits = periodEntries.reduce((sum, entry) => sum + entry.credit, 0);
  if (Math.abs(totalDebits - totalCredits) > 0.01) issues.push('La balance débit/crédit de la période n’est pas équilibrée.');
  return { complete: issues.length === 0, validated: unvalidatedCount === 0, issues };
};
