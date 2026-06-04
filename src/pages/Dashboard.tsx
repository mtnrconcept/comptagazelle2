import { useStore } from '../store';
import { 
  TrendingUp, TrendingDown, DollarSign, Receipt, 
  CreditCard, AlertTriangle, Info, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { motion } from 'framer-motion';
import clsx from 'clsx';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } }
};

export default function Dashboard() {
  const { transactions, invoices, alerts, monthlyData } = useStore();

  const revenue = transactions
    .filter(t => t.type === 'credit')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const expenses = transactions
    .filter(t => t.type === 'debit')
    .reduce((sum, t) => sum + t.amount, 0);

  const netResult = revenue - expenses;
  const tvaEstimated = revenue * 0.081;
  const bankBalance = 45230.50;
  const unpaidInvoices = invoices.filter(i => i.status !== 'paid');

  const stats = [
    { label: 'Chiffre d\'affaires', value: revenue, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', borderColor: 'border-emerald-100', trend: '+12%', trendUp: true },
    { label: 'Dépenses', value: expenses, icon: TrendingDown, color: 'text-rose-500', bg: 'bg-rose-50', borderColor: 'border-rose-100', trend: '+3%', trendUp: false },
    { label: 'Résultat net', value: netResult, icon: DollarSign, color: 'text-gold-600', bg: 'bg-gold-50', borderColor: 'border-gold-100', trend: '+8%', trendUp: true },
    { label: 'TVA estimée', value: tvaEstimated, icon: Receipt, color: 'text-sky-600', bg: 'bg-sky-50', borderColor: 'border-sky-100' },
    { label: 'Solde bancaire', value: bankBalance, icon: CreditCard, color: 'text-dark-700', bg: 'bg-dark-50', borderColor: 'border-dark-100' },
    { label: 'Factures à payer', value: unpaidInvoices.length, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', borderColor: 'border-amber-100', isCount: true },
  ];

  const formatCHF = (v: number) => new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF' }).format(v);

  return (
    <motion.div 
      className="space-y-7"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-dark-900 tracking-tight">Tableau de bord</h1>
          <p className="text-dark-400 text-sm mt-1.5 font-medium">Vue d'ensemble financière — Mai 2026</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-dark-400 bg-white rounded-full px-4 py-2 shadow-soft border border-dark-100/50">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          Données en temps réel
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat, idx) => (
          <motion.div 
            key={stat.label} 
            className={clsx(
              'bg-white rounded-2xl p-5 border shadow-soft card-hover cursor-default',
              stat.borderColor
            )}
            whileHover={{ y: -2 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-[11px] text-dark-400 font-semibold uppercase tracking-wider">{stat.label}</p>
                <p className={clsx('text-[26px] font-bold mt-1.5 tracking-tight', stat.color)}>
                  {stat.isCount ? stat.value : formatCHF(stat.value as number)}
                </p>
                {stat.trend && (
                  <div className={clsx(
                    'inline-flex items-center gap-0.5 mt-2 text-[11px] font-semibold px-2 py-0.5 rounded-full',
                    stat.trendUp ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'
                  )}>
                    {stat.trendUp ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                    {stat.trend} ce mois
                  </div>
                )}
              </div>
              <div className={clsx('p-2.5 rounded-xl', stat.bg)}>
                <stat.icon size={20} className={stat.color} />
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Charts */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Revenue Chart */}
        <div className="bg-white rounded-2xl p-6 border border-dark-100/50 shadow-soft">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-dark-900 text-[15px]">Évolution mensuelle</h3>
            <span className="text-[11px] text-dark-400 bg-dark-50 px-2.5 py-1 rounded-full font-medium">2026</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.12}/>
                  <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.08}/>
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
              <Tooltip 
                formatter={(v: number) => formatCHF(v)} 
                contentStyle={{ borderRadius: 12, border: '1px solid #f0f0f0', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#059669" strokeWidth={2.5} fill="url(#colorRevenue)" name="Revenus" />
              <Area type="monotone" dataKey="expenses" stroke="#f43f5e" strokeWidth={2} fill="url(#colorExpenses)" name="Dépenses" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Profit Chart */}
        <div className="bg-white rounded-2xl p-6 border border-dark-100/50 shadow-soft">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-dark-900 text-[15px]">Bénéfice mensuel</h3>
            <span className="text-[11px] text-dark-400 bg-dark-50 px-2.5 py-1 rounded-full font-medium">CHF</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData}>
              <defs>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e5ac3e"/>
                  <stop offset="100%" stopColor="#d4932a"/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
              <Tooltip 
                formatter={(v: number) => formatCHF(v)}
                contentStyle={{ borderRadius: 12, border: '1px solid #f0f0f0', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}
              />
              <Bar dataKey="profit" fill="url(#colorProfit)" radius={[6, 6, 0, 0]} name="Bénéfice" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Alerts & Recent */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Alerts */}
        <div className="bg-white rounded-2xl p-6 border border-dark-100/50 shadow-soft">
          <h3 className="font-semibold text-dark-900 text-[15px] mb-4">Alertes</h3>
          <div className="space-y-2.5">
            {alerts.map((alert) => (
              <div key={alert.id} className={clsx(
                'flex items-start gap-3 p-3.5 rounded-xl transition-all duration-200 hover:scale-[1.01]',
                alert.type === 'danger' && 'bg-rose-50/80 border border-rose-100',
                alert.type === 'warning' && 'bg-amber-50/80 border border-amber-100',
                alert.type === 'info' && 'bg-sky-50/80 border border-sky-100',
              )}>
                {alert.type === 'danger' && <AlertTriangle size={15} className="text-rose-500 mt-0.5 shrink-0" />}
                {alert.type === 'warning' && <AlertTriangle size={15} className="text-amber-500 mt-0.5 shrink-0" />}
                {alert.type === 'info' && <Info size={15} className="text-sky-500 mt-0.5 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-dark-800 font-medium">{alert.message}</p>
                  <p className="text-[11px] text-dark-400 mt-0.5">{alert.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent invoices */}
        <div className="bg-white rounded-2xl p-6 border border-dark-100/50 shadow-soft">
          <h3 className="font-semibold text-dark-900 text-[15px] mb-4">Dernières factures</h3>
          <div className="space-y-1">
            {invoices.slice(0, 5).map((inv) => (
              <div key={inv.id} className="flex items-center justify-between py-3 px-2 rounded-xl hover:bg-dark-50/50 transition-colors -mx-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-dark-900 truncate">{inv.supplier}</p>
                  <p className="text-[11px] text-dark-400 mt-0.5">{inv.invoiceNumber} • {inv.date}</p>
                </div>
                <div className="text-right ml-4 shrink-0">
                  <p className="text-[13px] font-bold text-dark-900">{formatCHF(inv.amountTTC)}</p>
                  <span className={clsx(
                    'text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide',
                    inv.status === 'paid' && 'bg-emerald-100 text-emerald-700',
                    inv.status === 'pending' && 'bg-amber-100 text-amber-700',
                    inv.status === 'overdue' && 'bg-rose-100 text-rose-700',
                  )}>
                    {inv.status === 'paid' ? 'Payée' : inv.status === 'pending' ? 'En attente' : 'En retard'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
