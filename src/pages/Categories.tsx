import { useStore } from '../store';
import { Plus, Edit3 } from 'lucide-react';
import clsx from 'clsx';

export default function Categories() {
  const { categories } = useStore();

  const grouped = {
    revenue: categories.filter(c => c.type === 'revenue'),
    expense: categories.filter(c => c.type === 'expense'),
  };

  return (
    <div className="space-y-7">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-dark-900 tracking-tight">Catégories comptables</h1>
          <p className="text-dark-400 text-sm mt-1.5 font-medium">Plan comptable simplifié pour restaurant suisse</p>
        </div>
        <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-gold-500 to-gold-600 text-white rounded-xl text-sm font-medium btn-premium shadow-soft">
          <Plus size={16} />
          Ajouter une catégorie
        </button>
      </div>

      {/* Revenue */}
      <div className="bg-white rounded-2xl border border-dark-100/50 overflow-hidden shadow-soft">
        <div className="px-6 py-4 bg-emerald-50 border-b border-emerald-100">
          <h3 className="font-semibold text-emerald-800">Produits / Revenus</h3>
        </div>
        <div className="divide-y divide-dark-50">
          {grouped.revenue.map((cat) => (
            <div key={cat.id} className="px-6 py-3 flex items-center justify-between hover:bg-dark-50/50">
              <div className="flex items-center gap-4">
                <span className="font-mono text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded">{cat.code}</span>
                <span className="text-sm text-dark-900 font-medium">{cat.name}</span>
              </div>
              <button className="p-1.5 text-dark-400 hover:text-dark-700 rounded">
                <Edit3 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Expenses */}
      <div className="bg-white rounded-2xl border border-dark-100/50 overflow-hidden shadow-soft">
        <div className="px-6 py-4 bg-red-50 border-b border-red-100">
          <h3 className="font-semibold text-red-800">Charges / Dépenses</h3>
        </div>
        <div className="divide-y divide-dark-50">
          {grouped.expense.map((cat) => (
            <div key={cat.id} className="px-6 py-3 flex items-center justify-between hover:bg-dark-50/50">
              <div className="flex items-center gap-4">
                <span className="font-mono text-xs bg-red-100 text-red-700 px-2 py-1 rounded">{cat.code}</span>
                <span className="text-sm text-dark-900 font-medium">{cat.name}</span>
              </div>
              <button className="p-1.5 text-dark-400 hover:text-dark-700 rounded">
                <Edit3 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
