import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { signInWithGoogle, db } from '../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Activity, LayoutGrid, ShieldCheck, Clock, Terminal, Zap, Shield, User } from 'lucide-react';
import { motion } from 'motion/react';

import { logAction } from '../lib/audit';

export default function Login() {
  const { user, loading } = useAuth();
  const [error, setError] = useState('');
  const [targetRole, setTargetRole] = useState<'patient' | 'doctor' | 'admin'>('patient');

  if (loading) return <div className="h-screen bg-main-bg flex items-center justify-center"><Activity className="animate-spin text-blue-500" /></div>;
  if (user) return <Navigate to="/" />;

  const handleLogin = async () => {
    try {
      const result = await signInWithGoogle();
      const user = result.user;

      const profileRef = doc(db, 'users', user.uid);
      const profileSnap = await getDoc(profileRef);

      if (!profileSnap.exists()) {
        await setDoc(profileRef, {
          userId: user.uid,
          name: user.displayName || 'Anonymous Node',
          email: user.email,
          role: targetRole,
          createdAt: new Date().toISOString()
        });
        await logAction(user.uid, user.displayName || user.email || 'Unknown', 'REGISTER_SUCCESS', 'Auth', `New user registered with role: ${targetRole}`);
        window.location.reload();
      } else {
        await logAction(user.uid, result.user.displayName || result.user.email || 'Unknown', 'LOGIN_SUCCESS', 'Auth', `User logged in with role: ${profileSnap.data().role}`);
      }
    } catch (err) {
      setError('Neural link failed. Verify credentials and retry.');
    }
  };

  return (
    <div className="min-h-screen bg-main-bg flex flex-col md:flex-row font-sans text-text-main overflow-hidden">
      {/* Left Side: Technical Branding */}
      <div className="flex-1 bg-white p-8 md:p-16 flex flex-col justify-between relative">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-100 rounded-full blur-[120px] -mr-40 -mt-40"></div>
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-slate-100 rounded-full blur-[100px] -ml-20 -mb-20"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-16">
            <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100 shadow-sm">
              <Activity className="w-8 h-8 text-blue-600" />
            </div>
            <span className="font-black text-3xl tracking-tighter uppercase italic font-serif text-slate-900">OlaSun <span className="text-blue-600/30 font-normal">Health</span></span>
          </div>

          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-6xl md:text-8xl font-black leading-tight mb-12 uppercase tracking-tighter text-slate-900"
          >
            Clinical <br />
            <span className="text-blue-600 italic font-serif">OlaSun.</span>
          </motion.h1>
          
          <div className="space-y-10 max-w-lg">
            <Feature icon={<Clock className="text-blue-500" />} title="Precision Scheduling" desc="Live queue management and clinical throughput coordination." />
            <Feature icon={<LayoutGrid className="text-blue-500" />} title="Unified Health Records" desc="Secure, instantaneous access to comprehensive patient medical history." />
            <Feature icon={<ShieldCheck className="text-blue-500" />} title="Intelligent Triage" desc="Advanced diagnostic support powered by clinical AI intelligence." />
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between opacity-40">
          <p className="text-[10px] font-mono uppercase tracking-widest">© 2026 OlaSun Health Systems</p>
          <div className="flex gap-4">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse delay-75"></div>
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse delay-150"></div>
          </div>
        </div>
      </div>

      {/* Right Side: Authentication */}
      <div className="w-full md:w-[550px] bg-slate-50 p-8 md:p-16 flex flex-col justify-center border-l border-slate-200">
        <div className="w-full max-w-sm mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-lg text-[10px] font-black text-blue-600 uppercase tracking-widest mb-6 border border-blue-100">
            <Shield size={12} />
            SECURE_PORTAL
          </div>
          
          <h2 className="text-4xl font-black text-slate-900 mb-3 uppercase tracking-tighter">Welcome</h2>
          <p className="text-slate-600 mb-10 italic">Please select your clinical role to begin the session.</p>

          <div className="space-y-4 mb-10 p-6 bg-white rounded-3xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Target Role</p>
            <div className="grid grid-cols-3 gap-3">
              <RoleButton active={targetRole === 'patient'} onClick={() => setTargetRole('patient')} icon={<User size={14} />} label="Patient" />
              <RoleButton active={targetRole === 'doctor'} onClick={() => setTargetRole('doctor')} icon={<Activity size={14} />} label="Doctor" />
              <RoleButton active={targetRole === 'admin'} onClick={() => setTargetRole('admin')} icon={<Shield size={14} />} label="Admin" />
            </div>
          </div>

          {error && (
            <div className="bg-rose-50 text-rose-600 p-4 rounded-2xl text-xs mb-8 font-black uppercase tracking-widest border border-rose-100 flex items-center gap-3">
              <Activity size={14} className="animate-pulse" />
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-4 px-8 py-5 bg-blue-600 rounded-2xl hover:bg-blue-700 transition-all duration-300 font-black text-xs uppercase tracking-[0.2em] text-white active:scale-95 shadow-lg shadow-blue-500/20"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
            Sign in with Google
          </button>

          <div className="mt-16 pt-10 border-t border-border-accent/50">
            <p className="text-[9px] text-text-muted text-center uppercase tracking-[0.3em] font-black mb-6">Protocol Verification</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-inner-bg rounded-2xl border border-border-accent text-center group hover:border-blue-500/30 transition-all">
                <span className="block text-text-main font-black text-xl leading-none font-mono">256-Bit</span>
                <span className="text-[8px] text-text-dim uppercase font-black tracking-widest mt-2 block">GCM_CIPHER</span>
              </div>
              <div className="p-4 bg-inner-bg rounded-2xl border border-border-accent text-center group hover:border-emerald-500/30 transition-all">
                <span className="block text-emerald-500 font-black text-xl leading-none font-mono">SECURE</span>
                <span className="text-[8px] text-text-dim uppercase font-black tracking-widest mt-2 block">HIPAA_CORE</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, title, desc }: any) {
  return (
    <div className="flex items-start gap-5 group">
      <div className="mt-1 p-3 bg-blue-50 rounded-xl border border-blue-100 group-hover:border-blue-300 transition-all">{icon}</div>
      <div>
        <h3 className="font-black text-xs uppercase tracking-widest text-slate-900 group-hover:text-blue-600 transition-all">{title}</h3>
        <p className="text-slate-600 text-[11px] leading-relaxed mt-1 italic">{desc}</p>
      </div>
    </div>
  );
}

function RoleButton({ active, onClick, icon, label }: any) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
        active 
          ? 'bg-blue-600 border-blue-600 text-white shadow-md' 
          : 'bg-white border-slate-200 text-slate-400 hover:border-slate-400'
      }`}
    >
      {icon}
      <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}
