
import React, { useState, useEffect } from 'react';
import { getUsers, saveUser, deleteUser, getAuditLogs, notify, logAction } from '../services/db';
import { User, AuditLog, UserRole } from '../types';
import { 
  Users, Shield, FileText, Lock, Plus, Edit2, Trash2, 
  RefreshCw, Search, CheckCircle, XCircle, Key, History 
} from 'lucide-react';

export default function SuperSettings() {
  const [activeTab, setActiveTab] = useState<'users' | 'audit' | 'system'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  
  // User Modal State
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<User>>({});
  const [passwordInput, setPasswordInput] = useState('');

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
    setUsers(getUsers());
    setLogs(getAuditLogs());
  };

  // --- USER MANAGEMENT HANDLERS ---
  const handleAddUser = () => {
    setEditingUser({
      role: 'MANAGER',
      isActive: true,
      id: ''
    });
    setPasswordInput('');
    setIsUserModalOpen(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setPasswordInput(user.password); // In real app, leave empty placeholder
    setIsUserModalOpen(true);
  };

  const handleDeleteUser = (id: string) => {
    if (confirm("Are you sure you want to delete this user?")) {
      deleteUser(id);
      refreshData();
      notify("User deleted successfully", 'success');
    }
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser.username || !editingUser.fullName) {
      notify("Please fill in all fields", 'error');
      return;
    }

    const newUser: User = {
      id: editingUser.id || `U-${Date.now()}`,
      username: editingUser.username,
      password: passwordInput,
      fullName: editingUser.fullName,
      role: editingUser.role as UserRole,
      isActive: editingUser.isActive || false,
      lastLogin: editingUser.lastLogin
    };

    saveUser(newUser);
    refreshData();
    setIsUserModalOpen(false);
    notify(editingUser.id ? "User updated" : "User created", 'success');
  };

  // --- RENDER HELPERS ---
  const RoleBadge = ({ role }: { role: string }) => {
    const colors = {
      'SUPER_ADMIN': 'bg-purple-100 text-purple-700 border-purple-200',
      'MANAGER': 'bg-blue-100 text-blue-700 border-blue-200',
      'TECHNICIAN': 'bg-orange-100 text-orange-700 border-orange-200'
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-bold border ${colors[role as keyof typeof colors] || 'bg-slate-100'}`}>
        {role.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* HEADER */}
      <div className="bg-slate-900 text-white p-6 rounded-xl shadow-lg flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Shield className="text-emerald-400" /> Super Settings
          </h2>
          <p className="text-slate-400 text-sm mt-1">Advanced Administration & Security Controls</p>
        </div>
        <div className="flex bg-slate-800 p-1 rounded-lg">
          <button 
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            <Users size={16} /> Users
          </button>
          <button 
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'audit' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            <History size={16} /> Audit Log
          </button>
          <button 
            onClick={() => setActiveTab('system')}
            className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'system' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            <Lock size={16} /> System
          </button>
        </div>
      </div>

      {/* --- TAB: USERS --- */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
             <div className="relative">
               <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
               <input type="text" placeholder="Search users..." className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-64" />
             </div>
             <button onClick={handleAddUser} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-colors">
               <Plus size={16} /> Add User
             </button>
          </div>
          
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold uppercase">
              <tr>
                <th className="p-4">User</th>
                <th className="p-4">Role</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4">Last Login</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <div className="font-bold text-slate-800">{u.fullName}</div>
                    <div className="text-xs text-slate-500">@{u.username}</div>
                  </td>
                  <td className="p-4"><RoleBadge role={u.role} /></td>
                  <td className="p-4 text-center">
                    {u.isActive ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-xs bg-emerald-50 px-2 py-1 rounded-full"><CheckCircle size={12}/> Active</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-600 font-bold text-xs bg-rose-50 px-2 py-1 rounded-full"><XCircle size={12}/> Inactive</span>
                    )}
                  </td>
                  <td className="p-4 text-slate-500 font-mono text-xs">
                    {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never'}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                       <button onClick={() => handleEditUser(u)} className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit"><Edit2 size={16} /></button>
                       <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-rose-600 hover:bg-rose-50 rounded transition-colors" title="Delete"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* --- TAB: AUDIT LOGS --- */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
             <h3 className="font-bold text-slate-700 flex items-center gap-2"><FileText size={18}/> System Activity</h3>
             <button onClick={refreshData} className="text-slate-500 hover:text-indigo-600"><RefreshCw size={18}/></button>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold sticky top-0">
                <tr>
                  <th className="p-4 w-48">Timestamp</th>
                  <th className="p-4 w-32">Actor</th>
                  <th className="p-4 w-40">Action</th>
                  <th className="p-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-xs">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="p-4 text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="p-4 font-bold text-indigo-600">{log.actor}</td>
                    <td className="p-4 font-bold text-slate-700">{log.action}</td>
                    <td className="p-4 text-slate-600">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- TAB: SYSTEM --- */}
      {activeTab === 'system' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Lock size={20} className="text-rose-500"/> Security Policies</h3>
              <div className="space-y-4">
                 <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                    <div>
                       <div className="font-bold text-sm text-slate-800">Enforce 2FA</div>
                       <div className="text-xs text-slate-500">Require Two-Factor Auth for Admins</div>
                    </div>
                    <div className="w-12 h-6 bg-slate-200 rounded-full relative cursor-pointer"><div className="w-4 h-4 bg-white rounded-full absolute top-1 left-1 shadow-sm"></div></div>
                 </div>
                 <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                    <div>
                       <div className="font-bold text-sm text-slate-800">Session Timeout</div>
                       <div className="text-xs text-slate-500">Auto-logout after 15 mins inactivity</div>
                    </div>
                    <div className="w-12 h-6 bg-emerald-500 rounded-full relative cursor-pointer"><div className="w-4 h-4 bg-white rounded-full absolute top-1 right-1 shadow-sm"></div></div>
                 </div>
              </div>
           </div>

           <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><RefreshCw size={20} className="text-blue-500"/> System Maintenance</h3>
              <div className="space-y-4">
                 <button onClick={() => { if(confirm('Reset DB?')) window.location.reload(); }} className="w-full p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg font-bold text-sm hover:bg-rose-100 flex items-center justify-center gap-2">
                    <Trash2 size={16} /> Factory Reset Database
                 </button>
                 <button className="w-full p-3 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-bold text-sm hover:bg-blue-100 flex items-center justify-center gap-2">
                    <RefreshCw size={16} /> Clear Cache
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* --- USER MODAL --- */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
              <div className="bg-indigo-600 p-4 flex justify-between items-center text-white">
                 <h3 className="font-bold flex items-center gap-2"><Users size={18}/> {editingUser.id ? 'Edit User' : 'Add New User'}</h3>
                 <button onClick={() => setIsUserModalOpen(false)}><XCircle size={20} className="hover:text-rose-200"/></button>
              </div>
              <form onSubmit={handleSaveUser} className="p-6 space-y-4">
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                    <input required type="text" value={editingUser.fullName || ''} onChange={e => setEditingUser({...editingUser, fullName: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. Ahmad Albab" />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Username</label>
                    <input required type="text" value={editingUser.username || ''} onChange={e => setEditingUser({...editingUser, username: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. admin" />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-2">Password {editingUser.id && <span className="text-[10px] font-normal text-amber-500">(Leave blank to keep current)</span>}</label>
                    <div className="relative">
                       <Key size={14} className="absolute left-3 top-3 text-slate-400" />
                       <input type={editingUser.id ? "text" : "password"} value={passwordInput} onChange={e => setPasswordInput(e.target.value)} className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="******" />
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Role</label>
                       <select value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value as any})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                          <option value="SUPER_ADMIN">Super Admin</option>
                          <option value="MANAGER">Manager</option>
                          <option value="TECHNICIAN">Technician</option>
                       </select>
                    </div>
                    <div>
                       <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                       <select value={editingUser.isActive ? 'true' : 'false'} onChange={e => setEditingUser({...editingUser, isActive: e.target.value === 'true'})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                          <option value="true">Active</option>
                          <option value="false">Inactive</option>
                       </select>
                    </div>
                 </div>
                 <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg shadow-lg flex justify-center gap-2 mt-4">
                    {editingUser.id ? 'Update User' : 'Create User'}
                 </button>
              </form>
           </div>
        </div>
      )}

    </div>
  );
}
