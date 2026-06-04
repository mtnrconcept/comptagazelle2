import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './layouts/Layout';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Invoices from './pages/Invoices';
import InvoiceScan from './pages/InvoiceScan';
import IncomeStatement from './pages/IncomeStatement';
import BalanceSheetPage from './pages/BalanceSheetPage';
import Exports from './pages/Exports';
import Categories from './pages/Categories';
import Suppliers from './pages/Suppliers';
import VATPage from './pages/VATPage';
import Settings from './pages/Settings';

function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}

export default App;
