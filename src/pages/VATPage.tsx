import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { Download } from 'lucide-react';
import { Invoice, VATCode, VATValidationStatus } from '../types';

const SWISS_VAT_RATES = [8.1, 2.6, 3.8] as const;
const TAX_NEUTRAL_CODES: VATCode[] = ['exempt', 'out_of_scope'];

const VAT_CODE_LABELS: Record<VATCode, string> = {
  standard: 'Taux normal',
  reduced: 'Taux réduit',
  hotel: 'Taux hébergement',
  exempt: 'Exonéré',
  out_of_scope: 'Hors champ',
  unknown: 'À qualifier',
};

const VALIDATION_LABELS: Record<VATValidationStatus, string> = {
  draft: 'Brouillon',
  to_review: 'À valider',
  validated: 'Validé',
  excluded: 'Exclu',
};

type VATDirection = 'sale' | 'purchase';

type VATLine = {
  id: string;
  period: string;
  rate: number;
  vatCode: VATCode;
  validationStatus: VATValidationStatus;
  direction: VATDirection;
  amountHT: number;
  vatAmount: number;
  collected: number;
  deductible: number;
};

type VATSummary = {
  key: string;
  period: string;
  rate: number;
  vatCode: VATCode;
  validationStatus: VATValidationStatus;
  amountHT: number;
  collected: number;
  deductible: number;
  netPayable: number;
  lineCount: number;
};

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function inferRate(invoice: Invoice): number {
  if (typeof invoice.tvaRate === 'number') return invoice.tvaRate;
  if (!invoice.amountHT || !invoice.tva) return 0;
  const computedRate = (invoice.tva / invoice.amountHT) * 100;
  return SWISS_VAT_RATES.find(rate => Math.abs(rate - computedRate) < 0.15) ?? roundMoney(computedRate);
}

function inferVatCode(invoice: Invoice, rate: number): VATCode {
  if (invoice.vatCode) return invoice.vatCode;
  if ((invoice.vatCountry || 'CH').toUpperCase() !== 'CH') return 'out_of_scope';
  if (Math.abs(rate - 8.1) < 0.05) return 'standard';
  if (Math.abs(rate - 2.6) < 0.05) return 'reduced';
  if (Math.abs(rate - 3.8) < 0.05) return 'hotel';
  if (rate === 0 && invoice.tva === 0) return 'exempt';
  return 'unknown';
}

function inferValidationStatus(invoice: Invoice): VATValidationStatus {
  if (invoice.vatValidationStatus) return invoice.vatValidationStatus;
  return invoice.status === 'paid' ? 'validated' : 'to_review';
}

function formatRate(rate: number, vatCode: VATCode): string {
  if (vatCode === 'exempt') return '0% exonéré';
  if (vatCode === 'out_of_scope') return 'Hors champ';
  return `${rate.toFixed(rate % 1 === 0 ? 0 : 1)}%`;
}

export default function VATPage() {
  const { invoices, transactions } = useStore();
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [selectedValidation, setSelectedValidation] = useState<VATValidationStatus | 'all'>('all');

  const invoiceDirectionById = useMemo(() => {
    const map = new Map<string, VATDirection>();
    transactions.forEach((transaction) => {
      if (!transaction.invoiceId) return;
      map.set(transaction.invoiceId, transaction.type === 'credit' ? 'sale' : 'purchase');
    });
    return map;
  }, [transactions]);

  const vatLines = useMemo<VATLine[]>(() => invoices.map((invoice) => {
    const period = invoice.date ? invoice.date.slice(0, 7) : 'Sans période';
    const direction = invoiceDirectionById.get(invoice.id)
      ?? (invoice.category.toLowerCase().includes('chiffre') ? 'sale' : 'purchase');
    const rate = inferRate(invoice);
    const vatCode = inferVatCode(invoice, rate);
    const validationStatus = inferValidationStatus(invoice);
    const neutralOrExcluded = TAX_NEUTRAL_CODES.includes(vatCode) || validationStatus === 'excluded';
    const vatAmount = neutralOrExcluded ? 0 : roundMoney(invoice.tva || 0);
    const collected = direction === 'sale' ? vatAmount : 0;
    const deductible = direction === 'purchase' ? roundMoney(invoice.vatDeductibleAmount ?? vatAmount) : 0;

    return {
      id: invoice.id,
      period,
      rate,
      vatCode,
      validationStatus,
      direction,
      amountHT: invoice.amountHT || 0,
      vatAmount,
      collected,
      deductible,
    };
  }), [invoices, invoiceDirectionById]);

  const periods = useMemo(() => Array.from(new Set(vatLines.map(line => line.period))).sort().reverse(), [vatLines]);

  const filteredLines = useMemo(() => vatLines.filter(line => (
    (selectedPeriod === 'all' || line.period === selectedPeriod)
    && (selectedValidation === 'all' || line.validationStatus === selectedValidation)
  )), [vatLines, selectedPeriod, selectedValidation]);

  const summaries = useMemo<VATSummary[]>(() => {
    const byKey = new Map<string, VATSummary>();

    filteredLines.forEach((line) => {
      const key = `${line.period}|${line.rate}|${line.vatCode}|${line.validationStatus}`;
      const existing = byKey.get(key) ?? {
        key,
        period: line.period,
        rate: line.rate,
        vatCode: line.vatCode,
        validationStatus: line.validationStatus,
        amountHT: 0,
        collected: 0,
        deductible: 0,
        netPayable: 0,
        lineCount: 0,
      };

      existing.amountHT = roundMoney(existing.amountHT + line.amountHT);
      existing.collected = roundMoney(existing.collected + line.collected);
      existing.deductible = roundMoney(existing.deductible + line.deductible);
      existing.netPayable = roundMoney(existing.collected - existing.deductible);
      existing.lineCount += 1;
      byKey.set(key, existing);
    });

    return Array.from(byKey.values()).sort((a, b) => (
      b.period.localeCompare(a.period)
      || b.rate - a.rate
      || a.vatCode.localeCompare(b.vatCode)
      || a.validationStatus.localeCompare(b.validationStatus)
    ));
  }, [filteredLines]);

  const totals = useMemo(() => summaries.reduce((acc, summary) => ({
    amountHT: roundMoney(acc.amountHT + summary.amountHT),
    collected: roundMoney(acc.collected + summary.collected),
    deductible: roundMoney(acc.deductible + summary.deductible),
    netPayable: roundMoney(acc.netPayable + summary.netPayable),
  }), { amountHT: 0, collected: 0, deductible: 0, netPayable: 0 }), [summaries]);

  const formatCHF = (v: number) => new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF' }).format(v);

  return (
    <div className="space-y-7">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-dark-900 tracking-tight">TVA</h1>
          <p className="text-dark-400 text-sm mt-1.5 font-medium">Gestion de la TVA suisse — agrégation par facture, période, taux et validation</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-dark-100/50 p-5 shadow-soft card-hover">
          <p className="text-xs text-dark-500 font-medium uppercase tracking-wide">TVA collectée</p>
          <p className="text-2xl font-bold text-dark-900 mt-1">{formatCHF(totals.collected)}</p>
          <p className="text-xs text-dark-400 mt-1">Somme des lignes de ventes facturées</p>
        </div>
        <div className="bg-white rounded-2xl border border-dark-100/50 p-5 shadow-soft card-hover">
          <p className="text-xs text-dark-500 font-medium uppercase tracking-wide">TVA récupérable</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCHF(totals.deductible)}</p>
          <p className="text-xs text-dark-400 mt-1">Somme des TVA déductibles par facture</p>
        </div>
        <div className="bg-white rounded-2xl border border-dark-100/50 p-5 shadow-soft card-hover">
          <p className="text-xs text-dark-500 font-medium uppercase tracking-wide">TVA nette à payer</p>
          <p className="text-2xl font-bold text-gold-600 mt-1">{formatCHF(totals.netPayable)}</p>
          <p className="text-xs text-dark-400 mt-1">TVA collectée - récupérable</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-dark-100/50 p-5 shadow-soft">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end sm:justify-between">
          <div>
            <h3 className="font-semibold text-dark-900">Filtres du rapport TVA</h3>
            <p className="text-sm text-dark-400 mt-1">Les montants proviennent des lignes de facture et non d'un pourcentage global sur recettes/dépenses.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <label className="text-xs text-dark-500 font-medium">
              Période
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="block mt-1 px-3 py-2 border border-dark-200 rounded-lg text-sm bg-white"
              >
                <option value="all">Toutes</option>
                {periods.map(period => <option key={period} value={period}>{period}</option>)}
              </select>
            </label>
            <label className="text-xs text-dark-500 font-medium">
              Validation
              <select
                value={selectedValidation}
                onChange={(e) => setSelectedValidation(e.target.value as VATValidationStatus | 'all')}
                className="block mt-1 px-3 py-2 border border-dark-200 rounded-lg text-sm bg-white"
              >
                <option value="all">Tous</option>
                {(Object.keys(VALIDATION_LABELS) as VATValidationStatus[]).map(status => (
                  <option key={status} value={status}>{VALIDATION_LABELS[status]}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-dark-100/50 overflow-hidden shadow-soft">
        <div className="px-6 py-4 border-b border-dark-100">
          <h3 className="font-semibold text-dark-900">Rapport TVA par période, taux et validation</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-dark-50">
              <tr>
                <th className="text-left px-6 py-3 font-semibold text-dark-600">Période</th>
                <th className="text-left px-6 py-3 font-semibold text-dark-600">Taux / cas</th>
                <th className="text-left px-6 py-3 font-semibold text-dark-600">Validation</th>
                <th className="text-right px-6 py-3 font-semibold text-dark-600">Lignes</th>
                <th className="text-right px-6 py-3 font-semibold text-dark-600">Base HT</th>
                <th className="text-right px-6 py-3 font-semibold text-dark-600">Collectée</th>
                <th className="text-right px-6 py-3 font-semibold text-dark-600">Récupérable</th>
                <th className="text-right px-6 py-3 font-semibold text-dark-600">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-50">
              {summaries.map((summary) => (
                <tr key={summary.key} className="hover:bg-dark-50/50">
                  <td className="px-6 py-3 text-dark-900 font-medium">{summary.period}</td>
                  <td className="px-6 py-3 text-dark-600">
                    <span className="font-medium">{formatRate(summary.rate, summary.vatCode)}</span>
                    <span className="text-dark-400 ml-2">{VAT_CODE_LABELS[summary.vatCode]}</span>
                  </td>
                  <td className="px-6 py-3 text-dark-600">{VALIDATION_LABELS[summary.validationStatus]}</td>
                  <td className="px-6 py-3 text-right font-mono">{summary.lineCount}</td>
                  <td className="px-6 py-3 text-right font-mono">{formatCHF(summary.amountHT)}</td>
                  <td className="px-6 py-3 text-right font-mono">{formatCHF(summary.collected)}</td>
                  <td className="px-6 py-3 text-right font-mono text-emerald-600">{formatCHF(summary.deductible)}</td>
                  <td className="px-6 py-3 text-right font-mono font-semibold text-dark-900">{formatCHF(summary.netPayable)}</td>
                </tr>
              ))}
              {summaries.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-dark-400">Aucune facture disponible pour ces filtres.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-dark-100/50 overflow-hidden shadow-soft">
        <div className="px-6 py-4 border-b border-dark-100">
          <h3 className="font-semibold text-dark-900">Taux de TVA suisse et cas particuliers</h3>
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
            <tr><td className="px-6 py-3 text-dark-900 font-medium">Taux normal</td><td className="px-6 py-3 text-right font-mono font-bold">8.1%</td><td className="px-6 py-3 text-dark-500">Biens et services imposables par défaut</td></tr>
            <tr><td className="px-6 py-3 text-dark-900 font-medium">Taux réduit</td><td className="px-6 py-3 text-right font-mono font-bold">2.6%</td><td className="px-6 py-3 text-dark-500">Denrées alimentaires, livres, médicaments selon cas</td></tr>
            <tr><td className="px-6 py-3 text-dark-900 font-medium">Taux spécial hébergement</td><td className="px-6 py-3 text-right font-mono font-bold">3.8%</td><td className="px-6 py-3 text-dark-500">Prestations d'hébergement</td></tr>
            <tr><td className="px-6 py-3 text-dark-900 font-medium">Exonéré</td><td className="px-6 py-3 text-right font-mono font-bold">0%</td><td className="px-6 py-3 text-dark-500">Opérations exonérées, sans TVA collectée/récupérable dans le rapport</td></tr>
            <tr><td className="px-6 py-3 text-dark-900 font-medium">Hors champ</td><td className="px-6 py-3 text-right font-mono font-bold">—</td><td className="px-6 py-3 text-dark-500">Factures non soumises à la TVA suisse ou pays TVA non suisse</td></tr>
          </tbody>
        </table>
      </div>

      <div className="bg-gold-50/80 border border-gold-200 rounded-xl p-4 text-sm text-gold-800">
        <p className="font-medium">⚠️ Rapport TVA à valider</p>
        <p className="mt-1">Les agrégats sont préparés à partir des factures enregistrées et de leur statut de validation. La déclaration TVA officielle doit être revue par votre fiduciaire selon les règles de l'AFC.</p>
      </div>
    </div>
  );
}
