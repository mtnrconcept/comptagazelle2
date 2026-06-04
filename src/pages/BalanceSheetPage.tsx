import { useStore } from '../store';
import { Download } from 'lucide-react';

export default function BalanceSheetPage() {
  const { transactions, invoices } = useStore();

  const revenue = transactions.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
  const expenses = transactions.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0);
  const netResult = revenue - expenses;
  const unpaidInvoices = invoices.filter(i => i.status !== 'paid');
  const supplierDebts = unpaidInvoices.reduce((s, i) => s + i.amountTTC, 0);

  const formatCHF = (v: number) => new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF' }).format(v);

  const assets = {
    bank: 45230.50,
    cash: 2800.00,
    receivables: 3200.00,
    stock: 8500.00,
    fixedAssets: 125000.00,
  };

  const liabilities = {
    supplierDebts,
    taxDebts: 4200.00,
    vatPayable: revenue * 0.081,
    loans: 80000.00,
    equity: 50000.00,
    netResult,
  };

  const totalAssets = Object.values(assets).reduce((s, v) => s + v, 0);
  const totalLiabilities = Object.values(liabilities).reduce((s, v) => s + v, 0);

  return (
    <div className="space-y-7">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-dark-900 tracking-tight">Bilan</h1>
          <p className="text-dark-400 text-sm mt-1.5 font-medium">Au 28 mai 2026 (estimé)</p>
        </div>
        <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-dark-900 text-white rounded-xl text-sm font-medium hover:bg-dark-800 transition-all shadow-soft hover:shadow-card">
          <Download size={16} />
          Exporter PDF
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Actifs */}
        <div className="bg-white rounded-2xl border border-dark-100/50 overflow-hidden shadow-soft">
          <div className="px-6 py-4 bg-emerald-50/80 border-b border-emerald-200">
            <h3 className="font-bold text-emerald-800 text-lg">ACTIFS</h3>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-dark-50">
              <tr><td className="px-6 py-3 text-dark-700">Banque</td><td className="px-6 py-3 text-right font-mono font-medium">{formatCHF(assets.bank)}</td></tr>
              <tr><td className="px-6 py-3 text-dark-700">Caisse</td><td className="px-6 py-3 text-right font-mono font-medium">{formatCHF(assets.cash)}</td></tr>
              <tr><td className="px-6 py-3 text-dark-700">Créances clients</td><td className="px-6 py-3 text-right font-mono font-medium">{formatCHF(assets.receivables)}</td></tr>
              <tr><td className="px-6 py-3 text-dark-700">Stock estimé</td><td className="px-6 py-3 text-right font-mono font-medium">{formatCHF(assets.stock)}</td></tr>
              <tr><td className="px-6 py-3 text-dark-700">Immobilisations</td><td className="px-6 py-3 text-right font-mono font-medium">{formatCHF(assets.fixedAssets)}</td></tr>
              <tr className="bg-emerald-50">
                <td className="px-6 py-4 font-bold text-emerald-800">TOTAL ACTIFS</td>
                <td className="px-6 py-4 text-right font-mono font-bold text-emerald-800">{formatCHF(totalAssets)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Passifs */}
        <div className="bg-white rounded-2xl border border-dark-100/50 overflow-hidden shadow-soft">
          <div className="px-6 py-4 bg-sky-50/80 border-b border-sky-200">
            <h3 className="font-bold text-sky-800 text-lg">PASSIFS</h3>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-dark-50">
              <tr><td className="px-6 py-3 text-dark-700">Dettes fournisseurs</td><td className="px-6 py-3 text-right font-mono font-medium">{formatCHF(liabilities.supplierDebts)}</td></tr>
              <tr><td className="px-6 py-3 text-dark-700">Dettes fiscales</td><td className="px-6 py-3 text-right font-mono font-medium">{formatCHF(liabilities.taxDebts)}</td></tr>
              <tr><td className="px-6 py-3 text-dark-700">TVA à payer</td><td className="px-6 py-3 text-right font-mono font-medium">{formatCHF(liabilities.vatPayable)}</td></tr>
              <tr><td className="px-6 py-3 text-dark-700">Emprunts</td><td className="px-6 py-3 text-right font-mono font-medium">{formatCHF(liabilities.loans)}</td></tr>
              <tr><td className="px-6 py-3 text-dark-700">Capitaux propres</td><td className="px-6 py-3 text-right font-mono font-medium">{formatCHF(liabilities.equity)}</td></tr>
              <tr><td className="px-6 py-3 text-dark-700 font-medium">Résultat de l'exercice</td><td className="px-6 py-3 text-right font-mono font-bold text-gold-600">{formatCHF(liabilities.netResult)}</td></tr>
              <tr className="bg-sky-50/80">
                <td className="px-6 py-4 font-bold text-sky-800">TOTAL PASSIFS</td>
                <td className="px-6 py-4 text-right font-mono font-bold text-sky-800">{formatCHF(totalLiabilities)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-gold-50/80 border border-gold-200 rounded-xl p-4 text-sm text-gold-800">
        <p className="font-medium">⚠️ Bilan simplifié</p>
        <p className="mt-1">Ce bilan est une estimation basée sur les données disponibles. Les données comptables doivent être vérifiées par une personne compétente avant déclaration officielle.</p>
      </div>
    </div>
  );
}
