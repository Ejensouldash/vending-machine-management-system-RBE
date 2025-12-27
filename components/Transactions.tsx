
import React, { useState, useMemo } from 'react';
import { Transaction } from '../types';
import { 
  List, CheckCircle, XCircle, Search, Filter, 
  ChevronLeft, ChevronRight, Download, ArrowUpRight, ArrowDownRight 
} from 'lucide-react';

interface TransactionsProps {
  transactions: Transaction[];
}

const ITEMS_PER_PAGE = 10;

const Transactions: React.FC<TransactionsProps> = ({ transactions }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUCCESS' | 'FAILED'>('ALL');

  // --- 1. FILTERING LOGIC ---
  const safeTx = Array.isArray(transactions) ? transactions : [];

  const filteredData = useMemo(() => {
    const q = (searchTerm || '').toLowerCase();
    return safeTx.filter(tx => {
      const ref = (tx?.refNo || '').toString().toLowerCase();
      const pname = (tx?.productName || '').toString().toLowerCase();
      const pid = (tx?.paymentId || '').toString().toLowerCase();

      const matchesSearch = q === '' ? true : (ref.includes(q) || pname.includes(q) || pid.includes(q));
      const matchesStatus = statusFilter === 'ALL' ? true : tx?.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [safeTx, searchTerm, statusFilter]);

  // --- 2. PAGINATION LOGIC ---
  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentData = filteredData.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // --- 3. SUMMARY STATS ---
  const totalVolume = filteredData.reduce((acc, curr) => acc + (typeof curr.amount === 'number' ? curr.amount : parseFloat(curr.amount || '0') || 0), 0);
  const successRate = filteredData.length > 0 
    ? (filteredData.filter(t => t.status === 'SUCCESS').length / filteredData.length) * 100 
    : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase">Displayed Volume</p>
            <h3 className="text-2xl font-bold text-slate-800">RM {totalVolume.toFixed(2)}</h3>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <ArrowUpRight size={20} />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase">Success Rate</p>
            <h3 className={`text-2xl font-bold ${successRate >= 90 ? 'text-emerald-600' : 'text-orange-500'}`}>
              {successRate.toFixed(1)}%
            </h3>
          </div>
          <div className={`p-3 rounded-lg ${successRate >= 90 ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>
            <CheckCircle size={20} />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase">Total Records</p>
            <h3 className="text-2xl font-bold text-slate-800">{filteredData.length}</h3>
          </div>
          <div className="p-3 bg-slate-100 text-slate-600 rounded-lg">
            <List size={20} />
          </div>
        </div>
      </div>

      {/* MAIN TABLE CARD */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
        
        {/* HEADER TOOLBAR */}
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/50">
          <div className="flex items-center gap-2">
             <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
               <List size={20} className="text-indigo-600" />
               Transaction History
             </h3>
             <span className="text-xs font-mono bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
               Page {currentPage} of {totalPages || 1}
             </span>
          </div>

          <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative group">
              <Search className="absolute left-3 top-2.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
              <input 
                type="text" 
                placeholder="Search RefNo, Product..." 
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
              />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <div className="absolute left-3 top-2.5 text-slate-400 pointer-events-none">
                <Filter size={16} />
              </div>
              <select 
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value as any); setCurrentPage(1); }}
                className="pl-10 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm appearance-none cursor-pointer hover:bg-slate-50"
              >
                <option value="ALL">All Status</option>
                <option value="SUCCESS">Success</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>

            {/* Export Button (Visual) */}
            <button className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-indigo-600 hover:border-indigo-200 shadow-sm transition-all" title="Export CSV">
              <Download size={20} />
            </button>
          </div>
        </div>

        {/* TABLE CONTENT */}
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-900 font-semibold border-b border-slate-200 sticky top-0">
              <tr>
                <th className="px-6 py-4">Date/Time</th>
                <th className="px-6 py-4">Ref No / Payment ID</th>
                <th className="px-6 py-4">Product Info</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center flex flex-col items-center justify-center">
                    <div className="bg-slate-100 p-4 rounded-full mb-3">
                      <Search size={32} className="text-slate-400" />
                    </div>
                    <p className="text-slate-500 font-medium">No transactions found.</p>
                    <p className="text-xs text-slate-400">Try adjusting your search or filters.</p>
                  </td>
                </tr>
              ) : (
                currentData.map((tx) => (
                  <tr key={tx.id} className="hover:bg-indigo-50/30 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-slate-700">
                        {new Date(tx.timestamp).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-slate-400">
                        {new Date(tx.timestamp).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-mono text-xs font-medium text-slate-600 group-hover:text-indigo-600 transition-colors">
                        {tx.refNo}
                      </div>
                      <div className="font-mono text-[10px] text-slate-400 mt-1">
                        PID: {tx.paymentId}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800">{tx.productName}</span>
                        <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded w-fit mt-1">
                          {tx.slotId}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="font-bold text-slate-800">
                        {tx.currency} {((typeof tx.amount === 'number' ? tx.amount : parseFloat(tx.amount || '0') || 0)).toFixed(2)}
                      </div>
                      <div className="text-[10px] text-slate-400">{tx.paymentMethod}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {tx.status === 'SUCCESS' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                          <CheckCircle size={12} />
                          Paid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">
                          <XCircle size={12} />
                          Failed
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* FOOTER PAGINATION */}
        {filteredData.length > 0 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
            <p className="text-xs text-slate-500">
              Showing <span className="font-bold">{startIndex + 1}</span> to <span className="font-bold">{Math.min(startIndex + ITEMS_PER_PAGE, filteredData.length)}</span> of <span className="font-bold">{filteredData.length}</span> results
            </p>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              
              {/* Simple Page Indicator */}
              <div className="flex items-center gap-1">
                 {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    // Logic to show limited page numbers (sliding window logic can be complex, keeping simple for now)
                    let pNum = i + 1;
                    if (totalPages > 5 && currentPage > 3) {
                       pNum = currentPage - 2 + i;
                    }
                    if (pNum > totalPages) return null;

                    return (
                      <button
                        key={pNum}
                        onClick={() => handlePageChange(pNum)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                          currentPage === pNum 
                            ? 'bg-indigo-600 text-white shadow-md' 
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {pNum}
                      </button>
                    );
                 })}
              </div>

              <button 
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Transactions;
