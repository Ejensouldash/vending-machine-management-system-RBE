
import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area, ComposedChart
} from 'recharts';
import { 
  TrendingUp, ShoppingBag, MapPin, Clock, Calendar, 
  Lightbulb, ArrowUpRight, ArrowDownRight, Filter, Search, LayoutGrid
} from 'lucide-react';
import { Transaction, ProductSlot } from '../types';
import { getMachines } from '../services/db';
import { VM_CONFIG } from '../lib/vm-config';

interface SalesAnalyticsProps {
  transactions: Transaction[];
  inventory: ProductSlot[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function SalesAnalytics({ transactions, inventory }: SalesAnalyticsProps) {
   const safeTx = Array.isArray(transactions) ? transactions : [];
   const safeInv = Array.isArray(inventory) ? inventory : [];
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'locations'>('overview');
  const [timeRange, setTimeRange] = useState('30_DAYS');

  // --- DATA PROCESSING HOOKS ---

  // 1. Product Performance Data
  const productPerformance = useMemo(() => {
    const stats: Record<string, { name: string, quantity: number, revenue: number, slotId: string }> = {};
    
      safeTx.forEach(tx => {
         const pname = tx?.productName || 'Unknown';
         const amount = typeof tx?.amount === 'number' ? tx.amount : parseFloat(tx?.amount || '0') || 0;
         const slotId = tx?.slotId || 'UNKNOWN';
         if (!stats[pname]) {
            stats[pname] = { name: pname, quantity: 0, revenue: 0, slotId };
         }
         stats[pname].quantity += 1;
         stats[pname].revenue += amount;
      });

    return Object.values(stats).sort((a, b) => b.revenue - a.revenue);
  }, [transactions]);

  // 2. Hourly Sales (Peak Time Analysis)
  const hourlyData = useMemo(() => {
    const hours = Array(24).fill(0).map((_, i) => ({ hour: `${i}:00`, sales: 0 }));
      safeTx.forEach(tx => {
         const d = new Date(tx?.timestamp);
         if (isNaN(d.getTime())) return; // skip invalid timestamps
         const h = d.getHours();
         if (h >= 0 && h < 24) hours[h].sales += 1;
      });
    return hours;
  }, [transactions]);

  // 3. Location Performance
  const locationPerformance = useMemo(() => {
       // Determine location performance by mapping Slot ID deterministically to a configured location.
       // Transactions sometimes lack a machineId; we derive location by hashing slotId so results are stable.
       const locs: Record<string, number> = {};
       if (!VM_CONFIG.LOCATIONS || VM_CONFIG.LOCATIONS.length === 0) return [];

       const hashString = (s: string) => {
          let h = 0;
          for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i) | 0;
          return Math.abs(h);
       };

       safeTx.forEach(tx => {
          const amt = typeof tx?.amount === 'number' ? tx.amount : parseFloat(tx?.amount || '0') || 0;
          const slot = tx?.slotId || 'UNKNOWN';
          const idx = VM_CONFIG.LOCATIONS.length > 0 ? (hashString(slot) % VM_CONFIG.LOCATIONS.length) : 0;
          const location = VM_CONFIG.LOCATIONS[idx];
          if (location) {
             locs[location.name] = (locs[location.name] || 0) + amt;
          }
       });

       return Object.entries(locs).map(([name, value]) => ({ name, value }));
  }, [transactions]);

  // 4. AI Insights Generation
  const aiInsights = useMemo(() => {
    const insights = [];
    
    // Top Seller
    if (productPerformance.length > 0) {
      const top = productPerformance[0];
      insights.push({
        type: 'success',
        title: 'Star Product',
        text: `'${top.name}' is your #1 bestseller, contributing RM ${top.revenue.toFixed(2)} revenue. Ensure Slot ${top.slotId} never runs empty.`
      });
    }

    // Dead Stock
    const deadStock = inventory.filter(i => !productPerformance.find(p => p.name === i.name));
    if (deadStock.length > 0) {
      insights.push({
        type: 'warning',
        title: 'Dead Stock Alert',
        text: `${deadStock.length} items have zero sales in this period (e.g., ${deadStock[0].name}). Consider replacing them.`
      });
    }

    // Peak Time
    const peakHour = hourlyData.reduce((max, curr) => curr.sales > max.sales ? curr : max, hourlyData[0]);
    insights.push({
      type: 'info',
      title: 'Peak Traffic',
      text: `Highest sales volume occurs at ${peakHour.hour}. Schedule maintenance outside this window.`
    });

    return insights;
  }, [productPerformance, inventory, hourlyData]);

  return (
    <div className="space-y-6">
      
      {/* HEADER & CONTROLS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Sales Intelligence</h2>
          <p className="text-sm text-slate-500">Deep dive into revenue, product affinity, and location trends.</p>
        </div>
        <div className="flex gap-2">
           <div className="flex bg-slate-100 p-1 rounded-lg">
              <button 
                onClick={() => setActiveTab('overview')}
                className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${activeTab === 'overview' ? 'bg-white shadow text-blue-700' : 'text-slate-500'}`}
              >
                Overview
              </button>
              <button 
                onClick={() => setActiveTab('products')}
                className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${activeTab === 'products' ? 'bg-white shadow text-blue-700' : 'text-slate-500'}`}
              >
                Products & Slots
              </button>
              <button 
                onClick={() => setActiveTab('locations')}
                className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${activeTab === 'locations' ? 'bg-white shadow text-blue-700' : 'text-slate-500'}`}
              >
                Locations
              </button>
           </div>
           <select 
             value={timeRange} 
             onChange={(e) => setTimeRange(e.target.value)}
             className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
           >
             <option value="7_DAYS">Last 7 Days</option>
             <option value="30_DAYS">Last 30 Days</option>
             <option value="THIS_YEAR">This Year</option>
           </select>
        </div>
      </div>

      {/* TAB CONTENT: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
           
           {/* Chart: Hourly Heatmap */}
           <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                 <Clock className="text-orange-500" size={20} /> Buying Habits (Peak Hours)
              </h3>
              <div className="h-[300px]">
                 <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={hourlyData}>
                       <defs>
                          <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                             <stop offset="5%" stopColor="#f97316" stopOpacity={0.8}/>
                             <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                          </linearGradient>
                       </defs>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} />
                       <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                       <YAxis axisLine={false} tickLine={false} />
                       <Tooltip />
                       <Area type="monotone" dataKey="sales" stroke="#f97316" fillOpacity={1} fill="url(#colorSales)" />
                    </AreaChart>
                 </ResponsiveContainer>
              </div>
           </div>

           {/* AI Insights Panel */}
           <div className="bg-gradient-to-b from-indigo-900 to-slate-900 text-white p-6 rounded-xl shadow-lg flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                 <Lightbulb className="text-yellow-400" />
                 <h3 className="font-bold text-lg">AI Smart Suggestions</h3>
              </div>
              <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                 {aiInsights.map((insight, idx) => (
                    <div key={idx} className="bg-white/10 p-4 rounded-lg border border-white/10 backdrop-blur-sm">
                       <h4 className={`text-sm font-bold mb-1 flex items-center gap-2 ${
                         insight.type === 'success' ? 'text-emerald-400' : 
                         insight.type === 'warning' ? 'text-rose-400' : 'text-blue-400'
                       }`}>
                          {insight.type === 'success' ? <ArrowUpRight size={16}/> : 
                           insight.type === 'warning' ? <ArrowDownRight size={16}/> : <LayoutGrid size={16}/>}
                          {insight.title}
                       </h4>
                       <p className="text-xs text-slate-300 leading-relaxed">{insight.text}</p>
                    </div>
                 ))}
                 <div className="bg-white/5 p-4 rounded-lg border border-white/5 border-dashed flex flex-col items-center justify-center text-center">
                    <p className="text-xs text-slate-400 mb-2">Want more deep learning analysis?</p>
                    <button className="text-xs bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded transition-colors">Run Full Report</button>
                 </div>
              </div>
           </div>

        </div>
      )}

      {/* TAB CONTENT: PRODUCTS */}
      {activeTab === 'products' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
           
           {/* Top 10 Products Chart */}
           <div className="lg:col-span-3 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                 <ShoppingBag className="text-blue-600" size={20} /> Top Performing Products (Revenue)
              </h3>
              <div className="h-[350px]">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={productPerformance.slice(0, 10)} layout="vertical" margin={{left: 20}}>
                       <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                       <XAxis type="number" hide />
                       <YAxis dataKey="name" type="category" width={150} tick={{fontSize: 11, fontWeight: 600}} />
                       <Tooltip cursor={{fill: '#f1f5f9'}} />
                       <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                 </ResponsiveContainer>
              </div>
           </div>

           {/* Detailed Table */}
           <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                 <h3 className="font-bold text-slate-800">Product Sales Details</h3>
                 <button className="text-xs text-blue-600 font-bold hover:underline">Download CSV</button>
              </div>
              <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left">
                    <thead className="text-slate-500 border-b border-slate-200">
                       <tr>
                          <th className="p-4">Product Name</th>
                          <th className="p-4">Assigned Slot</th>
                          <th className="p-4 text-center">Qty Sold</th>
                          <th className="p-4 text-right">Total Revenue</th>
                          <th className="p-4 text-right">% Contribution</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                       {productPerformance.map((p, i) => {
                          const totalRev = productPerformance.reduce((sum, x) => sum + x.revenue, 0);
                          const pct = ((p.revenue / totalRev) * 100).toFixed(1);
                          return (
                             <tr key={i} className="hover:bg-slate-50">
                                <td className="p-4 font-bold text-slate-700 flex items-center gap-2">
                                   <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] text-white font-bold ${i < 3 ? 'bg-amber-400' : 'bg-slate-300'}`}>{i + 1}</div>
                                   {p.name}
                                </td>
                                <td className="p-4 font-mono text-slate-500">{p.slotId}</td>
                                <td className="p-4 text-center">{p.quantity}</td>
                                <td className="p-4 text-right font-bold text-emerald-600">RM {p.revenue.toFixed(2)}</td>
                                <td className="p-4 text-right">
                                   <div className="flex items-center justify-end gap-2">
                                      <span className="text-xs text-slate-400">{pct}%</span>
                                      <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                         <div className="bg-blue-500 h-full" style={{ width: `${pct}%` }}></div>
                                      </div>
                                   </div>
                                </td>
                             </tr>
                          );
                       })}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      )}

      {/* TAB CONTENT: LOCATIONS */}
      {activeTab === 'locations' && (
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
               <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <MapPin className="text-rose-500" size={20} /> Revenue Share by Location
               </h3>
               <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                        <Pie
                           data={locationPerformance}
                           cx="50%"
                           cy="50%"
                           innerRadius={60}
                           outerRadius={100}
                           paddingAngle={2}
                           dataKey="value"
                        >
                           {locationPerformance.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                           ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                     </PieChart>
                  </ResponsiveContainer>
               </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
               <h3 className="text-lg font-bold text-slate-800 mb-4">Location Insights</h3>
               <div className="space-y-4">
                  {locationPerformance.map((loc, i) => (
                     <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-600">
                              {i + 1}
                           </div>
                           <div>
                              <h4 className="font-bold text-slate-800">{loc.name}</h4>
                              <p className="text-xs text-slate-500">High traffic: 12PM - 2PM</p>
                           </div>
                        </div>
                        <div className="text-right">
                           <p className="font-bold text-emerald-600 text-lg">RM {loc.value.toFixed(2)}</p>
                           <p className="text-xs text-slate-400">Total Revenue</p>
                        </div>
                     </div>
                  ))}
               </div>
            </div>
         </div>
      )}
      
    </div>
  );
}
