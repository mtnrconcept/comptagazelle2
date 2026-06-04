import { useState } from 'react';
import { useStore } from '../store';
import { Download } from 'lucide-react';
import PeriodSelector from '../components/reporting/PeriodSelector';
import DataQualityWarning from '../components/reporting/DataQualityWarning';
import { assessDataQuality, buildVATReport, filterEntriesByPeriod, formatCHF, formatPeriod, getCurrentMonthPeriod, SWISS_VAT_RATES } from '../utils/accounting';

export default function VATPage() {
  const { accountingEntries, demoMode } = useStore();
  const [period, setPeriod] = useState(getCurrentMonthPeriod);
  const periodEntries = filterEntriesByPeriod(accountingEntries, period, demoMode);
  const vatReport = buildVATReport(periodEntries, period);
  const quality = assessDataQuality(accountingEntries, periodEntries);

  return (
    <div className="space-y-7">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-dark-900 tracking-tight">TVA</h1>
          <p className="text-dark-400 text-sm mt-1.5 font-medium">Gestion de la TVA suisse — {formatPeriod(period)}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <PeriodSelector period={period} onChange={setPeriod} />
          <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-dark-900 text-white rounded-xl text-sm font-medium hover:bg-dark-800 transition-all shadow-soft">
            <Download size={16} />
            Rapport TVA
          </button>
        </div>
      </div>

      <DataQualityWarning quality={quality} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-dark-100/50 p-5 shadow-soft card-hover">
          <p className="text-xs text-dark-500 font-medium uppercase tracking-wide">TVA collectée</p>
          <p className="text-2xl font-bold text-dark-900 mt-1">{formatCHF(vatReport.collected)}</p>
          <p className="text-xs text-dark-400 mt-1">Écritures du compte TVA due</p>
        </div>
        <div className="bg-white rounded-2xl border border-dark-100/50 p-5 shadow-soft card-hover">
          <p className="text-xs text-dark-500 font-medium uppercase tracking-wide">TVA récupérable</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCHF(vatReport.deductible)}</p>
          <p className="text-xs text-dark-400 mt-1">Écritures du compte TVA récupérable</p>
        </div>
        <div className="bg-white rounded-2xl border border-dark-100/50 p-5 shadow-soft card-hover">
          <p className="text-xs text-dark-500 font-medium uppercase tracking-wide">TVA nette à payer</p>
          <p className="text-2xl font-bold text-gold-600 mt-1">{formatCHF(vatReport.netPayable)}</p>
          <p className="text-xs text-dark-400 mt-1">Période {vatReport.period}</p>
        </div>
      </div>

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
              <td className="px-6 py-3 text-right font-mono font-bold">{SWISS_VAT_RATES.standard}%</td>
              <td className="px-6 py-3 text-dark-500">Restauration, services</td>
            </tr>
            <tr>
              <td className="px-6 py-3 text-dark-900 font-medium">Taux réduit</td>
              <td className="px-6 py-3 text-right font-mono font-bold">{SWISS_VAT_RATES.reduced}%</td>
              <td className="px-6 py-3 text-dark-500">Denrées alimentaires, boissons non alcoolisées</td>
            </tr>
            <tr>
              <td className="px-6 py-3 text-dark-900 font-medium">Taux hébergement</td>
              <td className="px-6 py-3 text-right font-mono font-bold">{SWISS_VAT_RATES.hotel}%</td>
              <td className="px-6 py-3 text-dark-500">Hébergement</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bg-gold-50/80 border border-gold-200 rounded-xl p-4 text-sm text-gold-800">
        <p className="font-medium">⚠️ Calcul TVA</p>
        <p className="mt-1">Les montants affichés proviennent des écritures comptables TVA de la période, sans appliquer de coefficient forfaitaire. La déclaration officielle doit être préparée selon les règles de l'AFC.</p>
      </div>
    </div>
  );
}
