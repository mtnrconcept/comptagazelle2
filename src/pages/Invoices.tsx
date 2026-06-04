import { useStore } from '../store';
import { Search } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';

export default function Invoices() {
  const { invoices, accountingEntries } = useStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending' | 'overdue'>('all');

  const formatCHF = (v: number) => new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF' }).format(v);
  const getEntry = (invoiceId: string) => accountingEntries.find((entry) => entry.invoiceId === invoiceId);
  const getDebitByKind = (invoiceId: string, kind: 'ht' | 'vat') =>
    getEntry(invoiceId)?.lines.filter((line) => line.kind === kind).reduce((sum, line) => sum + line.debit, 0) || 0;
  const getCreditByKind = (invoiceId: string, kind: 'ttc') =>
    getEntry(invoiceId)?.lines.filter((line) => line.kind === kind).reduce((sum, line) => sum + line.credit, 0) || 0;

  const filtered = invoices
    .filter(i => statusFilter === 'all' || i.status === statusFilter)
    .filter(i => {
      const entry = getEntry(i.id);
      return i.supplier.toLowerCase().includes(search.toLowerCase()) ||
        i.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
        (entry?.categoryName || i.category).toLowerCase().includes(search.toLowerCase()) ||
        entry?.lines.some((line) => line.accountCode.includes(search));
    });

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-3xl font-bold text-dark-900 tracking-tight">Factures</h1>
        <p className="text-dark-400 text-sm mt-1.5 font-medium">{invoices.length} factures enregistrées · montants lus depuis les écritures comptables</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" />
          <input
            type="text"
            placeholder="Rechercher par fournisseur, numéro, compte..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-dark-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/30 focus:border-gold-400 shadow-soft"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'paid', 'pending', 'overdue'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={clsx(
                'px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                statusFilter === status
                  ? 'bg-dark-900 text-white shadow-soft'
                  : 'bg-white text-dark-500 border border-dark-200 hover:bg-dark-50'
              )}
            >
              {status === 'all' ? 'Toutes' : status === 'paid' ? 'Payées' : status === 'pending' ? 'En attente' : 'En retard'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-dark-100/50 overflow-hidden shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-dark-50 border-b border-dark-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-dark-600">Fournisseur</th>
                <th className="text-left px-4 py-3 font-semibold text-dark-600">N° Facture</th>
                <th className="text-left px-4 py-3 font-semibold text-dark-600">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-dark-600">Compte</th>
                <th className="text-right px-4 py-3 font-semibold text-dark-600">HT</th>
                <th className="text-right px-4 py-3 font-semibold text-dark-600">TVA</th>
                <th className="text-right px-4 py-3 font-semibold text-dark-600">TTC</th>
                <th className="text-center px-4 py-3 font-semibold text-dark-600">Revue</th>
                <th className="text-center px-4 py-3 font-semibold text-dark-600">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-50">
              {filtered.map((inv) => {
                const entry = getEntry(inv.id);
                const ht = getDebitByKind(inv.id, 'ht') || inv.amountHT;
                const vat = getDebitByKind(inv.id, 'vat') || inv.tva;
                const ttc = getCreditByKind(inv.id, 'ttc') || inv.amountTTC;
                const expenseLine = entry?.lines.find((line) => line.kind === 'ht');

                return (
                  <tr key={inv.id} className="hover:bg-dark-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-dark-900">{inv.supplier}</td>
                    <td className="px-4 py-3 text-dark-600">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 text-dark-600 whitespace-nowrap">{inv.date}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-gold-100 text-gold-800 px-2 py-1 rounded-md">
                        {expenseLine ? `${expenseLine.accountCode} · ${expenseLine.accountName}` : inv.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-dark-600">{formatCHF(ht)}</td>
                    <td className="px-4 py-3 text-right text-dark-600">{formatCHF(vat)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-dark-900">{formatCHF(ttc)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={clsx('text-xs px-2 py-1 rounded-full font-medium', entry?.status === 'to_validate' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700')}>
                        {entry?.status === 'to_validate' ? 'À valider' : entry?.status === 'exported' ? 'Exportée' : 'Validée'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={clsx(
                        'text-xs px-2 py-1 rounded-full font-medium',
                        inv.status === 'paid' && 'bg-emerald-100 text-emerald-700',
                        inv.status === 'pending' && 'bg-orange-100 text-orange-700',
                        inv.status === 'overdue' && 'bg-red-100 text-red-700',
                      )}>
                        {inv.status === 'paid' ? 'Payée' : inv.status === 'pending' ? 'En attente' : 'En retard'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
