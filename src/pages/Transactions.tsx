import { useState, useCallback } from 'react';
import { useStore } from '../store';
import { Upload, FileText, ArrowUpDown, Search, Filter } from 'lucide-react';
import { Transaction } from '../types';
import clsx from 'clsx';

export default function Transactions() {
  const { transactions, addTransactions } = useStore();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'credit' | 'debit'>('all');

  const formatCHF = (v: number) => new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF' }).format(v);

  const handleCSVImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) return;

      const newTransactions: Transaction[] = lines.slice(1).map((line, idx) => {
        const cols = line.split(';').map(c => c.trim().replace(/"/g, ''));
        const amount = parseFloat(cols[2]?.replace(',', '.') || '0');
        return {
          id: `csv-${Date.now()}-${idx}`,
          date: cols[0] || new Date().toISOString().split('T')[0],
          description: cols[1] || 'Transaction importée',
          amount: Math.abs(amount),
          type: amount >= 0 ? 'credit' : 'debit',
          category: categorizeTransaction(cols[1] || ''),
          reference: cols[3] || '',
          reconciled: false,
        };
      });

      addTransactions(newTransactions);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [addTransactions]);

  const filtered = transactions
    .filter(t => filterType === 'all' || t.type === filterType)
    .filter(t => 
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase()) ||
      t.reference?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-7">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-dark-900 tracking-tight">Transactions bancaires</h1>
          <p className="text-dark-400 text-sm mt-1.5 font-medium">{transactions.length} transactions enregistrées</p>
        </div>
        <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-gold-500 to-gold-600 text-white rounded-xl text-sm font-medium cursor-pointer btn-premium shadow-soft">
          <Upload size={16} />
          Importer CSV
          <input type="file" accept=".csv" onChange={handleCSVImport} className="hidden" />
        </label>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" />
          <input
            type="text"
            placeholder="Rechercher une transaction..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-dark-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/30 focus:border-gold-400 shadow-soft transition-shadow"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'credit', 'debit'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={clsx(
                'px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                filterType === type
                  ? 'bg-dark-900 text-white shadow-soft'
                  : 'bg-white text-dark-500 border border-dark-200 hover:bg-dark-50 hover:border-dark-300'
              )}
            >
              {type === 'all' ? 'Toutes' : type === 'credit' ? 'Entrées' : 'Sorties'}
            </button>
          ))}
        </div>
      </div>

      {/* CSV Format Help */}
      <div className="bg-sky-50/80 border border-sky-200 rounded-xl p-4">
        <p className="text-sm text-sky-800">
          <strong>Format CSV attendu :</strong> Date;Description;Montant;Référence (séparateur : point-virgule, montant négatif = débit)
        </p>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-dark-100/50 overflow-hidden shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-dark-50 border-b border-dark-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-dark-600">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-dark-600">Description</th>
                <th className="text-left px-4 py-3 font-semibold text-dark-600">Catégorie</th>
                <th className="text-right px-4 py-3 font-semibold text-dark-600">Montant</th>
                <th className="text-center px-4 py-3 font-semibold text-dark-600">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-50">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-dark-50/50 transition-colors">
                  <td className="px-4 py-3 text-dark-600 whitespace-nowrap">{t.date}</td>
                  <td className="px-4 py-3 text-dark-900 font-medium">{t.description}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-dark-100 text-dark-600 px-2 py-1 rounded-md">{t.category}</span>
                  </td>
                  <td className={clsx(
                    'px-4 py-3 text-right font-semibold whitespace-nowrap',
                    t.type === 'credit' ? 'text-emerald-600' : 'text-red-500'
                  )}>
                    {t.type === 'credit' ? '+' : '-'}{formatCHF(t.amount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={clsx(
                      'text-xs px-2 py-1 rounded-full font-medium',
                      t.reconciled ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
                    )}>
                      {t.reconciled ? 'Rapproché' : 'Non rapproché'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function categorizeTransaction(description: string): string {
  const desc = description.toLowerCase();
  if (desc.includes('viande') || desc.includes('boucherie') || desc.includes('légume') || desc.includes('marché')) return 'Achats marchandises';
  if (desc.includes('vin') || desc.includes('cave') || desc.includes('boisson')) return 'Achats marchandises';
  if (desc.includes('loyer') || desc.includes('bail')) return 'Loyer';
  if (desc.includes('salaire') || desc.includes('avs') || desc.includes('lpp')) return 'Charges personnel';
  if (desc.includes('électricité') || desc.includes('sig') || desc.includes('gaz')) return 'Charges exploitation';
  if (desc.includes('assurance')) return 'Assurances';
  if (desc.includes('vente') || desc.includes('encaissement')) return 'Chiffre d\'affaires';
  return 'Autres charges';
}
