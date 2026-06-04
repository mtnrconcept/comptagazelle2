import { Download, FileSpreadsheet, FileText, FolderArchive } from 'lucide-react';
import { useStore } from '../store';

export default function Exports() {
  const { transactions, invoices } = useStore();

  const handleExportCSV = () => {
    const headers = 'Date;Description;Montant;Type;Catégorie;Référence;Rapproché\n';
    const rows = transactions.map(t => 
      `${t.date};${t.description};${t.type === 'debit' ? '-' : ''}${t.amount};${t.type};${t.category};${t.reference || ''};${t.reconciled ? 'Oui' : 'Non'}`
    ).join('\n');
    const csv = headers + rows;
    downloadFile(csv, 'transactions_gazelle.csv', 'text/csv');
  };

  const handleExportInvoicesCSV = () => {
    const headers = 'Fournisseur;N° Facture;Date;Échéance;HT;TVA;TTC;Catégorie;Statut\n';
    const rows = invoices.map(i =>
      `${i.supplier};${i.invoiceNumber};${i.date};${i.dueDate};${i.amountHT};${i.tva};${i.amountTTC};${i.category};${i.status}`
    ).join('\n');
    const csv = headers + rows;
    downloadFile(csv, 'factures_gazelle.csv', 'text/csv');
  };

  const handleExportIncomeStatement = () => {
    const revenue = transactions.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
    const purchases = transactions.filter(t => t.type === 'debit' && t.category === 'Achats marchandises').reduce((s, t) => s + t.amount, 0);
    const personnel = transactions.filter(t => t.type === 'debit' && t.category === 'Charges personnel').reduce((s, t) => s + t.amount, 0);
    const rent = transactions.filter(t => t.type === 'debit' && t.category === 'Loyer').reduce((s, t) => s + t.amount, 0);
    const exploitation = transactions.filter(t => t.type === 'debit' && t.category === 'Charges exploitation').reduce((s, t) => s + t.amount, 0);
    const insurance = transactions.filter(t => t.type === 'debit' && t.category === 'Assurances').reduce((s, t) => s + t.amount, 0);
    
    const content = `COMPTE DE RÉSULTAT - La Gazelle d'Or
Période: Mai 2026

Chiffre d'affaires: CHF ${revenue.toFixed(2)}
Coût des marchandises: CHF -${purchases.toFixed(2)}
Marge brute: CHF ${(revenue - purchases).toFixed(2)}
Charges de personnel: CHF -${personnel.toFixed(2)}
Loyer: CHF -${rent.toFixed(2)}
Charges d'exploitation: CHF -${exploitation.toFixed(2)}
Assurances: CHF -${insurance.toFixed(2)}
RÉSULTAT NET: CHF ${(revenue - purchases - personnel - rent - exploitation - insurance).toFixed(2)}

---
Document généré automatiquement par Gazelle Comptabilité.
Les données doivent être vérifiées par une personne compétente avant déclaration officielle.`;
    
    downloadFile(content, 'compte_resultat_mai2026.txt', 'text/plain');
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type: `${type};charset=utf-8;` });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exports = [
    { 
      label: 'Transactions (CSV)', 
      desc: 'Export de toutes les transactions bancaires au format CSV',
      icon: FileSpreadsheet,
      action: handleExportCSV,
      color: 'bg-emerald-50 text-emerald-600'
    },
    { 
      label: 'Factures (CSV)', 
      desc: 'Export de toutes les factures avec détails fournisseurs',
      icon: FileSpreadsheet,
      action: handleExportInvoicesCSV,
      color: 'bg-blue-50 text-blue-600'
    },
    { 
      label: 'Compte de résultat', 
      desc: 'Export du compte de résultat estimé au format texte',
      icon: FileText,
      action: handleExportIncomeStatement,
      color: 'bg-gold-50 text-gold-600'
    },
    { 
      label: 'Export fiduciaire', 
      desc: 'Package complet pour transmission à votre fiduciaire',
      icon: FolderArchive,
      action: handleExportCSV,
      color: 'bg-purple-50 text-purple-600'
    },
  ];

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-3xl font-bold text-dark-900 tracking-tight">Exports</h1>
        <p className="text-dark-400 text-sm mt-1.5 font-medium">Exportez vos données comptables dans différents formats</p>
      </div>

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
    </div>
  );
}
