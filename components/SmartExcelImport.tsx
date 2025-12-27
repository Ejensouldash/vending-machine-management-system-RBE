import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Calendar, Plus, Trash2, RefreshCw, Clock } from 'lucide-react';
import { getMachines, mergeTransactions, notify } from '../services/db';
import { VM_CONFIG } from '../lib/vm-config';

interface SmartExcelImportProps {
  onDataImported: (data: any[]) => void;
}

const SmartExcelImport: React.FC<SmartExcelImportProps> = ({ onDataImported }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importStats, setImportStats] = useState<{ totalRows: number; totalAmount: number } | null>(null);
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]); 
  // Parsed rows for preview + edit (move here to avoid use-before-define)
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const LOW_CONF_THRESHOLD = 60;

  // --- 🧠 OTAK AI V3: 24-HOUR MATRIX PARSER ---

  const extractDateFromFilename = (filename: string): string | null => {
    // Cari pattern YYYY-MM-DD
    const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})/);
    return dateMatch ? dateMatch[0] : null;
  };

  // Normalize helper
  const normalize = (s: string) => (s || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');

  // Find machine by name or ID heuristics — returns { machine, score }
  const findMachine = (miName: string, machines: any[]): { machine: any | null; score: number } => {
    if (!miName) return { machine: null, score: 0 };
    const input = miName.toString().trim();

    // If it looks like an ID
    const idMatch = input.match(/(VM[-_ ]?\d{3,}|\d{6,})/i);
    if (idMatch) {
      const idCandidate = idMatch[0].replace(/\s+/g, '').toUpperCase();
      const byId = machines.find(m => (m.id || '').toString().toUpperCase().includes(idCandidate));
      if (byId) return { machine: byId, score: 100 };
    }

    // Fuzzy match by normalized name
    const norm = normalize(input);
    let best: any = null;
    let bestScore = 0;
    machines.forEach(m => {
      const n = normalize(m.name || m.group || '');
      if (!n) return;
      // exact substring match -> high confidence
      if (n.includes(norm) || norm.includes(n)) {
        best = m; bestScore = 90;
      } else {
        // partial overlap score (simple heuristic)
        const common = norm.split('').filter(ch => n.includes(ch)).length;
        if (common > bestScore) { best = m; bestScore = Math.min(60 + common, 89); }
      }
    });
    return { machine: best || null, score: bestScore };
  };

  // Find slot by product name heuristics using VM_CONFIG.SLOTS — returns { slot, score }
  const findSlotByName = (productName: string): { slot: any | null; score: number } => {
    if (!productName) return { slot: null, score: 0 };
    const p = productName.toString().toLowerCase().trim();
    // exact contains
    const byName = VM_CONFIG.SLOTS.find(s => (s.name || '').toLowerCase().includes(p) || p.includes((s.name || '').toLowerCase()));
    if (byName) return { slot: byName, score: 90 };
    // try by id
    const byId = VM_CONFIG.SLOTS.find(s => (s.id || '').toLowerCase() === p || (s.id || '').toLowerCase().includes(p));
    if (byId) return { slot: byId, score: 95 };
    // fallback fuzzy: count common chars
    let best: any = null; let bestScore = 0;
    const norm = p.replace(/[^a-z0-9]/g, '');
    VM_CONFIG.SLOTS.forEach(s => {
      const n = (s.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!n) return;
      const common = norm.split('').filter(ch => n.includes(ch)).length;
      if (common > bestScore) { best = s; bestScore = common; }
    });
    if (best) return { slot: best, score: Math.min(50 + bestScore, 85) };
    return { slot: VM_CONFIG.SLOTS[0] || null, score: 20 };
  };

  const processFiles = async () => {
    setIsProcessing(true);
    let allTransactions: any[] = [];
    let grandTotalAmount = 0;

    for (const file of files) {
      try {
        const data = await readExcelFile(file);
        
        // 1. Tentukan Tarikh Dasar (Base Date)
        const filenameDate = extractDateFromFilename(file.name);
        const dateToUse = filenameDate || manualDate;

        console.log(`📂 Memproses: ${file.name} | Tarikh: ${dateToUse}`);

        // Kita check dulu jenis fail ni. Adakah ia "24-Hour Statistics"?
        // Check kalau ada keys macam "0:00", "12:00", "23:00"
        const firstRow = data[0] || {};
        const keys = Object.keys(firstRow);
        const hasTimeColumns = keys.some(k => k.includes(':00'));

        let cleanData: any[] = [];

        if (hasTimeColumns) {
            // --- STRATEGI 1: FORMAT MATRIX 24 JAM (Fail baru awak) ---
            console.log("⚡ Mengesan format 24-Hours Matrix...");
            
            data.forEach((row: any) => {
                // Skip baris Total
                const machineName = row['Name of machine'] || row['Machine name'] || '';
                if (typeof machineName === 'string' && machineName.toLowerCase().includes('total')) return; // Skip
                if (!row['Machine ID'] && !row['Name of machine']) return; // Skip baris kosong

                const miName = row['Name of machine'] || row['Machine name'] || 'Unknown VM';

                // Loop setiap jam dari 0:00 sampai 23:00
                for (let i = 0; i < 24; i++) {
                    const hourKey = `${i}:00`; // Contoh: "0:00", "11:00"
                    
                    // Cari value dalam column jam tu
                    let amount = row[hourKey];
                    
                    // Kalau ada sales pada jam tu
                    if (amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0) {
                        amount = parseFloat(amount);
                        
                        // 🔥 BINA TIMESTAMP YANG TEPAT
                        // Format: YYYY-MM-DDTHH:mm:ss
                        const hourStr = i.toString().padStart(2, '0');
                        const fullISODate = `${dateToUse}T${hourStr}:00:00`;

                        // Map to machine and product/slot heuristically (with confidence)
                        const machines = getMachines();
                        const mRes = findMachine(miName, machines);
                        const sRes = findSlotByName('Sales Consolidate');

                        cleanData.push({
                          TradeTime: fullISODate,
                          MiName: miName,
                          MachineId: mRes.machine?.id || null,
                          _machineScore: mRes.score || 0,
                          ProductName: 'Sales Consolidate', // Takde nama produk dalam report ni
                          SlotId: sRes.slot?.id || null,
                          _slotScore: sRes.score || 0,
                          Amount: amount,
                          PayType: 'Cash', // Default
                          Status: 'SUCCESS',
                          SourceFile: file.name
                        });
                    }
                }
            });

        } else {
            // --- STRATEGI 2: FORMAT STANDARD / SUMMARY BIASA ---
            console.log("⚡ Mengesan format Standard/Summary...");
            
            cleanData = data.map((row: any, index: number) => {
                 // Logic lama (untuk fail sebelum ni)
                 const machineNameVal = row['Machine name'] || row['Machine'] || '';
                 if (typeof machineNameVal === 'string' && machineNameVal.toLowerCase().includes('total')) return null;

                 let amount = row['Total amount'] || row['Amount'] || row['Price'] || row['Total amount'] || 0;
                 // Backup check column ke-10
                 if ((!amount || amount === 0) && Object.values(row).length > 8) {
                    const vals = Object.values(row);
                    if (typeof vals[9] === 'number') amount = vals[9];
                 }

                 if (typeof amount === 'string') amount = parseFloat(amount.replace(/[^0-9.-]+/g, ""));
                 if (!amount || amount === 0) return null;

                 // Random masa sebab fail summary takde jam
                 const randomHour = 9 + (index % 10);
                 const fullISODate = `${dateToUse}T${randomHour.toString().padStart(2,'0')}:30:00`;

                  // Map machine & slot with confidence
                  const machines = getMachines();
                  const mRes = findMachine(machineNameVal, machines);
                  const sRes = findSlotByName(row['Product'] || row['ProductName'] || 'Batch Import');

                  return {
                    TradeTime: fullISODate,
                    MiName: machineNameVal || 'Unknown VM',
                    MachineId: mRes.machine?.id || null,
                    _machineScore: mRes.score || 0,
                    ProductName: row['Product'] || row['ProductName'] || 'Batch Import',
                    SlotId: sRes.slot?.id || null,
                    _slotScore: sRes.score || 0,
                    Amount: Number(amount),
                    PayType: 'Cash',
                    Status: 'SUCCESS',
                    SourceFile: file.name
                  };
            }).filter(Boolean);
        }

        // Kira total
        const fileTotal = cleanData.reduce((sum: number, item: any) => sum + item.Amount, 0);
        grandTotalAmount += fileTotal;
        console.log(`✅ Jumpa ${cleanData.length} slot masa jualan. Total: RM${fileTotal}`);
        
        allTransactions = [...allTransactions, ...cleanData];

      } catch (err) {
        console.error(`❌ Gagal baca fail ${file.name}:`, err);
        alert(`Error membaca fail ${file.name}`);
      }
    }

    if (allTransactions.length > 0) {
      // Prepare preview rows with mapping metadata
      const machines = getMachines();
      const preview = allTransactions.map((tx, idx) => {
        const mres = findMachine(tx.MiName || '', machines);
        const sres = findSlotByName(tx.ProductName || '');
        return {
          ...tx,
          _rowId: `row-${Date.now()}-${idx}`,
          _mappedMachineId: tx.MachineId || (mres.machine?.id || null),
          _mappedSlotId: tx.SlotId || (sres.slot?.id || null),
          _machineScore: tx._machineScore || (mres.score || 0),
          _slotScore: tx._slotScore || (sres.score || 0),
          _autoMapped: !!(tx.MachineId || tx.SlotId)
        };
      });

      setParsedRows(preview);
      setImportStats({ totalRows: preview.length, totalAmount: grandTotalAmount });
    } else {
      alert("⚠️ Tiada data valid dijumpai. Pastikan format Excel betul.");
    }
    
    setIsProcessing(false);
  };

  

  const updateRowMapping = (rowId: string, key: '_mappedMachineId' | '_mappedSlotId', value: string | null) => {
    setParsedRows(prev => prev.map(r => r._rowId === rowId ? { ...r, [key]: value } : r));
  };

  const commitImport = async () => {
    if (parsedRows.length === 0) return;

    // Build Transaction objects compatible with services/db
    const newTxs = parsedRows.map((r, i) => {
      const slotId = r._mappedSlotId || r.SlotId || (VM_CONFIG.SLOTS[0] && VM_CONFIG.SLOTS[0].id) || null;
      const timestamp = r.TradeTime || new Date().toISOString();
      return {
        id: typeof crypto !== 'undefined' && (crypto as any).randomUUID ? (crypto as any).randomUUID() : `IMP-${Date.now()}-${i}`,
        refNo: r.RefNo || `IMP-${slotId || 'UNK'}-${Date.now()}-${i}`,
        paymentId: r.paymentId || '',
        productName: r.ProductName || 'Imported',
        slotId: slotId,
        amount: Number(r.Amount) || 0,
        currency: r.Currency || 'MYR',
        status: r.Status || 'SUCCESS',
        paymentMethod: r.PayType || 'Cash',
        timestamp: timestamp
      };
    });

    try {
      const added = mergeTransactions(newTxs as any);
      notify('admin', `IMPORT_EXCEL`, `Imported ${newTxs.length} transactions, ${added} new`);
      // Update sales_today summary
      const today = new Date().toDateString();
      const todaysTotal = (newTxs || []).filter(t => new Date(t.timestamp).toDateString() === today).reduce((s, t) => s + (t.amount || 0), 0);
      const existing = localStorage.getItem('vmms_sales_today');
      const salesData = existing ? JSON.parse(existing) : { total: 0, count: 0, lastUpdated: new Date().toISOString() };
      salesData.total = (salesData.total || 0) + todaysTotal;
      salesData.count = (salesData.count || 0) + (newTxs || []).filter(t => new Date(t.timestamp).toDateString() === today).length;
      salesData.lastUpdated = new Date().toISOString();
      localStorage.setItem('vmms_sales_today', JSON.stringify(salesData));

      // Notify app to refresh
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event('vmms:txs-updated'));

      // Publish last-import date range so dashboard can auto-select range
      try {
        const stamps = (newTxs || []).map(t => new Date(t.timestamp).toISOString());
        if (stamps.length > 0) {
          const min = stamps.reduce((a, b) => a < b ? a : b);
          const max = stamps.reduce((a, b) => a > b ? a : b);
          const startISO = min.slice(0, 10);
          const endISO = max.slice(0, 10);
          const payload = { start: startISO, end: endISO, uploadedAt: new Date().toISOString(), thatDay: startISO === endISO };
          localStorage.setItem('vmms_last_import_range', JSON.stringify(payload));
          window.dispatchEvent(new CustomEvent('vmms:last-import', { detail: payload } as any));
        }
      } catch (ee) {
        console.warn('Failed to publish last-import range', ee);
      }

      setParsedRows([]);
      setFiles([]);
      setImportStats(null);
      alert(`Import selesai. ${added} transaksi baru ditambah.`);
    } catch (e: any) {
      console.error('Commit import failed', e);
      alert('Gagal import. Lihat console.');
    }
  };

  const readExcelFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const bstr = e.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws);
          resolve(data);
        } catch (error) {
          reject(error);
        }
      };
      reader.readAsBinaryString(file);
    });
  };

  const handleFileDrop = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
      setImportStats(null);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6 transition-all">
      <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
        <FileSpreadsheet className="text-indigo-600" />
        AI Smart Import (Support: 24-Hour Statistics)
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* ZON UPLOAD */}
        <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:bg-indigo-50 transition-colors relative flex flex-col items-center justify-center min-h-[150px]">
          <input 
            type="file" 
            accept=".xlsx, .xls, .csv" 
            multiple 
            onChange={handleFileDrop}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <Upload size={32} className="text-slate-400 mb-2" />
          <p className="text-slate-600 font-medium">Drag fail Excel di sini</p>
          <p className="text-xs text-slate-400">Sokong: Summary, Transaction List & 24-Hour Report</p>
        </div>

        {/* ZON LIST FAIL & SETTING */}
        <div className="space-y-4">
            
            {/* Setting Tarikh */}
            <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-md border border-slate-200">
                <Calendar size={18} className="text-slate-500" />
                <span className="text-sm text-slate-600">Tarikh Fail:</span>
                <input 
                    type="date" 
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="bg-white border border-slate-300 rounded px-2 py-1 text-sm outline-none focus:border-indigo-500 font-bold text-slate-700"
                />
            </div>

            {/* List File */}
            {files.length > 0 && (
                <div className="max-h-[150px] overflow-y-auto space-y-2 pr-1">
                    {files.map((file, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-slate-100 p-2 rounded text-sm">
                            <span className="truncate max-w-[200px] text-slate-700">{file.name}</span>
                            <button onClick={() => removeFile(idx)} className="text-red-400 hover:text-red-600">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {files.length > 0 && !isProcessing && !importStats && (
                <button 
                    onClick={processFiles}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg"
                >
                    <Plus size={18} />
                    Analisis & Plot Graf
                </button>
            )}

              {/* Preview & Confirm */}
              {parsedRows.length > 0 && (
                <div className="mt-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-bold">Pratonton Import ({parsedRows.length} baris)</div>
                    <div className="flex gap-2">
                      <button onClick={() => { setParsedRows([]); setFiles([]); setImportStats(null); }} className="text-sm px-3 py-1 rounded bg-white border">Cancel</button>
                      <button onClick={commitImport} className="text-sm px-3 py-1 rounded bg-indigo-600 text-white">Commit Import</button>
                    </div>
                  </div>
                  <div className="max-h-44 overflow-y-auto border border-slate-100 rounded">
                    <table className="w-full text-sm">
                      <thead className="bg-white sticky top-0">
                        <tr className="text-xs text-slate-500">
                          <th className="p-2">Time</th>
                          <th className="p-2">Machine</th>
                          <th className="p-2">Assigned VM</th>
                          <th className="p-2">Product</th>
                          <th className="p-2">Slot</th>
                          <th className="p-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedRows.map(r => {
                          const lowConf = (r._machineScore || 0) < LOW_CONF_THRESHOLD || (r._slotScore || 0) < LOW_CONF_THRESHOLD;
                          return (
                            <tr key={r._rowId} className={`${lowConf ? 'bg-yellow-50' : ''} odd:bg-white even:bg-slate-50`}>
                              <td className="p-2 align-top">{new Date(r.TradeTime).toLocaleString()}</td>
                              <td className="p-2 align-top">{r.MiName}</td>
                              <td className="p-2 align-top">
                                <div className="flex items-center gap-2">
                                  <select value={r._mappedMachineId || ''} onChange={(e) => updateRowMapping(r._rowId, '_mappedMachineId', e.target.value || null)} className="text-sm border rounded px-2 py-1">
                                    <option value="">(Unassigned)</option>
                                    {getMachines().map(m => (<option key={m.id} value={m.id}>{m.name} — {m.id}</option>))}
                                  </select>
                                  <div className="text-xs text-slate-500">{(r._machineScore || 0) >= 1 ? `${Math.round(r._machineScore)}%` : '—'}</div>
                                </div>
                              </td>
                              <td className="p-2 align-top">{r.ProductName}</td>
                              <td className="p-2 align-top">
                                <div className="flex items-center gap-2">
                                  <select value={r._mappedSlotId || ''} onChange={(e) => updateRowMapping(r._rowId, '_mappedSlotId', e.target.value || null)} className="text-sm border rounded px-2 py-1">
                                    <option value="">(Unassigned)</option>
                                    {VM_CONFIG.SLOTS.map(s => (<option key={s.id} value={s.id}>{s.id} — {s.name}</option>))}
                                  </select>
                                  <div className="text-xs text-slate-500">{(r._slotScore || 0) >= 1 ? `${Math.round(r._slotScore)}%` : '—'}</div>
                                </div>
                              </td>
                              <td className="p-2 align-top text-right">RM {Number(r.Amount).toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            {isProcessing && (
                <div className="w-full bg-slate-100 text-slate-500 py-2 px-4 rounded-lg text-center animate-pulse font-medium">
                    <RefreshCw className="inline animate-spin mr-2" size={16}/>
                    AI sedang mengimbas 24 column masa...
                </div>
            )}

            {importStats && (
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-center animate-in fade-in zoom-in duration-300">
                    <div className="flex items-center justify-center gap-2 text-emerald-700 font-bold mb-1">
                        <CheckCircle size={20} />
                        Import Selesai!
                    </div>
                    <p className="text-sm text-emerald-800">
                        Total Jualan: <span className="text-lg font-bold">RM{importStats.totalAmount.toFixed(2)}</span>
                    </p>
                    <div className="flex justify-center items-center gap-2 mt-2 text-xs text-emerald-600">
                        <Clock size={12} />
                        <span>Data disusun mengikut jam (Graf 24 Jam)</span>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default SmartExcelImport;