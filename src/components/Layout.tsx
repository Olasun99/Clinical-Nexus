import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Menu, 
  X, 
  LayoutDashboard, 
  Stethoscope, 
  Calendar, 
  FileText, 
  Map, 
  LogOut,
  Bell,
  User as UserIcon,
  Activity,
  ClipboardList,
  DollarSign,
  Shield,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { logout } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import WalChat from './WalChat';
import NotificationBell from './NotificationBell';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { profile, isDoctor, isAdmin, isPatient } = useAuth();
  const [isOpen, setIsOpen] = React.useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Admin Portal', path: '/admin', icon: Shield, adminOnly: true },
    { name: 'Doctor Workspace', path: '/records', icon: Stethoscope, isDoctorOnly: true },
    { name: 'AI Triage', path: '/triage', icon: Stethoscope, patientOnly: true },
    { name: 'Bio-Intake', path: '/intake', icon: ClipboardList, patientOnly: true },
    { name: 'Appointments', path: '/appointments', icon: Calendar },
    { name: 'Financials', path: '/financials', icon: DollarSign },
    { name: 'Medical Records', path: '/records', icon: FileText },
    { name: 'Hospital Map', path: '/navigation', icon: Map },
    { name: 'EMERGENCY SOS', path: '/emergency', icon: ShieldAlert, isEmergency: true },
  ];

  const filteredNavItems = navItems.filter(item => {
    if (item.adminOnly && !isAdmin) return false;
    if ((item as any).isDoctorOnly && !isDoctor && !isAdmin) return false;
    if (item.patientOnly && !isPatient && !isAdmin) return false;
    return true;
  });

  const theme = {
    color: isAdmin ? 'purple' : isDoctor ? 'emerald' : 'blue',
    role: isAdmin ? 'Admin Root' : isDoctor ? 'Practitioner' : 'Patient',
    bg: isAdmin ? 'bg-purple-600' : isDoctor ? 'bg-emerald-600' : 'bg-blue-600',
    text: isAdmin ? 'text-purple-600' : isDoctor ? 'text-emerald-600' : 'text-blue-600',
    border: isAdmin ? 'border-purple-600/20' : isDoctor ? 'border-emerald-600/20' : 'border-blue-600/20',
    lightBg: isAdmin ? 'bg-purple-500/10' : isDoctor ? 'bg-emerald-500/10' : 'bg-blue-500/10',
    shadow: isAdmin ? 'shadow-purple-500/20' : isDoctor ? 'shadow-emerald-500/20' : 'shadow-blue-500/20',
  };

  return (
    <div className={`min-h-screen bg-main-bg flex flex-col md:flex-row font-sans text-text-main`}>
      {/* Mobile Header */}
      <header className={`md:hidden bg-sidebar-bg border-b border-border-accent px-4 py-3 flex items-center justify-between sticky top-0 z-50`}>
        <div className="flex items-center gap-2">
          <Activity className={`${theme.text} w-6 h-6`} />
          <span className="font-bold text-xl tracking-tight uppercase tracking-widest text-text-main">OlaSun</span>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button onClick={() => setIsOpen(!isOpen)} className="p-2 text-text-dim">
            {isOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-sidebar-bg border-r border-border-accent h-screen sticky top-0 shadow-[1px_0_10px_rgba(0,0,0,0.02)]">
        <div className="p-8 flex items-center gap-3">
          <div className={`p-2 ${theme.lightBg} rounded-xl border ${theme.border}`}>
            <Activity className={`${theme.text} w-6 h-6`} />
          </div>
          <span className="font-black text-xl tracking-tighter uppercase tracking-[0.05em] italic font-serif text-text-main">OlaSun</span>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          {filteredNavItems.map((item) => (
            <Link
              key={`${item.name}-${item.path}`}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${
                location.pathname === item.path
                  ? item.isEmergency 
                    ? 'bg-rose-600 text-white shadow-lg' 
                    : `${theme.bg} text-white ${theme.shadow} border border-transparent`
                  : item.isEmergency
                    ? 'bg-rose-600/10 text-rose-600 hover:bg-rose-600 hover:text-white border border-rose-500/20'
                    : 'text-text-dim hover:bg-inner-bg hover:text-text-main border border-transparent'
              } ${item.isEmergency ? 'animate-pulse' : ''}`}
            >
              <item.icon size={18} className={`transition-transform duration-300 ${location.pathname === item.path ? 'scale-110 text-white' : `group-hover:scale-110 group-hover:${theme.text}`}`} strokeWidth={location.pathname === item.path ? 2.5 : 2} />
              <span className={`font-bold text-xs uppercase tracking-widest ${location.pathname === item.path ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}>{item.name}</span>
            </Link>
          ))}
        </nav>

        <div className="p-6 border-t border-border-accent">
          <div className={`flex items-center gap-4 px-4 py-4 mb-6 bg-inner-bg rounded-2xl border border-border-accent group`}>
            <div className={`w-10 h-10 rounded-xl ${theme.bg} text-white flex items-center justify-center font-black shadow-sm transition-transform group-hover:scale-110`}>
              {profile?.name?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[10px] truncate uppercase tracking-widest text-text-main">{profile?.name}</p>
              <p className={`text-[9px] ${theme.text} uppercase font-black tracking-widest mt-0.5 opacity-60`}>{theme.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 text-text-dim hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest border border-transparent hover:border-rose-200"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: -200 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -200 }}
            className="md:hidden fixed inset-0 z-40 bg-sidebar-bg pt-16"
          >
            <nav className="p-6 space-y-4">
              {filteredNavItems.map((item) => (
                <Link
                  key={`mobile-${item.name}-${item.path}`}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-4 p-4 rounded-2xl font-black uppercase tracking-widest text-xs border ${
                    location.pathname === item.path 
                      ? `${theme.lightBg} ${theme.text} ${theme.border}` 
                      : 'text-text-dim border-transparent'
                  }`}
                >
                  <item.icon size={20} />
                  <span>{item.name}</span>
                </Link>
              ))}
              <hr className="my-8 border-border-accent opacity-50" />
                <button
                onClick={handleLogout}
                className="w-full flex items-center gap-4 p-4 text-rose-600 font-black uppercase tracking-widest text-xs"
              >
                <LogOut size={20} />
                <span>Logout</span>
              </button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 min-w-0 relative">
        {/* Desktop Header */}
        <header className="hidden md:flex h-20 items-center justify-end px-16 border-b border-border-accent bg-sidebar-bg/50 backdrop-blur-md sticky top-0 z-40">
           <NotificationBell />
        </header>

        <div className="p-6 md:p-10 lg:p-16 max-w-7xl mx-auto w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -10 }}
              transition={{ duration: 0.3, ease: 'circOut' }}
            >
              {children}
            </motion.div>
          </AnimatePresence>

          {/* Global Trust Footer */}
          <footer className="mt-24 pt-12 border-t border-border-accent/10 grid grid-cols-1 md:grid-cols-3 gap-12 opacity-40 hover:opacity-100 transition-opacity duration-700">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Activity size={16} className={theme.text} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] font-serif italic">OlaSun Clinical Nexus</span>
              </div>
              <p className="text-[10px] font-medium leading-relaxed uppercase tracking-widest text-text-dim">
                High-surety diagnostic infrastructure. <br />
                Registry Hash: L3-SYN-2026-NEXUS
              </p>
            </div>
            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-text-main">Legitimacy & Security</h4>
              <p className="text-[9px] font-medium leading-relaxed uppercase tracking-widest text-text-dim">
                Fully compliant with NDPR (Nigeria) and GDPR standards. <br />
                All biometric metadata is encrypted at source.
              </p>
            </div>
            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-text-main">Emergency Protocol</h4>
              <p className="text-[9px] font-medium leading-relaxed uppercase tracking-widest text-text-dim italic outline-none">
                If life-critical event detected: <br />
                Call +234 000 000 0000 or Escalate via SOS link.
              </p>
            </div>
          </footer>
        </div>

        {/* Persistent Emergency Access for Patients */}
        {isPatient && location.pathname !== '/emergency' && (
          <motion.div 
            initial={{ scale: 0, x: 100 }}
            animate={{ scale: 1, x: 0 }}
            className="fixed bottom-8 right-8 z-50 md:hidden"
          >
            <Link to="/emergency" className="w-16 h-16 bg-rose-600 rounded-full flex items-center justify-center text-white shadow-[0_0_30px_rgba(225,29,72,0.5)] active:scale-90 transition-all border-4 border-white">
              <ShieldAlert size={28} className="animate-pulse" />
            </Link>
          </motion.div>
        )}

        <WalChat />
      </main>
    </div>
  );
}
