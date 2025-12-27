
import React, { useState } from 'react';
import { getUsers } from '../services/db';
import { User, Lock, QrCode, Smartphone, Globe } from 'lucide-react';

interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [loginMethod, setLoginMethod] = useState<'password' | 'qr'>('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const users = getUsers();
      const matched = users.find(u => u.username === username && u.password === password && u.isActive);
      // Allow demo fallback to first active user if username left empty
      if (matched || username === '') {
        setTimeout(() => { setIsLoading(false); onLogin(); }, 500);
      } else {
        setIsLoading(false);
        alert('Invalid credentials.');
      }
    } catch (e: any) {
      setIsLoading(false);
      alert('Login failed: ' + (e?.message || 'Unknown error'));
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 relative flex items-center justify-center font-sans overflow-hidden">
      
      {/* Background Effect (Tech Matrix Style) */}
      <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/80 to-slate-900/90"></div>

      {/* Top Bar (Language & Title) */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-center text-white z-10">
         <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-500 rounded flex items-center justify-center font-bold">RB</div>
            <span className="text-xl font-bold tracking-wide">VMSRBE <span className="font-light opacity-80">Cloud System V2.0</span></span>
         </div>
         <div className="flex items-center gap-4 text-sm opacity-80 hover:opacity-100 cursor-pointer transition-opacity">
            <Globe size={16} />
            <span>English / Bahasa / 中文</span>
         </div>
      </div>

      {/* Main Card */}
      <div className="bg-white w-[900px] h-[500px] rounded-2xl shadow-2xl flex z-10 overflow-hidden animate-in fade-in zoom-in duration-500">
        
        {/* Left Side: Illustration */}
        <div className="w-1/2 bg-blue-50 p-10 flex flex-col justify-center items-center text-center relative overflow-hidden">
           <div className="relative z-10">
             <h2 className="text-3xl font-bold text-blue-900 mb-2">JOIN VMSRBE</h2>
             <p className="text-blue-600 font-medium text-lg mb-6">Smart Vending Management</p>
             <div className="bg-white p-4 rounded-xl shadow-lg inline-block">
                <Smartphone size={80} className="text-blue-500 mx-auto" />
             </div>
             <p className="text-slate-500 text-xs mt-6 max-w-xs mx-auto">
               Access your fleet, monitor sales, and manage inventory in real-time with our LHDN-compliant platform.
             </p>
           </div>
           
           {/* Decor Circles */}
           <div className="absolute -top-20 -left-20 w-64 h-64 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
           <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-orange-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        </div>

        {/* Right Side: Login Form */}
        <div className="w-1/2 p-10 flex flex-col">
           
           {/* Tabs */}
           <div className="flex border-b border-slate-200 mb-8">
              <button 
                onClick={() => setLoginMethod('password')}
                className={`pb-3 text-sm font-bold px-4 transition-colors ${loginMethod === 'password' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Log in with password
              </button>
              <button 
                onClick={() => setLoginMethod('qr')}
                className={`pb-3 text-sm font-bold px-4 transition-colors ${loginMethod === 'qr' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Scan QR Code
              </button>
           </div>

           {loginMethod === 'password' ? (
             <form onSubmit={handleLogin} className="flex-1 flex flex-col justify-center space-y-5">
                <div className="space-y-1">
                   <div className="relative">
                     <User className="absolute left-3 top-3 text-slate-400" size={20} />
                     <input 
                       type="text" 
                       placeholder="User name" 
                       value={username}
                       onChange={(e) => setUsername(e.target.value)}
                       className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-medium"
                     />
                   </div>
                </div>

                <div className="space-y-1">
                   <div className="relative">
                     <Lock className="absolute left-3 top-3 text-slate-400" size={20} />
                     <input 
                       type="password" 
                       placeholder="Password" 
                       value={password}
                       onChange={(e) => setPassword(e.target.value)}
                       className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-medium"
                     />
                   </div>
                </div>

                <div className="flex justify-between items-center text-xs text-slate-500">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500" />
                    Remember me
                  </label>
                  <a href="#" className="hover:text-blue-600">Forgot Password?</a>
                </div>

                <button 
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-lg shadow-md hover:shadow-lg transition-all flex justify-center items-center gap-2"
                >
                  {isLoading ? (
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : 'Login'}
                </button>
             </form>
           ) : (
             <div className="flex-1 flex flex-col justify-center items-center text-center animate-in fade-in slide-in-from-right-4">
                <div className="bg-white p-2 border border-slate-200 rounded-xl shadow-inner mb-4">
                   <QrCode size={150} className="text-slate-800" />
                </div>
                <p className="text-sm font-bold text-slate-700">Scan via WeChat / VMSRBE App</p>
                <p className="text-xs text-slate-400 mt-2 max-w-[200px]">
                  Open the mobile app and scan this code to login instantly.
                </p>
             </div>
           )}

        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 text-slate-400 text-xs text-center w-full">
         <p>Technical support | Contact Info | Quick access to iCloud system</p>
         <p className="mt-1 opacity-50">&copy; 2024 Rozita Bina Enterprise. All rights reserved.</p>
      </div>

    </div>
  );
};

export default Login;
