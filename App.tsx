import React, { useEffect, useState } from 'react';
import { initDB, getInventory, getTransactions, resetDB, logAction } from './services/db';
import { ProductSlot, Transaction } from './types';
import { VM_CONFIG, TRANSLATIONS } from './lib/vm-config';

// Components
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import Transactions from './components/Transactions';
import RoutePlanning from './components/RoutePlanning';
import Compliance from './components/Compliance';
import Warehouse from './components/Warehouse';
import Simulator from './components/Simulator';
import Planogram from './components/Planogram';
import Login from './components/Login';
import StatusMonitoring from './components/StatusMonitoring';
import Alarms from './components/Alarms';
import Suppliers from './components/Suppliers';
import Financials from './components/Financials';
import SalesAnalytics from './components/SalesAnalytics';
import AiAssistant from './components/AiAssistant';
import SuperSettings from './components/SuperSettings';

// --- KOMPONEN BARU: SMART EXCEL IMPORT ---
import SmartExcelImport from './components/SmartExcelImport'; 

import { 
  LayoutDashboard, Package, List, RefreshCw, Trash2, ShieldCheck, 
  Map, Truck, Building2, FileText, UserCircle, CreditCard, Scan, 
  LogOut, Monitor, Bell, ShoppingBag, BarChart3, Globe, X, CheckCircle, AlertTriangle, Info, TrendingUp, Settings
} from 'lucide-react';

type Language = 'en' | 'bm';

const App: React.FC = () => {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [lang, setLang] = useState<Language>('en');

  // Data State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [inventory, setInventory] = useState<ProductSlot[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Initial Load
  useEffect(() => {
    const loadData = async () => {
      try {
        await initDB();
        await fetchData();
        
        // Check Session
        const session = sessionStorage.getItem('vm_session');
        if (session) setIsAuthenticated(true);

        // Load Backup Data dari Excel Terdahulu (jika ada)
        const cachedSales = localStorage.getItem('salesData');
        if (cachedSales) {
            const parsed = JSON.parse(cachedSales);
            // Gabung dengan data DB jika perlu, atau set terus
            setTransactions(prev => {
                // Elak duplicate mudah (check ID/Length)
                if (prev.length === 0) return parsed;
                return prev; 
            });
        }

      } catch (error) {
        console.error("Failed to init DB:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const fetchData = async () => {
    const inv = await getInventory();
    const tx = await getTransactions();
    setInventory(inv);
    // Kita guna data dari state jika ada cache Excel, kalau tak guna DB
    if (tx.length > 0) setTransactions(tx);
  };

  // --- LOGIC BARU: HANDLE SMART IMPORT ---
  const handleSmartImport = (importedRows: any[]) => {
    console.log("📥 Data Excel Diterima:", importedRows);

    // Tukar format Excel (Raw) kepada format Sistem (Transaction)
    // Supaya graf boleh baca
    const mappedTransactions: Transaction[] = importedRows.map((row, index) => ({
        id: `EXCEL-${Date.now()}-${index}`,
        refNo: `IMP-${Math.floor(Math.random() * 10000)}`,
        paymentId: `PAY-${index}`,
        productName: row.ProductName || 'Unknown Product',
        slotId: 'N/A',
        amount: row.Amount || 0,
        currency: 'MYR',
        status: 'SUCCESS',
        paymentMethod: row.PayType || 'Cash',
        timestamp: new Date(row.TradeTime).toISOString(), // Pastikan format ISO
        lhdnStatus: 'PENDING'
    }));

    // Kemaskini State (Graf akan berubah serta merta)
    setTransactions(prev => {
        const combined = [...mappedTransactions, ...prev];
        // Sort ikut masa (terkini di atas)
        return combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    });

    // Simpan ke LocalStorage supaya tak hilang bila refresh
    // (Dalam production sebenar, kita patut simpan ke DB)
    const currentCache = JSON.parse(localStorage.getItem('salesData') || '[]');
    const newCache = [...mappedTransactions, ...currentCache];
    localStorage.setItem('salesData', JSON.stringify(newCache));

    alert(`✅ Berjaya import ${mappedTransactions.length} transaksi! Graf telah dikemaskini.`);
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
    sessionStorage.setItem('vm_session', 'true');
    logAction('USER_LOGIN', 'User logged in successfully');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('vm_session');
    logAction('USER_LOGOUT', 'User logged out');
  };

  const handleReset = async () => {
    if (confirm("Are you sure you want to factory reset? All data will be lost.")) {
      await resetDB();
      localStorage.removeItem('salesData'); // Clear cache Excel juga
      await fetchData();
      alert("System reset complete.");
    }
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  const MenuItems = [
    { id: 'dashboard', label: TRANSLATIONS[lang].dashboard, icon: LayoutDashboard },
    { id: 'sales_analytics', label: 'Sales Analytics', icon: BarChart3 },
    { id: 'status', label: 'Live Monitoring', icon: Monitor },
    { id: 'alarms', label: 'Alarms & Events', icon: Bell },
    { id: 'simulator', label: TRANSLATIONS[lang].simulator, icon: ShoppingBag },
    { id: 'inventory', label: TRANSLATIONS[lang].inventory, icon: Package },
    { id: 'warehouse', label: 'Warehouse', icon: Building2 },
    { id: 'planogram', label: 'Planogram', icon: List },
    { id: 'logistics', label: 'Logistics / Route', icon: Truck },
    { id: 'history', label: TRANSLATIONS[lang].transactions, icon: FileText },
    { id: 'financials', label: 'Financials', icon: CreditCard },
    { id: 'suppliers', label: 'Supplier Mgmt', icon: UserCircle },
    { id: 'compliance', label: 'Compliance (LHDN)', icon: ShieldCheck },
    { id: 'settings', label: 'Super Settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 shadow-xl`}>
        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
              VMMS Pro
            </h1>
            <p className="text-xs text-slate-400 mt-1">Vending Mgmt System</p>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-3">
          {MenuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                  activeTab === item.id 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon size={20} className={`${activeTab === item.id ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-blue-500 flex items-center justify-center text-xs font-bold">
              HQ
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">Admin HQ</p>
              <p className="text-xs text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Online
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto h-full w-full">
        {/* Header Mobile */}
        <header className="bg-white border-b border-slate-200 p-4 sticky top-0 z-40 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
              <List size={24} />
            </button>
            <h2 className="text-xl font-bold text-slate-800">
              {MenuItems.find(m => m.id === activeTab)?.label}
            </h2>
          </div>

          <div className="flex items-center gap-2">
             <button 
               onClick={() => setLang(lang === 'en' ? 'bm' : 'en')}
               className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
             >
               <Globe size={16} />
               {lang === 'en' ? 'EN' : 'BM'}
             </button>

            {activeTab === 'settings' && (
              <button 
                onClick={handleReset}
                className="p-2 text-red-500 hover:bg-red-50 hover:text-red-600 rounded-full transition-colors"
                title="Reset Database"
              >
                <Trash2 size={18} />
              </button>
            )}
            <button 
              onClick={handleLogout}
              className="md:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-full"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <div className="p-6 max-w-7xl mx-auto">
          
          {/* --- SMART IMPORT --- */}
          {/* Kita letak di atas Dashboard supaya user sentiasa nampak bila nak upload */}
          {activeTab === 'dashboard' && (
            <>
              <div className="mb-6">
                <SmartExcelImport onDataImported={handleSmartImport} />
              </div>
              <Dashboard transactions={transactions} />
            </>
          )}

          {activeTab === 'sales_analytics' && <SalesAnalytics transactions={transactions} inventory={inventory} />}
          {activeTab === 'status' && <StatusMonitoring />}
          {activeTab === 'alarms' && <Alarms />}
          {activeTab === 'inventory' && <Inventory slots={inventory} />}
          {activeTab === 'history' && <Transactions transactions={transactions} />}
          {activeTab === 'logistics' && <RoutePlanning />}
          {activeTab === 'compliance' && <Compliance />}
          {activeTab === 'warehouse' && <Warehouse />}
          {activeTab === 'planogram' && <Planogram />}
          {activeTab === 'financials' && <Financials transactions={transactions} lang={lang} />}
          {activeTab === 'suppliers' && <Suppliers />}
          {activeTab === 'settings' && <SuperSettings />}
          {activeTab === 'simulator' && <Simulator onUpdate={fetchData} />}
        </div>
      </main>
    </div>
  );
};

export default App;