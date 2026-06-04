import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, FolderArchive } from 'lucide-react';
import { useStore } from '../store';
import PeriodSelector from '../components/reporting/PeriodSelector';
import DataQualityWarning from '../components/reporting/DataQualityWarning';
import { assessDataQuality, buildIncomeStatement, filterEntriesByPeriod, formatCHF, formatPeriod, getCurrentMonthPeriod, periodToMonthValue } from '../utils/accounting';

export default function Exports() {
  const { transactions, invoices, accountingEntries, demoMode } = useStore();
  const [period, setPeriod] = useState(getCurrentMonthPeriod);
  const periodEntries = filterEntriesByPeriod(accountingEntries, period, demoMode);
  const statement = buildIncomeStatement(periodEntries);
  const quality = assessDataQuality(accountingEntries, periodEntries);

  const handleExportCSV = () => {
    const headers = 'Date;Description;Compte;Libellé compte;Débit;Crédit;Catégorie;Source;Validée\n';
    const rows = periodEntries.map((entry) =>
      `${entry.date};${entry.description};${entry.accountCode};${entry.accountName};${entry.debit};${entry.credit};${entry.category};${entry.sourceType};${entry.validated ? 'Oui' : 'Non'}`
    ).join('\n');
    downloadFile(headers + rows, `ecritures_${periodToMonthValue(period)}.csv`, 'text/csv');
  };

  const handleExportTransactionsCSV = () => {
    const headers = 'Date;Description;Montant;Type;Catégorie;Référence;Rapproché\n';
    const rows = transactions
      .filter((transaction) => transaction.date >= period.start && transaction.date <= period.end)
      .map((transaction) =>
        `${transaction.date};${transaction.description};${transaction.type === 'debit' ? '-' : ''}${transaction.amount};${transaction.type};${transaction.category};${transaction.reference || ''};${transaction.reconciled ? 'Oui' : 'Non'}`
      ).join('\n');
    downloadFile(headers + rows, `transactions_${periodToMonthValue(period)}.csv`, 'text/csv');
  };

  const handleExportInvoicesCSV = () => {
    const headers = 'Fournisseur;N° Facture;Date;Échéance;HT;TVA;TTC;Catégorie;Statut\n';
    const rows = invoices
      .filter((invoice) => invoice.date >= period.start && invoice.date <= period.end)
      .map((invoice) =>
        `${invoice.supplier};${invoice.invoiceNumber};${invoice.date};${invoice.dueDate};${invoice.amountHT};${invoice.tva};${invoice.amountTTC};${invoice.category};${invoice.status}`
      ).join('\n');
    downloadFile(headers + rows, `factures_${periodToMonthValue(period)}.csv`, 'text/csv');
  };

  const handleExportIncomeStatement = () => {
    const content = `COMPTE DE RÉSULTAT - La Gazelle d'Or
Période: ${formatPeriod(period)}

Chiffre d'affaires: ${formatCHF(statement.revenue)}
Coût des marchandises: ${formatCHF(-statement.purchases)}
Marge brute: ${formatCHF(statement.grossMargin)}
Charges de personnel: ${formatCHF(-statement.personnel)}
Charges fixes: ${formatCHF(-statement.fixedCharges)}
Charges variables: ${formatCHF(-statement.variableCharges)}
RÉSULTAT NET: ${formatCHF(statement.netResult)}

Qualité des données: ${quality.complete ? 'complètes et validées' : quality.issues.join(' | ')}

---
Document généré automatiquement par Gazelle Comptabilité à partir des écritures comptables de la période.
Les données doivent être vérifiées par une personne compétente avant déclaration officielle.`;

    downloadFile(content, `compte_resultat_${periodToMonthValue(period)}.txt`, 'text/plain');
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type: `${type};charset=utf-8;` });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };


  const handleExportBackup = () => {
    downloadFile(exportBackup(), `sauvegarde_gazelle_${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
  };

  const exports = [
    {
      label: 'Écritures comptables (CSV)',
      desc: 'Export de la source comptable unique filtrée par période',
      icon: FileSpreadsheet,
      action: handleExportCSV,
      color: 'bg-emerald-50 text-emerald-600'
    },
    {
      label: 'Transactions (CSV)',
      desc: 'Export des transactions bancaires de la période',
      icon: FileSpreadsheet,
      action: handleExportTransactionsCSV,
      color: 'bg-blue-50 text-blue-600'
    },
    {
      label: 'Factures (CSV)',
      desc: 'Export des factures de la période avec détails fournisseurs',
      icon: FileSpreadsheet,
      action: handleExportInvoicesCSV,
      color: 'bg-purple-50 text-purple-600'
    },
    {
      label: 'Compte de résultat',
      desc: 'Export du compte de résultat calculé au format texte',
      icon: FileText,
      action: handleExportIncomeStatement,
      color: 'bg-gold-50 text-gold-600'
    },
    {
      label: 'Export fiduciaire',
      desc: 'Package comptable basé sur les écritures validées de la période',
      icon: FolderArchive,
      action: handleExportCSV,
      color: 'bg-dark-50 text-dark-700'
    },
  ];

  return (
    <div className="space-y-7">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-dark-900 tracking-tight">Exports</h1>
          <p className="text-dark-400 text-sm mt-1.5 font-medium">Exportez vos écritures et rapports pour {formatPeriod(period)}</p>
        </div>
        <PeriodSelector period={period} onChange={setPeriod} />
      </div>

      <DataQualityWarning quality={quality} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {exports.map((exp) => (
          <div key={exp.label} className="bg-white rounded-2xl border border-dark-100/50 p-6 shadow-soft card-hover">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-lg ${exp.color}`}>
                <exp.icon size={24} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-dark-900">{exp.label}</h3>
                <p className="text-sm text-dark-500 mt-1">{exp.desc}</p>
                <button
                  onClick={exp.action}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-dark-900 text-white rounded-xl text-sm font-medium hover:bg-dark-800 transition-all btn-premium"
                >
                  <Download size={14} />
                  Télécharger
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-dark-50 rounded-lg p-4 text-sm text-dark-600">
        <p>💡 <strong>Conseil :</strong> Pour une comptabilité officielle, transmettez régulièrement vos exports à votre fiduciaire pour validation et déclaration.</p>
      </div>

      <div className="bg-gold-50/80 border border-gold-200 rounded-xl p-4 text-sm text-gold-800">
        <p className="font-semibold">Stratégie anti-perte de données</p>
        <p className="mt-1">Téléchargez la sauvegarde complète JSON après chaque session de saisie et conservez une copie hors de cet appareil. Elle permet de restaurer toutes les tables persistantes du MVP local.</p>
      </div>
    </div>
  );
}
