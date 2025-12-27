import { ProductSlot, Transaction, IPay88CallbackData, WarehouseItem, PurchaseOrder, ServiceTicket, Alarm, Machine, User, AuditLog } from '../types';
import { VM_CONFIG } from '../lib/vm-config';
import { constructResponseSignature, generateSignature } from './crypto';

const STORAGE_KEYS = {
  STOCK_COUNTS: 'vmms_stock_counts',
  PRICES: 'vmms_prices',
  NAMES: 'vmms_names',
  TRANSACTIONS: 'vmms_transactions',
  WAREHOUSE: 'vmms_warehouse',
  POS: 'vmms_purchase_orders',
  TICKETS: 'vmms_service_tickets',
  ALARMS: 'vmms_alarms',
  MACHINES: 'vmms_machines',
  USERS: 'vmms_users',         
  AUDIT_LOGS: 'vmms_audit_logs',
  // TCN SPECIFIC KEYS (Wajib simpan masa reset)
  SALES_TODAY: 'vmms_sales_today',      
  TX_RECENT: 'vmms_transactions_recent'
};

// INITIAL SEED MACHINES (Seeded only once if no TCN data)
const INITIAL_MACHINES: Machine[] = [
  { id: 'VM-1001', name: 'KPTM Bangi - Lobby', group: 'KPTM Bangi', signal: 4, temp: 4, status: 'ONLINE', door: 'CLOSED', bill: 'OK', coin: 'OK', card: 'OK', stock: 85, lastSync: 'Just now' },
  { id: 'VM-1002', name: 'KPTM Bangi - Hostel A', group: 'KPTM Bangi', signal: 3, temp: 5, status: 'ONLINE', door: 'CLOSED', bill: 'OK', coin: 'LOW', card: 'OK', stock: 42, lastSync: '2 mins ago' },
  { id: 'VM-2001', name: 'UPTM Cheras - Main Hall', group: 'UPTM Cheras', signal: 5, temp: 3, status: 'ONLINE', door: 'CLOSED', bill: 'OK', coin: 'OK', card: 'OK', stock: 92, lastSync: '1 min ago' },
  { id: 'VM-2002', name: 'UPTM Cheras - Library', group: 'UPTM Cheras', signal: 0, temp: 0, status: 'OFFLINE', door: 'CLOSED', bill: 'UNKNOWN', coin: 'UNKNOWN', card: 'UNKNOWN', stock: 0, lastSync: '5 hours ago' },
  { id: 'VM-3001', name: 'Rozita HQ - Pantry', group: 'HQ', signal: 5, temp: 12, status: 'ERROR', door: 'OPEN', bill: 'JAMMED', coin: 'OK', card: 'OK', stock: 60, lastSync: '10 mins ago' },
  { id: 'VM-4005', name: 'LRT Station - Entrance', group: 'Public', signal: 2, temp: 6, status: 'ONLINE', door: 'CLOSED', bill: 'OK', coin: 'OK', card: 'ERR', stock: 15, lastSync: '5 mins ago' },
];

// INITIAL USERS
const INITIAL_USERS: User[] = [
  { id: 'U-001', username: 'admin', password: 'password123', fullName: 'Super Admin', role: 'SUPER_ADMIN', isActive: true },
  { id: 'U-002', username: 'ahmad_tech', password: 'password123', fullName: 'Ahmad Albab', role: 'TECHNICIAN', isActive: true },
  { id: 'U-003', username: 'sarah_mgr', password: 'password123', fullName: 'Sarah Manager', role: 'MANAGER', isActive: true },
];

// Helper to generate 1 Year of realistic data
const generateHistoricalData = (): Transaction[] => {
  const txs: Transaction[] = [];
  const products = VM_CONFIG.SLOTS;
  const now = new Date();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(now.getFullYear() - 1);

  // Iterate day by day from 1 year ago to today
  for (let d = new Date(oneYearAgo); d <= now; d.setDate(d.getDate() + 1)) {
    // Determine daily volume (Weekends slightly busier)
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const baseVolume = isWeekend ? 15 : 8; 
    const randomVar = Math.floor(Math.random() * 10);
    const dailyCount = baseVolume + randomVar;

    for (let i = 0; i < dailyCount; i++) {
      const product = products[Math.floor(Math.random() * products.length)];
      
      // Randomize time within operation hours (8 AM - 11 PM)
      const time = new Date(d);
      time.setHours(Math.floor(Math.random() * 15) + 8); 
      time.setMinutes(Math.floor(Math.random() * 60));

      // Payment method distribution
      const methodRand = Math.random();
      const method = methodRand > 0.6 ? 'E-Wallet' : methodRand > 0.3 ? 'Cash' : 'Card';

      txs.push({
        id: `HIST-${time.getTime()}-${i}`,
        refNo: `ORD-${product.id}-${time.getTime()}`,
        paymentId: `PAY-${time.getTime()}`,
        productName: product.name,
        slotId: product.id,
        amount: product.price,
        currency: 'MYR',
        status: Math.random() > 0.05 ? 'SUCCESS' : 'FAILED', // 95% Success rate
        paymentMethod: method,
        timestamp: time.toISOString()
      });
    }
  }
  return txs.reverse(); // Newest first
};

// Global Event Emitter for Toasts
export const notify = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
  const event = new CustomEvent('vmms-toast', { detail: { message, type } });
  window.dispatchEvent(event);
};

// --- LOGGING UTILITY ---
export const logAction = (actor: string, action: string, details: string) => {
  const logsData = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
  const logs: AuditLog[] = logsData ? JSON.parse(logsData) : [];
  
  const newLog: AuditLog = {
    id: `LOG-${Date.now()}-${Math.floor(Math.random()*1000)}`,
    timestamp: new Date().toISOString(),
    actor,
    action,
    details
  };
  
  // Keep last 1000 logs
  logs.unshift(newLog);
  if (logs.length > 1000) logs.pop();
  
  localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(logs));
};

export const initDB = () => {
  // Init Stock
  if (!localStorage.getItem(STORAGE_KEYS.STOCK_COUNTS)) {
    const initialStockMap: Record<string, number> = {};
    VM_CONFIG.SLOTS.forEach(slot => {
      initialStockMap[slot.id] = slot.initialStock;
    });
    localStorage.setItem(STORAGE_KEYS.STOCK_COUNTS, JSON.stringify(initialStockMap));
  }
  
  // Init Machines
  if (!localStorage.getItem(STORAGE_KEYS.MACHINES)) {
    localStorage.setItem(STORAGE_KEYS.MACHINES, JSON.stringify(INITIAL_MACHINES));
  }

  // Init Transactions (Generate 1 Year Data if empty) - will be overwritten if TCN session exists and we sync
  if (!localStorage.getItem(STORAGE_KEYS.TRANSACTIONS)) {
    const historicalData = generateHistoricalData();
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(historicalData));
    console.log(`Seeded ${historicalData.length} historical transactions.`);
  }

  // Init Prices
  if (!localStorage.getItem(STORAGE_KEYS.PRICES)) {
    const initialPriceMap: Record<string, number> = {};
    VM_CONFIG.SLOTS.forEach(slot => {
      initialPriceMap[slot.id] = slot.price;
    });
    localStorage.setItem(STORAGE_KEYS.PRICES, JSON.stringify(initialPriceMap));
  }
  
  // Init Names
  if (!localStorage.getItem(STORAGE_KEYS.NAMES)) {
    const initialNameMap: Record<string, string> = {};
    VM_CONFIG.SLOTS.forEach(slot => {
      initialNameMap[slot.id] = slot.name;
    });
    localStorage.setItem(STORAGE_KEYS.NAMES, JSON.stringify(initialNameMap));
  }

  // Init Warehouse (New)
  if (!localStorage.getItem(STORAGE_KEYS.WAREHOUSE)) {
    localStorage.setItem(STORAGE_KEYS.WAREHOUSE, JSON.stringify(VM_CONFIG.WAREHOUSE));
  }

  // Init Alarms (New - allow state changes)
  if (!localStorage.getItem(STORAGE_KEYS.ALARMS)) {
    localStorage.setItem(STORAGE_KEYS.ALARMS, JSON.stringify(VM_CONFIG.ALARMS));
  }

  // Init Users
  if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
  }

  // Init Logs
  if (!localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS)) {
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify([]));
  }
};

// --- NEW: Sync initial data from TCN (when bot session cookie exists)
import * as TCN from './tcn';

export const syncInitialFromTCN = async (days = 30) => {
  try {
    // Check for session cookie file first
    const sessionResp = await fetch('/session.json', { cache: 'no-store' });
    if (!sessionResp.ok) {
      console.log('[DB] No session.json found. Skipping TCN initial sync.');
      return false;
    }

    const sessionJson = await sessionResp.json();
    if (!sessionJson?.cookie) {
      console.log('[DB] session.json present but no cookie field found. Skipping TCN initial sync.');
      return false;
    }

    // 1. Fetch latest machines
    const machinesResult = await TCN.fetchLiveMachineStatus();
    if (machinesResult.success) {
      localStorage.setItem(STORAGE_KEYS.MACHINES, JSON.stringify(machinesResult.data));
      console.log(`[DB] Synced ${machinesResult.data.length} machines from TCN.`);
    }

    // 2. Fetch sales for the specified days
    const salesResult = await TCN.fetchSalesHistory(days);
    if (salesResult.success) {
      // Overwrite transactions with cloud data (user requested real-time data)
      const txs = salesResult.transactions || [];
      txs.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(txs));

      // Store summary for dashboard
      const salesData = {
        total: salesResult.totalSalesToday,
        count: txs.filter(t => new Date(t.timestamp).toDateString() === new Date().toDateString()).length,
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_KEYS.SALES_TODAY, JSON.stringify(salesData));

      console.log(`[DB] Synced ${txs.length} transactions from TCN and set today's total RM ${salesResult.totalSalesToday.toFixed(2)}.`);
    }

    // Dispatch to notify UI
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('vmms:txs-updated'));

    return true;
  } catch (e: any) {
    console.error('[DB] Error syncing from TCN:', e);
    return false;
  }
};

// --- MACHINES ---
export const getMachines = (): Machine[] => {
  const data = localStorage.getItem(STORAGE_KEYS.MACHINES);
  return data ? JSON.parse(data) : INITIAL_MACHINES;
};

export const updateMachineStatus = (id: string, updates: Partial<Machine>) => {
  const machines = getMachines();
  const updated = machines.map(m => m.id === id ? { ...m, ...updates, lastSync: 'Just now' } : m);
  localStorage.setItem(STORAGE_KEYS.MACHINES, JSON.stringify(updated));
  return updated;
};

// --- WAREHOUSE OPERATIONS ---
export const getWarehouseInventory = (): WarehouseItem[] => {
  const data = localStorage.getItem(STORAGE_KEYS.WAREHOUSE);
  return data ? JSON.parse(data) : VM_CONFIG.WAREHOUSE;
};

export const transferStock = (sku: string, from: 'HQ' | 'TRUCK', to: 'HQ' | 'TRUCK', qty: number): boolean => {
  try {
    const items = getWarehouseInventory();
    const idx = items.findIndex(i => i.sku === sku);
    if (idx === -1) return false;

    const item = items[idx];
    if (from === 'HQ') {
       if (item.hqStock < qty) {
         notify("Insufficient stock in HQ!", 'error');
         return false;
       }
       item.hqStock -= qty;
       item.truckStock += qty;
    } else {
       if (item.truckStock < qty) {
         notify("Insufficient stock in Truck!", 'error');
         return false;
       }
       item.truckStock -= qty;
       item.hqStock += qty;
    }

    items[idx] = item;
    localStorage.setItem(STORAGE_KEYS.WAREHOUSE, JSON.stringify(items));
    logAction('admin', 'TRANSFER_STOCK', `Moved ${qty} of ${sku} from ${from} to ${to}`);
    notify(`Successfully transferred ${qty} units.`, 'success');
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
};

// --- PURCHASE ORDERS ---
export const getPurchaseOrders = (): PurchaseOrder[] => {
  const data = localStorage.getItem(STORAGE_KEYS.POS);
  return data ? JSON.parse(data) : [];
};

export const createPurchaseOrder = (po: PurchaseOrder) => {
  const pos = getPurchaseOrders();
  pos.unshift(po);
  localStorage.setItem(STORAGE_KEYS.POS, JSON.stringify(pos));
  logAction('admin', 'CREATE_PO', `Created PO ${po.id} for ${po.supplierName}`);
  notify(`PO #${po.id} created for ${po.supplierName}`, 'success');
};

// --- ALARMS & TICKETS ---
export const getAlarms = (): Alarm[] => {
  const data = localStorage.getItem(STORAGE_KEYS.ALARMS);
  return data ? JSON.parse(data) : VM_CONFIG.ALARMS;
};

export const updateAlarmStatus = (alarmId: string, status: 'OPEN' | 'RESOLVED', tech?: string, note?: string) => {
  const alarms = getAlarms();
  const updated = alarms.map(a => a.id === alarmId ? { ...a, status, assignedTechnician: tech, resolutionNote: note } : a);
  localStorage.setItem(STORAGE_KEYS.ALARMS, JSON.stringify(updated));
  logAction(tech || 'admin', 'UPDATE_ALARM', `Alarm ${alarmId} set to ${status}`);
  notify(`Alarm ${alarmId} updated to ${status}`, 'success');
};

export const createServiceTicket = (ticket: ServiceTicket) => {
  const ticketsData = localStorage.getItem(STORAGE_KEYS.TICKETS);
  const tickets: ServiceTicket[] = ticketsData ? JSON.parse(ticketsData) : [];
  tickets.unshift(ticket);
  localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(tickets));
  
  // Also update alarm to show assigned
  updateAlarmStatus(ticket.alarmId, 'OPEN', ticket.technician);
  logAction('admin', 'DISPATCH_TECH', `Ticket ${ticket.id} assigned to ${ticket.technician}`);
  notify(`Ticket #${ticket.id} dispatched to ${ticket.technician}`, 'success');
};

// --- USER MANAGEMENT ---
export const getUsers = (): User[] => {
  const data = localStorage.getItem(STORAGE_KEYS.USERS);
  return data ? JSON.parse(data) : INITIAL_USERS;
};

export const saveUser = (user: User) => {
  const users = getUsers();
  const existingIdx = users.findIndex(u => u.id === user.id);
  
  if (existingIdx >= 0) {
    // Update
    users[existingIdx] = user;
    logAction('admin', 'UPDATE_USER', `Updated user ${user.username}`);
  } else {
    // Create
    users.push(user);
    logAction('admin', 'CREATE_USER', `Created user ${user.username}`);
  }
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  return true;
};

export const deleteUser = (userId: string) => {
  let users = getUsers();
  const user = users.find(u => u.id === userId);
  users = users.filter(u => u.id !== userId);
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  logAction('admin', 'DELETE_USER', `Deleted user ${user?.username || userId}`);
};

export const getAuditLogs = (): AuditLog[] => {
  const data = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
  return data ? JSON.parse(data) : [];
};

// --- CORE OPERATIONS ---
export const getInventory = (): ProductSlot[] => {
  const stockData = localStorage.getItem(STORAGE_KEYS.STOCK_COUNTS);
  const stockMap: Record<string, number> = stockData ? JSON.parse(stockData) : {};

  const priceData = localStorage.getItem(STORAGE_KEYS.PRICES);
  const priceMap: Record<string, number> = priceData ? JSON.parse(priceData) : {};

  const nameData = localStorage.getItem(STORAGE_KEYS.NAMES);
  const nameMap: Record<string, string> = nameData ? JSON.parse(nameData) : {};

  return VM_CONFIG.SLOTS.map(config => ({
    id: config.id,
    name: nameMap[config.id] || config.name,
    price: priceMap[config.id] !== undefined ? priceMap[config.id] : config.price, 
    maxCapacity: config.maxCapacity,
    currentStock: stockMap[config.id] !== undefined ? stockMap[config.id] : config.initialStock,
    expiryDate: config.expiryDate
  }));
};

export const updateProductPrice = (slotId: string, newPrice: number): boolean => {
  try {
    const priceData = localStorage.getItem(STORAGE_KEYS.PRICES);
    const priceMap: Record<string, number> = priceData ? JSON.parse(priceData) : {};
    priceMap[slotId] = newPrice;
    localStorage.setItem(STORAGE_KEYS.PRICES, JSON.stringify(priceMap));
    logAction('admin', 'UPDATE_PRICE', `Updated ${slotId} to RM${newPrice}`);
    return true;
  } catch (e) {
    return false;
  }
};

// --- SLOT CONFIGURATION (PENTING UNTUK INVENTORY.TX) ---
export const updateSlotConfig = (slotId: string, updates: { name?: string, price?: number, currentStock?: number }): boolean => {
  try {
    if (updates.price !== undefined) updateProductPrice(slotId, updates.price);

    if (updates.currentStock !== undefined) {
       const stockData = localStorage.getItem(STORAGE_KEYS.STOCK_COUNTS);
       const stockMap: Record<string, number> = stockData ? JSON.parse(stockData) : {};
       stockMap[slotId] = updates.currentStock;
       localStorage.setItem(STORAGE_KEYS.STOCK_COUNTS, JSON.stringify(stockMap));
       logAction('admin', 'UPDATE_STOCK', `Updated ${slotId} stock to ${updates.currentStock}`);
    }

    if (updates.name !== undefined) {
       const nameData = localStorage.getItem(STORAGE_KEYS.NAMES);
       const nameMap: Record<string, string> = nameData ? JSON.parse(nameData) : {};
       nameMap[slotId] = updates.name;
       localStorage.setItem(STORAGE_KEYS.NAMES, JSON.stringify(nameMap));
       logAction('admin', 'UPDATE_NAME', `Updated ${slotId} name to ${updates.name}`);
    }
    notify(`Slot ${slotId} updated.`, 'success');
    return true;
  } catch (e) {
    return false;
  }
};

export const getTransactions = (): Transaction[] => {
  const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
  return data ? JSON.parse(data) : [];
};

export const saveTransaction = (tx: Transaction) => {
    const transactions = getTransactions();
    transactions.unshift(tx);
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
}

// --- NEW FEATURE: MERGE BULK TRANSACTIONS (FOR TCN SYNC) ---
// This ensures we can sync 1000s of transactions from cloud without losing local transaction history
export const mergeTransactions = (newTxs: Transaction[]) => {
  const currentTxs = getTransactions();
  
  // Create Set of existing RefNos to prevent duplicates
  const existingRefs = new Set(currentTxs.map(t => t.refNo));
  
  let addedCount = 0;
  
  // Only add if RefNo doesn't exist
  newTxs.forEach(tx => {
    if (!existingRefs.has(tx.refNo)) {
      currentTxs.push(tx);
      addedCount++;
    }
  });

  // Sort by date desc
  currentTxs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(currentTxs));
  console.log(`Merged ${addedCount} new transactions from Cloud.`);
  
  return addedCount;
};

// --- SMART RESET DB (UPDATE UTAMA) ---
// Memadam semua data MELAINKAN data TCN yang penting
export const resetDB = () => {
  logAction('admin', 'SYSTEM_RESET', 'Performing Smart Reset');
  
  // 1. Simpan data TCN
  const tcnMachines = localStorage.getItem(STORAGE_KEYS.MACHINES);
  const tcnSales = localStorage.getItem(STORAGE_KEYS.SALES_TODAY);
  const tcnTx = localStorage.getItem(STORAGE_KEYS.TX_RECENT);

  // 2. Padam Semua
  localStorage.clear();

  // 3. Pulihkan Data TCN
  if (tcnMachines) {
      localStorage.setItem(STORAGE_KEYS.MACHINES, tcnMachines);
  }
  if (tcnSales) {
      localStorage.setItem(STORAGE_KEYS.SALES_TODAY, tcnSales);
  }
  if (tcnTx) {
      localStorage.setItem(STORAGE_KEYS.TX_RECENT, tcnTx);
  }

  // 4. Initialize semula data asas
  initDB(); 
  
  notify("System Reset Successful (TCN Data Preserved).", "success");
  window.location.reload();
};

export const processBackendCallback = async (data: IPay88CallbackData): Promise<{ success: boolean; message: string }> => {
  // Verify Signature
  const sourceString = constructResponseSignature(
    VM_CONFIG.MERCHANT.KEY,
    data.merchantCode,
    data.paymentId,
    data.refNo,
    data.amount,
    data.currency,
    data.status
  );

  const calculatedSignature = await generateSignature(sourceString, VM_CONFIG.MERCHANT.KEY);
  
  if (calculatedSignature !== data.signature) {
    return { success: false, message: "Signature verification failed" };
  }

  if (data.status !== "1") {
    return { success: false, message: "Payment failed status" };
  }

  // Deduct Stock
  const parts = data.refNo.split('-');
  const slotId = parts.find(p => p.startsWith('SLOT'));
  const productConfig = VM_CONFIG.SLOTS.find(s => s.id === slotId);

  if (!slotId || !productConfig) {
    return { success: false, message: `Invalid Slot ID: ${slotId}` };
  }

  const stockData = localStorage.getItem(STORAGE_KEYS.STOCK_COUNTS);
  const stockMap: Record<string, number> = stockData ? JSON.parse(stockData) : {};
  const currentStock = stockMap[slotId] !== undefined ? stockMap[slotId] : productConfig.initialStock;

  if (currentStock <= 0) {
    return { success: false, message: "Out of stock" };
  }

  stockMap[slotId] = currentStock - 1;
  localStorage.setItem(STORAGE_KEYS.STOCK_COUNTS, JSON.stringify(stockMap));

  // Record Tx
  const newTransaction: Transaction = {
    id: crypto.randomUUID(),
    refNo: data.refNo,
    paymentId: data.paymentId,
    productName: productConfig.name,
    slotId: productConfig.id,
    amount: parseFloat(data.amount),
    currency: data.currency,
    status: 'SUCCESS',
    paymentMethod: 'E-Wallet',
    timestamp: new Date().toISOString()
  };

  saveTransaction(newTransaction);

  return { success: true, message: "RECEIVEOK" };
};