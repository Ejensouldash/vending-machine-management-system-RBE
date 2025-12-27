
import React from 'react';
import { VM_CONFIG } from '../lib/vm-config';
import { FileText, ShieldCheck, Building, Download } from 'lucide-react';
import { notify } from '../services/db';

const Compliance: React.FC = () => {

  const handleDownloadReport = () => {
    // Generate CSV Content
    const headers = ["TaxID", "Company", "Gross_Sales", "SST_Rate", "SST_Payable", "Date_Generated"];
    const row = ["C1234567890", "ROZITA BINA ENTERPRISE", "8900.00", "0.00", "0.00", new Date().toISOString()];
    
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + row.join(",");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Borang_EB_Draft_Oct2023.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    notify("Draft Report downloaded successfully.", 'success');
  };

  return (
    <div className="space-y-6">
      
      {/* LHDN Status Banner */}
      <div className="bg-gradient-to-r from-blue-900 to-slate-900 rounded-xl p-6 text-white flex justify-between items-center shadow-lg">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShieldCheck className="text-emerald-400" />
            LHDN MyInvois Status
          </h2>
          <p className="text-blue-200 text-sm mt-1">System is connected to LHDN API (v1.0.4)</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-emerald-400">Active</div>
          <div className="text-xs text-blue-300">Last Sync: 2 mins ago</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Tax Reporting Widget */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <FileText className="text-orange-500" size={20} />
            Tax Reporting (Borang EB & SST)
          </h3>
          <div className="space-y-4">
             <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                <span className="text-sm font-medium text-slate-600">Gross Sales (MTD)</span>
                <span className="font-bold text-slate-900">RM 8,900.00</span>
             </div>
             <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                <span className="text-sm font-medium text-slate-600">SST Payable (6%*)</span>
                <span className="font-bold text-slate-900">RM 0.00</span>
             </div>
             <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                <span className="text-sm font-medium text-slate-600">Taxable Income (Est.)</span>
                <span className="font-bold text-slate-900">RM 3,450.00</span>
             </div>
             <button 
               onClick={handleDownloadReport}
               className="w-full border border-blue-900 text-blue-900 hover:bg-blue-50 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors"
             >
               <Download size={16} />
               Download Borang EB Draft
             </button>
             <p className="text-xs text-slate-400 italic">*Vending food/beverage often 0% SST, subject to threshold.</p>
          </div>
        </div>

        {/* Commission Management Widget */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Building className="text-blue-600" size={20} />
            Location Commissions
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="pb-2">Location</th>
                  <th className="pb-2">Rate</th>
                  <th className="pb-2 text-right">Sales</th>
                  <th className="pb-2 text-right">Payout</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {VM_CONFIG.LOCATIONS.map(loc => (
                  <tr key={loc.id}>
                    <td className="py-3 font-medium text-slate-800">{loc.name}</td>
                    <td className="py-3 text-slate-500">{(loc.commissionRate * 100).toFixed(0)}%</td>
                    <td className="py-3 text-right">RM{loc.totalSales}</td>
                    <td className="py-3 text-right font-bold text-emerald-600">
                      RM{(loc.totalSales * loc.commissionRate).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Compliance;
