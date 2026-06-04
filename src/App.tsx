import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './layouts/Layout';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Transactions = lazy(() => import('./pages/Transactions'));
const Invoices = lazy(() => import('./pages/Invoices'));
const InvoiceScan = lazy(() => import('./pages/InvoiceScan'));
const IncomeStatement = lazy(() => import('./pages/IncomeStatement'));
const BalanceSheetPage = lazy(() => import('./pages/BalanceSheetPage'));
const Exports = lazy(() => import('./pages/Exports'));
const Categories = lazy(() => import('./pages/Categories'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const VATPage = lazy(() => import('./pages/VATPage'));
const Settings = lazy(() => import('./pages/Settings'));

const PageFallback = () => (
  <div className="flex min-h-[320px] items-center justify-center px-4">
    <div className="rounded-2xl border border-dark-100 bg-white px-6 py-5 text-center shadow-sm">
      <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
      <p className="text-sm font-medium text-dark-700">Chargement du module...</p>
    </div>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="factures" element={<Invoices />} />
            <Route path="scan" element={<InvoiceScan />} />
            <Route path="fournisseurs" element={<Suppliers />} />
            <Route path="categories" element={<Categories />} />
            <Route path="compte-resultat" element={<IncomeStatement />} />
            <Route path="bilan" element={<BalanceSheetPage />} />
            <Route path="tva" element={<VATPage />} />
            <Route path="exports" element={<Exports />} />
            <Route path="parametres" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
