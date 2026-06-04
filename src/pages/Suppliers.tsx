import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useStore } from '../store';

export default function Suppliers() {
  const { suppliers } = useStore();
  const [search, setSearch] = useState('');
  const formatCHF = (v: number) => new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF' }).format(v);

  const filtered = suppliers.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.category.toLowerCase().includes(search.toLowerCase())
  );

  const hasSuppliers = suppliers.length > 0;
  const hasFilteredSuppliers = filtered.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-dark-900">Fournisseurs</h1>
        <p className="text-dark-500 text-sm mt-1">{suppliers.length} fournisseurs enregistrés</p>
      </div>

      {hasSuppliers && (
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
      )}

      {!hasSuppliers ? (
        <div className="bg-white rounded-2xl border border-dashed border-dark-200 p-8 text-center shadow-soft">
          <h2 className="text-lg font-semibold text-dark-900">Aucun fournisseur enregistré</h2>
          <p className="text-dark-500 text-sm mt-2 max-w-md mx-auto">
            Scannez ou importez une facture pour créer automatiquement votre premier fournisseur et suivre ses totaux.
          </p>
          <Link
            to="/scan"
            className="inline-flex items-center justify-center mt-5 px-4 py-2.5 rounded-xl bg-gold-500 text-white text-sm font-semibold hover:bg-gold-600 transition-colors shadow-soft"
          >
            Scanner une facture
          </Link>
        </div>
      ) : !hasFilteredSuppliers ? (
        <div className="bg-white rounded-2xl border border-dark-100/50 p-6 text-center shadow-soft">
          <h2 className="font-semibold text-dark-900">Aucun fournisseur trouvé</h2>
          <p className="text-dark-500 text-sm mt-1">Essayez une autre recherche.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((supplier) => (
            <div key={supplier.id} className="bg-white rounded-2xl border border-dark-100/50 p-5 shadow-soft card-hover">
              <h3 className="font-semibold text-dark-900">{supplier.name}</h3>
              <p className="text-xs text-dark-400 mt-1">{supplier.category}</p>
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-dark-500">Factures</p>
                  <p className="font-semibold text-dark-900">{supplier.invoiceCount}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-dark-500">Total annuel</p>
                  <p className="font-semibold text-gold-600">{formatCHF(supplier.totalAmount)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
