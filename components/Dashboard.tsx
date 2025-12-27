import React, { useMemo, useState, useEffect, useRef } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { 
  Wifi, WifiOff, AlertTriangle, PackageX, 
  Zap, Clock, TrendingUp, Activity, Server, CloudLightning, ShieldAlert 
} from 'lucide-react';
import { Transaction, ProductSlot } from '../types';
import { getInventory, updateProductPrice } from '../services/db';
import { predictStockout, checkSurgePricing } from '../services/analytics';
import { forecastRevenue } from '../services/ai';

interface DashboardProps {
  transactions: Transaction[];
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444']; // Green, Blue, Orange, Red

// Helper to filter transactions by date range
const filterTx = (txs: Transaction[], startDate: Date, endDate: Date) => {
  return txs.filter(t => {
    const d = new Date(t.timestamp);
    return d >= startDate && d <= endDate;
  });
};

const calculateSplit = (txs: Transaction[]) => {
  const total = txs.reduce((sum, t) => sum + t.amount, 0);
  const cash = txs.filter(t => t.paymentMethod === 'Cash').reduce((sum, t) => sum + t.amount, 0); 
  const nonCash = total - cash;
  return { total, cash, nonCash };
};

const Dashboard: React.FC<DashboardProps> = ({ transactions }) => {
  // --- REAL-TIME TCN SALES INTEGRATION ---
  // Kita tambah state ini untuk simpan data sales sebenar dari Cloud
  const [tcnTodaySales, setTcnTodaySales] = useState<number | null>(null);
  const safeTx = Array.isArray(transactions) ? transactions : [];

  useEffect(() => {
    // Fungsi untuk baca data yang StatusMonitoring.tsx simpan tadi
    const loadRealtimeSales = () => {
      try {
        const storedData = localStorage.getItem('vmms_sales_today');
        if (storedData) {
          const parsed = JSON.parse(storedData);
          
          // Check tarikh: Pastikan data tu data HARI INI
          const storedDate = new Date(parsed.lastUpdated).toDateString();
          const todayDate = new Date().toDateString();
          
          if (storedDate === todayDate && typeof parsed.total === 'number') {
            setTcnTodaySales(parsed.total);
          }
        }
      } catch (err) {
        console.error("Error loading TCN Sales:", err);
      }
    };

    // Jalankan masa mula-mula buka dashboard
    loadRealtimeSales();

    // Dengar kalau ada perubahan (contoh: lepas tekan Sync)
    window.addEventListener('storage', loadRealtimeSales);
    return () => window.removeEventListener('storage', loadRealtimeSales);
  }, []);

  // Listen for last-import range published by SmartExcelImport
  useEffect(() => {
    const handler = (e: any) => {
      try {
        const detail = e?.detail || null;
        let payload = detail;
        if (!payload) {
          const stored = localStorage.getItem('vmms_last_import_range');
          if (stored) payload = JSON.parse(stored);
        }
        if (!payload || !payload.start || !payload.end) return;
        if (payload.thatDay || payload.start === payload.end) {
          setThatDayOnly(true);
          setSingleDayStr(payload.start);
        } else {
          setThatDayOnly(false);
          setStartDateStr(payload.start);
          setEndDateStr(payload.end);
        }
        setGranularity('day');
      } catch (err) {
        // ignore
      }
    };

    window.addEventListener('vmms:last-import', handler as EventListener);
    // apply stored on mount (in case event missed)
    try {
      const stored = localStorage.getItem('vmms_last_import_range');
      if (stored) {
        const payload = JSON.parse(stored);
        if (payload && payload.start && payload.end) {
          if (payload.start === payload.end) {
            setThatDayOnly(true);
            setSingleDayStr(payload.start);
          } else {
            setThatDayOnly(false);
            setStartDateStr(payload.start);
            setEndDateStr(payload.end);
          }
          setGranularity('day');
        }
      }
    } catch (e) {}

    return () => window.removeEventListener('vmms:last-import', handler as EventListener);
  }, []);

  // Close preset dropdown when clicking outside or pressing Escape
  useEffect(() => {
    const onDocClick = (ev: MouseEvent) => {
      if (!presetRef.current) return;
      if (!presetRef.current.contains(ev.target as Node)) {
        setPresetOpen(false);
      }
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setPresetOpen(false);
    };
    if (presetOpen) {
      document.addEventListener('mousedown', onDocClick);
      document.addEventListener('keydown', onKey);
    }
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [presetOpen]);

  // --- LOGIC ASAL (KEKALKAN) ---
  const today = new Date();
  
  // Today's Date Range
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

  // Yesterday's Date Range
  const startYest = new Date(startToday);
  startYest.setDate(startYest.getDate() - 1);
  const endYest = new Date(endToday);
  endYest.setDate(endYest.getDate() - 1);

  // Week & Month Ranges
  const startWeek = new Date(today);
  startWeek.setDate(today.getDate() - 7);
  
  const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // Memoized Calculations
  const todaySales = useMemo(() => {
    const todayTx = filterTx(transactions, startToday, endToday);
    return calculateSplit(todayTx);
  }, [transactions]);

  const yesterdaySales = useMemo(() => {
    const yestTx = filterTx(transactions, startYest, endYest);
    return calculateSplit(yestTx);
  }, [transactions]);

  const weekSales = useMemo(() => {
    const weekTx = filterTx(transactions, startWeek, endToday);
    return calculateSplit(weekTx);
  }, [transactions]);

  const monthSales = useMemo(() => {
    const monthTx = filterTx(transactions, startMonth, endToday);
    return calculateSplit(monthTx);
  }, [transactions]);


  // Inventory Logic
  const [inventory, setInventory] = useState<ProductSlot[]>([]);
  const [surgeAlerts, setSurgeAlerts] = useState<any[]>([]);

  useEffect(() => {
    const data = getInventory();
    setInventory(data);
    const alerts = checkSurgePricing(safeTx);
    setSurgeAlerts(alerts);
  }, [transactions]);

  const handleApplySurge = (slotId: string, increase: number) => {
    updateProductPrice(slotId, increase);
    const updated = getInventory();
    setInventory(updated);
    setSurgeAlerts(prev => prev.filter(a => a.slotId !== slotId));
  };

  // Payment Type Distribution (computed from transactions)
  const paymentTypeData = useMemo(() => {
    const counts: Record<string, number> = { Card: 0, Cash: 0, 'E-Wallet': 0, Other: 0 };
    safeTx.forEach(t => {
      const m = (t.paymentMethod || 'Other').toString().toLowerCase();
      if (m.includes('card')) counts.Card += 1;
      else if (m.includes('cash')) counts.Cash += 1;
      else if (m.includes('wallet') || m.includes('e-') || m.includes('e_wallet')) counts['E-Wallet'] += 1;
      else counts.Other += 1;
    });
    return [
      { name: 'Card', value: counts.Card },
      { name: 'Cash', value: counts.Cash },
      { name: 'E-Wallet', value: counts['E-Wallet'] },
      { name: 'Other', value: counts.Other }
    ];
  }, [safeTx]);

  // Performance chart: flexible grouping (day/week/month/year) with date range
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [perfCollapsed, setPerfCollapsed] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);
  const presetRef = useRef<HTMLDivElement | null>(null);
  const formatISODate = (d: Date) => d.toISOString().slice(0, 10);
  const todayISO = formatISODate(new Date());
  // default range: last 30 days
  const defaultEnd = new Date();
  const defaultStart = new Date();
  defaultStart.setDate(defaultEnd.getDate() - 29);
  const [startDateStr, setStartDateStr] = useState<string>(formatISODate(defaultStart));
  const [endDateStr, setEndDateStr] = useState<string>(formatISODate(defaultEnd));
  const [thatDayOnly, setThatDayOnly] = useState(false);
  const [singleDayStr, setSingleDayStr] = useState<string>(todayISO);

  const parseDate = (s: string) => {
    const d = new Date(s + 'T00:00:00');
    if (isNaN(d.getTime())) return new Date();
    return d;
  };

  const groupTransactions = (txs: Transaction[], g: string, start: Date, end: Date) => {
    const res: { name: string; uv: number }[] = [];
    // clamp time on start/end
    const s = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0);
    const e = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59);

    if (g === 'day') {
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
        const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
        const sum = txs.filter(t => {
          const dt = new Date(t.timestamp);
          return dt >= dayStart && dt <= dayEnd && t.status === 'SUCCESS';
        }).reduce((s2, t) => s2 + (typeof t.amount === 'number' ? t.amount : parseFloat(t.amount || '0') || 0), 0);
        res.push({ name: dayStart.toISOString().slice(0,10), uv: Math.round(sum * 100) / 100 });
      }
      return res;
    }

    if (g === 'week') {
      // group by ISO week label YYYY-WW
      const groups: Record<string, number> = {};
      txs.forEach(t => {
        const dt = new Date(t.timestamp);
        if (dt < s || dt > e) return;
        if (t.status !== 'SUCCESS') return;
        // get ISO week
        const tmp = new Date(dt.getTime());
        tmp.setHours(0,0,0,0);
        const day = (tmp.getDay() + 6) % 7; // Mon=0
        tmp.setDate(tmp.getDate() - day + 3);
        const week1 = new Date(tmp.getFullYear(),0,4);
        const weekNo = 1 + Math.round(((tmp.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay()+6)%7)) / 7);
        const label = `${tmp.getFullYear()}-W${String(weekNo).padStart(2,'0')}`;
        groups[label] = (groups[label] || 0) + (typeof t.amount === 'number' ? t.amount : parseFloat(t.amount || '0') || 0);
      });
      Object.keys(groups).sort().forEach(k => res.push({ name: k, uv: Math.round(groups[k] * 100) / 100 }));
      return res;
    }

    if (g === 'month') {
      const groups: Record<string, number> = {};
      txs.forEach(t => {
        const dt = new Date(t.timestamp);
        if (dt < s || dt > e) return;
        if (t.status !== 'SUCCESS') return;
        const key = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
        groups[key] = (groups[key] || 0) + (typeof t.amount === 'number' ? t.amount : parseFloat(t.amount || '0') || 0);
      });
      Object.keys(groups).sort().forEach(k => res.push({ name: k, uv: Math.round(groups[k] * 100) / 100 }));
      return res;
    }

    if (g === 'year') {
      const groups: Record<string, number> = {};
      txs.forEach(t => {
        const dt = new Date(t.timestamp);
        if (dt < s || dt > e) return;
        if (t.status !== 'SUCCESS') return;
        const key = `${dt.getFullYear()}`;
        groups[key] = (groups[key] || 0) + (typeof t.amount === 'number' ? t.amount : parseFloat(t.amount || '0') || 0);
      });
      Object.keys(groups).sort().forEach(k => res.push({ name: k, uv: Math.round(groups[k] * 100) / 100 }));
      return res;
    }

    return res;
  };

  const performanceData = useMemo(() => {
    try {
      let start = parseDate(startDateStr);
      let end = parseDate(endDateStr);
      if (thatDayOnly) {
        const day = parseDate(singleDayStr);
        start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
        end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59);
      }
      return groupTransactions(safeTx, granularity, start, end);
    } catch (e) {
      return [];
    }
  }, [safeTx, granularity, startDateStr, endDateStr, thatDayOnly, singleDayStr]);

  // Helpful scalars for chart rendering
  const perfMax = useMemo(() => {
    if (!performanceData || performanceData.length === 0) return 0;
    return Math.max(...performanceData.map(d => Number(d.uv || 0)));
  }, [performanceData]);

  const perfLast = useMemo(() => {
    if (!performanceData || performanceData.length === 0) return 0;
    return performanceData[performanceData.length - 1].uv || 0;
  }, [performanceData]);

  // Forecast using AI helper
  const revenueForecast = useMemo(() => {
    try {
      return forecastRevenue(safeTx) || null;
    } catch (e) {
      return null;
    }
  }, [safeTx]);

  // Determine display total: prefer cloud sync if available
  const displayTodayTotal = tcnTodaySales !== null ? tcnTodaySales : todaySales.total;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1: Today's Sales (UPDATED WITH TCN DATA) */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden group">
            <div className="absolute right-0 top-0 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform">
              <TrendingUp size={100} />
            </div>
            
            <div className="relative z-10">
              <div className="flex justify-between items-start">
                 <p className="text-blue-100 text-sm font-medium mb-1">TODAY'S SALES REVENUE</p>
                 {/* Badge Khas Kalau Data Datang Dari Cloud */}
                 {tcnTodaySales !== null && (
                   <span className="bg-white/20 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border border-white/30">
                     <CloudLightning size={10} /> CLOUD SYNC
                   </span>
                 )}
              </div>
              
              <h3 className="text-3xl font-bold mb-2">RM {displayTodayTotal.toFixed(2)}</h3>
              
              <div className="flex gap-3 text-xs opacity-80 font-mono">
                {tcnTodaySales !== null ? (
                   <span>Source: os.ourvend.com</span>
                ) : (
                   <>
                    <span>Cash: {todaySales.cash.toFixed(2)}</span>
                    <span>Non-cash: {todaySales.nonCash.toFixed(2)}</span>
                   </>
                )}
              </div>
            </div>
        </div>

        {/* Metric 2: Yesterday's Sales (derived from transactions) */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-slate-500 text-xs font-bold uppercase mb-1">Yesterday's Sales Revenue</p>
              <h3 className="text-2xl font-bold text-slate-800 mb-2">RM {yesterdaySales.total.toFixed(2)}</h3>
               <div className="flex gap-3 text-xs text-slate-400 font-mono">
                <span>Cash: {yesterdaySales.cash.toFixed(2)}</span>
                <span>Non-cash: {yesterdaySales.nonCash.toFixed(2)}</span>
              </div>
            </div>
        </div>

        {/* Metric 3: This Week */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
             <div className="absolute right-0 top-0 opacity-10 transform translate-x-2 -translate-y-2">
              <Zap size={80} />
            </div>
            <div className="relative z-10">
              <p className="text-orange-100 text-xs font-bold uppercase mb-1">Sales Revenue of This Week</p>
              <h3 className="text-2xl font-bold mb-2">RM {weekSales.total.toFixed(2)}</h3>
               <div className="flex gap-3 text-xs opacity-80 font-mono">
                <span>Cash: {weekSales.cash.toFixed(2)}</span>
                <span>Non-cash: {weekSales.nonCash.toFixed(2)}</span>
              </div>
            </div>
        </div>

        {/* Metric 4: This Month */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
            <div className="absolute right-0 top-0 opacity-10 transform translate-x-2 -translate-y-2">
              <PackageX size={80} />
            </div>
            <div className="relative z-10">
              <p className="text-emerald-100 text-xs font-bold uppercase mb-1">Sales Revenue of This Month</p>
              <h3 className="text-2xl font-bold mb-2">RM {monthSales.total.toFixed(2)}</h3>
              <div className="flex gap-3 text-xs opacity-80 font-mono">
                <span>Cash: {monthSales.cash.toFixed(2)}</span>
                <span>Non-cash: {monthSales.nonCash.toFixed(2)}</span>
              </div>
            </div>
        </div>
      </div>

      {/* Row 2: Status & Machine Health */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Simple Status Card - Redirects to Monitoring */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                  <div className="flex items-center gap-2 mb-1">
                      <Wifi className="text-blue-500" size={20} />
                      <h4 className="font-bold text-slate-700">Machine Online</h4>
                  </div>
                  <p className="text-slate-500 text-sm">Online: <span className="text-blue-600 font-bold text-lg">1 PCS</span></p>
                  <p className="text-blue-400 text-xs">Signal Strong</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center">
                  <Activity className="text-blue-500" />
              </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                  <div className="flex items-center gap-2 mb-1">
                      <WifiOff className="text-slate-400" size={20} />
                      <h4 className="font-bold text-slate-700">Machine Offline</h4>
                  </div>
                   <p className="text-slate-500 text-sm">Offline: <span className="text-slate-800 font-bold text-lg">0 PCS</span></p>
                   <p className="text-slate-400 text-xs">Last seen: -</p>
              </div>
               <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
                  <Server className="text-slate-400" />
              </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                  <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="text-emerald-500" size={20} />
                      <h4 className="font-bold text-slate-700">Machine Abnormal</h4>
                  </div>
                   <p className="text-slate-500 text-sm">Errors: <span className="text-emerald-600 font-bold text-lg">0 PCS</span></p>
                   <p className="text-emerald-500 text-xs">System Healthy</p>
              </div>
               <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center">
                  <ShieldAlert className="text-emerald-500" />
              </div>
          </div>
      </div>

      {/* Row 3: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         
         {/* Chart 1: Payment Type Analysis */}
         <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-6 border-l-4 border-blue-500 pl-3">Transaction Quantity Analysis by Payment Type</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {paymentTypeData.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
         </div>

         {/* Chart 2: Performance (flexible) */}
         <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4 border-l-4 border-orange-500 pl-3">Performance</h3>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
               <div className="flex items-center gap-2">
                 <label className="text-sm text-slate-600">View</label>
                 <select value={granularity} onChange={e => setGranularity(e.target.value as any)} className="border rounded px-2 py-1 text-sm">
                   <option value="day">Day</option>
                   <option value="week">Week</option>
                   <option value="month">Month</option>
                   <option value="year">Year</option>
                 </select>
               </div>

               <div className="relative" ref={presetRef}>
                 <button aria-label="Presets" onClick={() => setPresetOpen(p => !p)} className="text-sm bg-slate-100 p-2 rounded flex items-center justify-center w-8 h-8">
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                     <path d="M3 6h18" stroke="#374151" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                     <path d="M3 12h18" stroke="#374151" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                     <path d="M3 18h18" stroke="#374151" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                   </svg>
                 </button>
                 {presetOpen && (
                   <div className="absolute right-0 mt-2 w-44 bg-white border border-slate-200 rounded shadow-md z-30">
                     <button onClick={() => { const end = new Date(); const start = new Date(); start.setDate(end.getDate()-6); setStartDateStr(formatISODate(start)); setEndDateStr(formatISODate(end)); setThatDayOnly(false); setGranularity('day'); setPresetOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">Last 7d</button>
                     <button onClick={() => { const end = new Date(); const start = new Date(); start.setDate(end.getDate()-29); setStartDateStr(formatISODate(start)); setEndDateStr(formatISODate(end)); setThatDayOnly(false); setGranularity('day'); setPresetOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">Last 30d</button>
                     <button onClick={() => { const end = new Date(); const start = new Date(end.getFullYear(), end.getMonth(), 1); setStartDateStr(formatISODate(start)); setEndDateStr(formatISODate(end)); setThatDayOnly(false); setGranularity('month'); setPresetOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">This Month</button>
                     <div className="border-t border-slate-100" />
                     <button onClick={() => { setThatDayOnly(prev => !prev); setPresetOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">That day only: {thatDayOnly ? 'On' : 'Off'}</button>
                     <button onClick={() => { setPerfCollapsed(prev => !prev); setPresetOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">Compact: {perfCollapsed ? 'On' : 'Off'}</button>
                   </div>
                 )}
               </div>
            </div>
            {/* Collapsed compact summary */}
            {perfCollapsed ? (
              <div className="flex items-center justify-between px-4 py-6">
                <div>
                  <div className="text-xs text-slate-500">Latest</div>
                  <div className="text-2xl font-bold">RM {Number(perfLast || 0).toFixed(2)}</div>
                  <div className="text-xs text-slate-400">From {startDateStr} to {endDateStr}</div>
                </div>
                <div className="w-[40%] h-12">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={performanceData.slice(-14)} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="miniColor" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" axisLine={false} tick={false} tickLine={false} />
                      <YAxis domain={[0, Math.max(1, perfMax * 1.2)]} hide />
                      <Area type="monotone" dataKey="uv" stroke="#f97316" strokeWidth={2} fillOpacity={1} fill="url(#miniColor)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="h-64 w-full">
               <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={performanceData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12}} interval={performanceData.length > 8 ? Math.ceil(performanceData.length / 8) - 1 : 0} tickFormatter={(v) => {
                    try {
                      if (!v) return '';
                      if (granularity === 'day') return new Date(v).toLocaleDateString();
                      return String(v);
                    } catch (e) { return String(v); }
                  }} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} domain={[0, Math.max(1, perfMax * 1.2)]} />
                  <Tooltip formatter={(value: any) => [`RM ${Number(value).toFixed(2)}`, 'Revenue']} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                  <Area type="monotone" dataKey="uv" stroke="#f97316" strokeWidth={2} fillOpacity={1} fill="url(#colorUv)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            )}
         </div>

      </div>

      {/* Row 4: AI & Advanced Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* Stockout Forecast */}
         <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
               <Activity className="text-purple-600" />
               <h3 className="font-bold text-slate-800">AI & Advanced Analytics</h3>
            </div>
            
            <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                      <Clock size={16} className="text-blue-500" />
                      <span className="font-bold">Stockout Forecast (Linear Regression)</span>
                    </div>
                    {/* Forecast Item: use predictStockout on highest risk slot */}
                    {(() => {
                      const inv = getInventory();
                      const risks = inv.map(s => ({ slot: s, pred: predictStockout(s, safeTx) }));
                      const sorted = risks.sort((a,b) => (a.pred.hoursRemaining || 0) - (b.pred.hoursRemaining || 0));
                      const top = sorted[0];
                      if (top && top.pred && top.pred.hoursRemaining < 999) {
                        return (
                          <div className="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm">
                            <div>
                              <p className="font-bold text-sm text-slate-800">{top.slot.name}</p>
                              <p className="text-xs text-slate-400">Current Stock: {top.slot.currentStock}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-emerald-600 font-bold text-sm">{top.pred.hoursRemaining < 24 ? Math.ceil(top.pred.hoursRemaining) + ' hrs' : Math.ceil(top.pred.hoursRemaining/24) + ' days'}</p>
                              <p className="text-[10px] text-slate-400">Time to empty</p>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div className="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm">
                          <div>
                            <p className="font-bold text-sm text-slate-800">No immediate stockout risks detected</p>
                            <p className="text-xs text-slate-400">All critical items are within safe thresholds.</p>
                          </div>
                          <div className="text-right">
                            <p className="text-emerald-600 font-bold text-sm">—</p>
                            <p className="text-[10px] text-slate-400">Time to empty</p>
                          </div>
                        </div>
                      );
                    })()}
                </div>
            </div>
         </div>

         {/* Surge Pricing Engine */}
         <div className="bg-indigo-900 text-white p-6 rounded-2xl shadow-xl relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
                <Zap size={100} />
             </div>
             <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                   <Zap className="text-yellow-400" fill="currentColor" />
                   <h3 className="font-bold">Surge Pricing Engine</h3>
                </div>
                
                {surgeAlerts.length === 0 ? (
                  <div className="h-32 flex flex-col items-center justify-center text-indigo-300 bg-indigo-800/50 rounded-xl border border-indigo-700/50">
                     <span className="text-sm">Market stable.</span>
                     <span className="text-xs opacity-70">No high-demand surges detected.</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {surgeAlerts.map((alert, i) => {
                      const slotName = inventory.find(s => s.id === alert.slotId)?.name || alert.slotId;
                      return (
                        <div key={i} className="bg-white/10 p-3 rounded-lg backdrop-blur-sm">
                            <div className="flex justify-between items-start mb-2">
                              <span className="font-bold text-sm">{slotName}</span>
                              <span className="bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded uppercase">High Demand</span>
                            </div>
                            <p className="text-[10px] text-slate-300 mb-3">{alert.reason}</p>
                            <button 
                              onClick={() => handleApplySurge(alert.slotId, alert.suggestedIncrease)}
                              className="w-full bg-indigo-600 hover:bg-indigo-500 py-2 rounded text-xs font-bold transition-colors flex items-center justify-center gap-2"
                            >
                              Apply +RM {alert.suggestedIncrease.toFixed(2)}
                            </button>
                        </div>
                      );
                    })}
                  </div>
                )}
            </div>
         </div>
      </div>

    </div>
  );
};

export default Dashboard;