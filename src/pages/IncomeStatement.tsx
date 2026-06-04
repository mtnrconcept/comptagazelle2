import { useStore } from '../store';
import { Download } from 'lucide-react';

export default function IncomeStatement() {
  const { transactions } = useStore();

  const revenue = transactions.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
  const purchases = transactions.filter(t => t.type === 'debit' && t.category === 'Achats marchandises').reduce((s, t) => s + t.amount, 0);
  const grossMargin = revenue - purchases;
  const personnel = transactions.filter(t => t.type === 'debit' && t.category === 'Charges personnel').reduce((s, t) => s + t.amount, 0);
  const rent = transactions.filter(t => t.type === 'debit' && t.category === 'Loyer').reduce((s, t) => s + t.amount, 0);
  const exploitation = transactions.filter(t => t.type === 'debit' && t.category === 'Charges exploitation').reduce((s, t) => s + t.amount, 0);
  const insurance = transactions.filter(t => t.type === 'debit' && t.category === 'Assurances').reduce((s, t) => s + t.amount, 0);
  const fixedCharges = rent + insurance;
  const variableCharges = exploitation;
  const ebitda = grossMargin - personnel - fixedCharges - variableCharges;
  const netResult = ebitda; // Simplified: no amortization/interest in MVP

  const formatCHF = (v: number) => new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF' }).format(v);

  const rows = [
    { label: 'Chiffre d\'affaires', value: revenue, bold: true, indent: 0 },
    { label: 'Coût des marchandises', value: -purchases, bold: false, indent: 1 },
    { label: 'Marge brute', value: grossMargin, bold: true, indent: 0, highlight: true },
    { label: 'Charges de personnel', value: -personnel, bold: false, indent: 1 },
    { label: 'Charges fixes (loyer, assurances)', value: -fixedCharges, bold: false, indent: 1 },
    { label: 'Charges variables (exploitation)', value: -variableCharges, bold: false, indent: 1 },
    { label: 'EBITDA estimé', value: ebitda, bold: true, indent: 0, highlight: true },
    { label: 'Résultat net estimé', value: netResult, bold: true, indent: 0, highlight: true, gold: true },
  ];

  return (
    <div className="space-y-7">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-dark-900 tracking-tight">Compte de résultat</h1>
          <p className="text-dark-400 text-sm mt-1.5 font-medium">Période : Mai 2026 (estimé)</p>
        </div>
        <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-dark-900 text-white rounded-xl text-sm font-medium hover:bg-dark-800 transition-all shadow-soft hover:shadow-card">
          <Download size={16} />
          Exporter PDF
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-dark-100/50 overflow-hidden shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-dark-50/80 border-b border-dark-100">
            <tr>
              <th className="text-left px-6 py-4 font-semibold text-dark-600">Poste comptable</th>
              <th className="text-right px-6 py-4 font-semibold text-dark-600">Montant (CHF)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-50">
            {rows.map((row, idx) => (
              <tr key={idx} className={row.highlight ? 'bg-dark-50/50' : ''}>
                <td className={`px-6 py-4 ${row.bold ? 'font-semibold text-dark-900' : 'text-dark-600'} ${row.indent ? 'pl-10' : ''}`}>
                  {row.label}
                </td>
                <td className={`px-6 py-4 text-right font-mono ${row.bold ? 'font-bold' : ''} ${row.gold ? 'text-gold-600 text-lg' : row.value >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {formatCHF(row.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-gold-50/80 border border-gold-200 rounded-xl p-4 text-sm text-gold-800">
        <p className="font-medium">⚠️ Estimation automatique</p>
        <p className="mt-1">Ce compte de résultat est généré automatiquement à partir des transactions enregistrées. Les données comptables doivent être vérifiées par une personne compétente avant déclaration officielle.</p>
      </div>
    </div>
  );
}
