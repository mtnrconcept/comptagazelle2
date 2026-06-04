import { useStore } from '../store';
import { Search } from 'lucide-react';
import { useState } from 'react';

export default function Suppliers() {
  const { suppliers, accountingEntries } = useStore();
  const [search, setSearch] = useState('');
  const formatCHF = (v: number) => new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF' }).format(v);

  const supplierCards = suppliers.map((supplier) => {
    const entries = accountingEntries.filter((entry) => entry.supplierId === supplier.id);
    const totalAmount = entries.reduce((sum, entry) => (
      sum + entry.lines.filter((line) => line.kind === 'ttc').reduce((lineSum, line) => lineSum + line.credit, 0)
    ), 0);
    const category = entries[0]?.categoryName || supplier.category;
    const pendingEntries = entries.filter((entry) => entry.status === 'to_validate').length;

    return {
      ...supplier,
      category,
      invoiceCount: entries.length || supplier.invoiceCount,
      totalAmount: totalAmount || supplier.totalAmount,
      pendingEntries,
    };
  });

  const filtered = supplierCards.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-dark-900">Fournisseurs</h1>
        <p className="text-dark-500 text-sm mt-1">{suppliers.length} fournisseurs enregistrés · totaux calculés depuis les écritures</p>
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" />
        <input
          type="text"
          placeholder="Rechercher un fournisseur..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-dark-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gold-400/30 focus:border-gold-400 shadow-soft"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((supplier) => (
          <div key={supplier.id} className="bg-white rounded-2xl border border-dark-100/50 p-5 shadow-soft card-hover">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-dark-900">{supplier.name}</h3>
                <p className="text-xs text-dark-400 mt-1">{supplier.category}</p>
              </div>
              {supplier.pendingEntries > 0 && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">À valider</span>
              )}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-dark-500">Écritures facture</p>
                <p className="font-semibold text-dark-900">{supplier.invoiceCount}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-dark-500">Total TTC comptabilisé</p>
                <p className="font-semibold text-gold-600">{formatCHF(supplier.totalAmount)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
