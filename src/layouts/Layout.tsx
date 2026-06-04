import { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, ArrowRightLeft, FileText, ScanLine, Users, 
  FolderOpen, TrendingUp, Scale, Receipt, Download, Settings,
  Menu, X, ChevronRight, Sparkles
} from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Tableau de bord' },
  { to: '/transactions', icon: ArrowRightLeft, label: 'Transactions' },
  { to: '/factures', icon: FileText, label: 'Factures' },
  { to: '/scan', icon: ScanLine, label: 'Scan / Import' },
  { to: '/fournisseurs', icon: Users, label: 'Fournisseurs' },
  { to: '/categories', icon: FolderOpen, label: 'Catégories' },
  { to: '/compte-resultat', icon: TrendingUp, label: 'Compte de résultat' },
  { to: '/bilan', icon: Scale, label: 'Bilan' },
  { to: '/tva', icon: Receipt, label: 'TVA' },
  { to: '/exports', icon: Download, label: 'Exports' },
  { to: '/parametres', icon: Settings, label: 'Paramètres' },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen bg-offwhite bg-texture overflow-hidden">
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-xs z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={clsx(
        'fixed lg:static inset-y-0 left-0 z-50 w-[270px] bg-dark-950 text-white transform transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] flex flex-col',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        {/* Logo */}
        <div className="p-6 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 bg-gradient-to-br from-gold-400 to-gold-600 rounded-xl flex items-center justify-center shadow-glow-gold">
              <span className="text-white font-bold text-lg">G</span>
            </div>
            <div>
              <h1 className="font-semibold text-[15px] leading-tight tracking-tight">Gazelle Comptabilité</h1>
              <p className="text-[11px] text-dark-400 mt-0.5 flex items-center gap-1">
                <Sparkles size={10} className="text-gold-400" />
                La Gazelle d'Or
              </p>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-5 h-px bg-gradient-to-r from-transparent via-dark-700 to-transparent" />

        {/* Navigation */}
        <nav className="flex-1 py-5 overflow-y-auto">
          <ul className="space-y-0.5 px-3">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) => clsx(
                    'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 group relative',
                    isActive 
                      ? 'bg-gradient-to-r from-gold-500/15 to-gold-500/5 text-gold-300 nav-active-indicator' 
                      : 'text-dark-400 hover:text-white hover:bg-white/[0.04]'
                  )}
                >
                  <item.icon size={17} className="transition-transform duration-200 group-hover:scale-110" />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-5 pt-3">
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
            <p className="text-[10px] text-dark-500 leading-relaxed">
              Les données comptables doivent être vérifiées par une personne compétente avant déclaration officielle.
            </p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-[68px] bg-white/80 backdrop-blur-md border-b border-dark-100/50 flex items-center px-4 lg:px-8 shrink-0 sticky top-0 z-30">
          <button 
            className="lg:hidden p-2.5 -ml-2 rounded-xl hover:bg-dark-50 active:scale-95 transition-all"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="ml-auto flex items-center gap-5">
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <span className="text-dark-400 font-normal">Restaurant</span>
              <span className="text-dark-900 font-semibold">La Gazelle d'Or</span>
              <span className="w-1.5 h-1.5 rounded-full bg-gold-400 mx-1" />
              <span className="text-dark-500 font-medium">Genève</span>
            </div>
            <div className="w-9 h-9 bg-gradient-to-br from-gold-400 to-gold-600 rounded-full flex items-center justify-center shadow-soft ring-2 ring-gold-100">
              <span className="text-white text-xs font-semibold">AG</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-5 lg:p-8">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}
