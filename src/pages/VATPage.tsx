import { useStore } from '../store';
import { Download } from 'lucide-react';

export default function VATPage() {
  const { accountingEntries } = useStore();

  const vatCollected = accountingEntries.reduce((sum, entry) => (
    sum + entry.lines
      .filter((line) => line.kind === 'vat' && line.credit > 0)
      .reduce((lineSum, line) => lineSum + line.credit, 0)
  ), 0);
  const vatDeductible = accountingEntries.reduce((sum, entry) => (
    sum + entry.lines
      .filter((line) => line.kind === 'vat' && line.debit > 0)
      .reduce((lineSum, line) => lineSum + line.debit, 0)
  ), 0);
  const vatNet = vatCollected - vatDeductible;
  const pendingVatEntries = accountingEntries.filter((entry) => entry.status === 'to_validate' && entry.lines.some((line) => line.kind === 'vat')).length;

  // Swiss VAT rates
  const standardRate = 8.1;
  const reducedRate = 2.6;
  const hotelRate = 3.8;

  const formatCHF = (v: number) => new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF' }).format(v);

  return (
    <div className="space-y-7">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-dark-900 tracking-tight">TVA</h1>
          <p className="text-dark-400 text-sm mt-1.5 font-medium">Gestion de la TVA suisse — données issues des écritures</p>
        </div>
        <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-dark-900 text-white rounded-xl text-sm font-medium hover:bg-dark-800 transition-all shadow-soft">
          <Download size={16} />
          Rapport TVA
        </button>
      </div>

      {/* TVA Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-dark-100/50 p-5 shadow-soft card-hover">
          <p className="text-xs text-dark-500 font-medium uppercase tracking-wide">TVA collectée</p>
          <p className="text-2xl font-bold text-dark-900 mt-1">{formatCHF(vatCollected)}</p>
          <p className="text-xs text-dark-400 mt-1">Lignes TVA créditées</p>
        </div>
        <div className="bg-white rounded-2xl border border-dark-100/50 p-5 shadow-soft card-hover">
          <p className="text-xs text-dark-500 font-medium uppercase tracking-wide">TVA récupérable</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCHF(vatDeductible)}</p>
          <p className="text-xs text-dark-400 mt-1">Lignes TVA débitées</p>
        </div>
        <div className="bg-white rounded-2xl border border-dark-100/50 p-5 shadow-soft card-hover">
          <p className="text-xs text-dark-500 font-medium uppercase tracking-wide">TVA nette à payer</p>
          <p className="text-2xl font-bold text-gold-600 mt-1">{formatCHF(vatNet)}</p>
          <p className="text-xs text-dark-400 mt-1">Après revue des écritures</p>
        </div>
      </div>

      {/* VAT Rates */}
      <div className="bg-white rounded-2xl border border-dark-100/50 overflow-hidden shadow-soft">
        <div className="px-6 py-4 border-b border-dark-100">
          <h3 className="font-semibold text-dark-900">Taux de TVA suisse en vigueur</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-dark-50">
            <tr>
              <th className="text-left px-6 py-3 font-semibold text-dark-600">Type</th>
              <th className="text-right px-6 py-3 font-semibold text-dark-600">Taux</th>
              <th className="text-left px-6 py-3 font-semibold text-dark-600">Application</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-50">
            <tr>
              <td className="px-6 py-3 text-dark-900 font-medium">Taux normal</td>
              <td className="px-6 py-3 text-right font-mono font-bold">{standardRate}%</td>
              <td className="px-6 py-3 text-dark-500">Restauration, services</td>
            </tr>
            <tr>
              <td className="px-6 py-3 text-dark-900 font-medium">Taux réduit</td>
              <td className="px-6 py-3 text-right font-mono font-bold">{reducedRate}%</td>
              <td className="px-6 py-3 text-dark-500">Denrées alimentaires, boissons non alcoolisées</td>
            </tr>
            <tr>
              <td className="px-6 py-3 text-dark-900 font-medium">Taux hébergement</td>
              <td className="px-6 py-3 text-right font-mono font-bold">{hotelRate}%</td>
              <td className="px-6 py-3 text-dark-500">Hébergement</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bg-gold-50/80 border border-gold-200 rounded-xl p-4 text-sm text-gold-800">
        <p className="font-medium">⚠️ Estimation TVA · {pendingVatEntries} écriture(s) TVA à valider</p>
        <p className="mt-1">Les montants affichés sont des estimations. La déclaration TVA officielle doit être préparée par votre fiduciaire selon les règles de l'AFC.</p>
      </div>
    </div>
  );
}
