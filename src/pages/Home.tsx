import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { 
  Calendar, 
  Clock, 
  Activity, 
  Users, 
  ChevronRight, 
  AlertCircle,
  PlusCircle,
  User,
  MapPin,
  Shield,
  FileText,
  Zap,
  Terminal,
  ClipboardList,
  Video,
  ShieldAlert,
  ArrowRight,
  Star
} from 'lucide-react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Appointment } from '../types';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { motion } from 'motion/react';
import { DEPARTMENTS } from '../constants';
import PatientOverview from '../components/PatientOverview';
import PatientPortalHub from '../components/PatientPortalHub';

export default function Home() {
  const { profile, isDoctor, isAdmin, isPatient } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [intakeCount, setIntakeCount] = useState(0);
  const [activeEmergencyCount, setActiveEmergencyCount] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const activeTab = isAdmin ? 'admin' : isDoctor ? 'doctor' : 'patient';
  const [viewOverride, setViewOverride] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;

    // 1. Fetch Appointments
    const appointmentsRef = collection(db, 'appointments');
    let q;
    
    if (isAdmin) {
      q = query(appointmentsRef, orderBy('dateTime', 'asc'), limit(10));
    } else if (isDoctor) {
      q = query(appointmentsRef, where('doctorId', '==', profile.userId), orderBy('dateTime', 'asc'), limit(10));
    } else {
      q = query(appointmentsRef, where('patientId', '==', profile.userId), orderBy('dateTime', 'asc'), limit(10));
    }

    const unsubscribeAppointments = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
      setAppointments(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'appointments');
    });

    // 2. Staff Specific Feeds
    let unsubscribeEmergencies = () => {};
    let unsubscribeIntake = () => {};

    if (isDoctor || isAdmin) {
      const qe = query(collection(db, 'emergencySessions'), where('status', '==', 'active'));
      unsubscribeEmergencies = onSnapshot(qe, (snapshot) => {
        setActiveEmergencyCount(snapshot.size);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'emergencySessions');
      });

      const intakeRef = collection(db, 'intakeForms');
      const qi = query(intakeRef, where('status', '==', 'pending_review'), limit(10));
      unsubscribeIntake = onSnapshot(qi, (snapshot) => {
        setIntakeCount(snapshot.size);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'intakeForms');
      });
    }

    return () => {
      unsubscribeAppointments();
      unsubscribeEmergencies();
      unsubscribeIntake();
    };
  }, [profile, isDoctor, isAdmin]);

  if (loading) return (
    <div className="h-[60vh] flex flex-col items-center justify-center gap-4 text-text-dim uppercase tracking-widest text-[10px] font-black">
      <Terminal className="animate-pulse" />
      Syncing Clinical Hub...
    </div>
  );

  const currentView = viewOverride || activeTab;

  return (
    <div className={`space-y-8 pb-20 theme-${currentView}`}>
      {/* Role Switcher for SuperAdmin */}
      {profile?.email === 'sunmonuolawaleemmanuel@gmail.com' && (
        <div className="flex items-center gap-2 p-1 bg-inner-bg border border-border-accent rounded-xl w-fit mx-auto scale-90">
          {['admin', 'doctor', 'patient'].map((role) => (
            <button
              key={role}
              onClick={() => setViewOverride(role)}
              className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                currentView === role 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                  : 'text-text-dim hover:text-text-main'
              }`}
            >
              {role} portal
            </button>
          ))}
        </div>
      )}

      {/* Emergency Alert for Staff */}
      {(isDoctor || isAdmin) && activeEmergencyCount > 0 && currentView !== 'patient' && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-rose-600 p-6 rounded-[32px] flex items-center justify-between shadow-[0_0_50px_rgba(225,29,72,0.3)] animate-pulse"
        >
          <div className="flex items-center gap-6">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-white">
              <ShieldAlert size={28} />
            </div>
            <div>
              <h3 className="text-xl font-black text-white italic font-serif uppercase tracking-tighter leading-none">Critical Signal Detected</h3>
              <p className="text-rose-100 text-[10px] font-black uppercase tracking-widest mt-1 opacity-80">{activeEmergencyCount} Active SOS Link{activeEmergencyCount > 1 ? 's' : ''} Require Immediate Review</p>
            </div>
          </div>
          <Link to="/emergency" className="px-8 py-3 bg-white text-rose-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all shadow-xl">
            Join Nexus
          </Link>
        </motion.div>
      )}

      {/* Hero Section: Trust-First Design */}
      <div className="relative pt-12 pb-24 overflow-hidden">
        {/* Abstract Bio-Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-blue-500/5 rounded-[100%] blur-[120px] pointer-events-none -translate-y-1/2"></div>
        
        <div className="relative z-10 text-center space-y-12 max-w-4xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="inline-flex items-center gap-3 px-4 py-1.5 bg-blue-500/5 border border-blue-500/20 rounded-full text-[10px] font-black uppercase tracking-[0.3em] text-blue-600">
              <Shield size={12} className="animate-pulse" />
              Secure Bio-Auth Active // L3 Verification
            </div>
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-text-main uppercase leading-[0.85] italic font-serif">
              What do you <br />
              <span className="text-blue-600">need today?</span>
            </h1>
            <p className="text-text-dim text-lg md:text-xl font-medium italic opacity-70 max-w-2xl mx-auto leading-relaxed">
              Experience zero-friction clinical care. Navigate our decentralized medical grid with AI-guided precision.
            </p>
          </motion.div>

          {/* Core Actions: Zero-Friction Flow */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-4">
            <HeroActionCard 
              icon={<Calendar size={24} />}
              title="Book Session"
              desc="Reserve clinical rotation in under 2 minutes."
              to="/appointments"
              color="bg-blue-600"
              delay={0.1}
            />
            <HeroActionCard 
              icon={<Activity size={24} />}
              title="Talk to Doctor"
              desc="Start AI-guided triage for instant routing."
              to="/triage"
              color="bg-emerald-600"
              delay={0.2}
            />
            <HeroActionCard 
              icon={<ShieldAlert size={24} />}
              title="Emergency SOS"
              desc="Critical escalation link for immediate help."
              to="/emergency?autoStart=true"
              color="bg-rose-600"
              delay={0.3}
            />
          </div>

          {/* Trust Markers */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex flex-wrap justify-center items-center gap-12 pt-8 border-t border-border-accent/10"
          >
            <TrustMarker label="Verified Specialists" value="40+" />
            <TrustMarker label="Average Wait Sync" value="< 5 mins" />
            <TrustMarker label="Active Care Links" value="12k+" />
            <TrustMarker label="Compliance" value="NDPR/GDPR" />
          </motion.div>
        </div>
      </div>

      {/* Role-Specific Dashboard Sections */}
      {isPatient && (
        <Link to="/emergency" className="group bg-rose-600 p-8 rounded-[40px] shadow-[0_0_50px_rgba(225,29,72,0.3)] border border-rose-400 relative overflow-hidden active:scale-[0.98] transition-all block">
          <div className="absolute top-0 right-0 p-8 opacity-20 text-white group-hover:scale-110 transition-transform">
            <ShieldAlert size={80} />
          </div>
          <div className="relative z-10 flex items-center gap-6">
            <div className="p-4 bg-white/20 rounded-2xl animate-pulse">
              <ShieldAlert className="text-white" size={32} />
            </div>
            <div>
              <h3 className="text-2xl md:text-3xl font-black text-white italic font-serif uppercase tracking-tighter leading-none">Emergency SOS Protocol</h3>
              <p className="text-rose-100 text-xs font-black uppercase tracking-widest mt-2 opacity-80">Instant Peer-to-Peer Clinical Escalation</p>
            </div>
            <ArrowRight className="text-white ml-auto group-hover:translate-x-2 transition-transform" size={24} />
          </div>
        </Link>
      )}

      {currentView === 'admin' && <AdminDashboard intakeCount={intakeCount} appointments={appointments} />}
      {currentView === 'doctor' && <DoctorDashboard intakeCount={intakeCount} appointments={appointments} />}
      {currentView === 'patient' && <PatientDashboard appointments={appointments} />}

      {/* Trust: Meet the Specialists */}
      {isPatient && (
        <div className="mt-20">
          <div className="flex items-center justify-between mb-8 px-4 md:px-0">
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-600 mb-2">Registry Verification</h3>
              <h2 className="text-3xl font-black tracking-tighter text-text-main italic font-serif uppercase">Meet the Specialists</h2>
            </div>
            <Link to="/navigation" className="text-[10px] font-black uppercase text-text-dim hover:text-blue-600 transition-colors tracking-widest hidden md:block">Full Directory Archive</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <SpecialistCard 
              name="Dr. Sarah Alabi" 
              role="Interventional Cardiologist" 
              creds="MBBS, FWACP (Cardio)" 
              stars="4.9"
              image="https://images.unsplash.com/photo-1594824476967-48c8b964273f?auto=format&fit=crop&q=80&w=200&h=200"
            />
            <SpecialistCard 
              name="Dr. Emeka Chen" 
              role="Neurological Surgeon" 
              creds="MD, FRCS (Neuro)" 
              stars="5.0"
              image="https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&q=80&w=200&h=200"
            />
            <SpecialistCard 
              name="Dr. Zainab Kola" 
              role="Consultant Pediatrician" 
              creds="MBBS, MPH" 
              stars="4.8"
              image="https://images.unsplash.com/photo-1559839734-2b71f1e59816?auto=format&fit=crop&q=80&w=200&h=200"
            />
            <SpecialistCard 
              name="Prof. David Obi" 
              role="Chief of Trauma" 
              creds="Ph.D, MD, FACS" 
              stars="5.0"
              image="https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=200&h=200"
            />
          </div>
        </div>
      )}

    </div>
  );
}

function AdminDashboard({ intakeCount, appointments }: any) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard icon={<Users size={18} className="text-purple-500" />} label="Network Nodes" value="1,284" trend="+12 Entry_Log" />
          <StatCard icon={<Activity size={18} className="text-emerald-500" />} iconBg="bg-emerald-500/10" label="Active Staff" value="42" trend="Sync_Nominal" />
          <StatCard icon={<ClipboardList size={18} className="text-rose-500" />} iconBg="bg-rose-500/10" label="Registry Backlog" value={intakeCount} trend="Awaiting_Root" />
        </div>

        <div className="bg-card-bg border border-border-accent rounded-[40px] overflow-hidden shadow-2xl">
          <div className="p-10 border-b border-border-accent flex items-center justify-between bg-white/[0.01]">
            <h3 className="text-2xl font-black text-text-main uppercase tracking-tighter italic font-serif">Global Instance Rotation</h3>
            <Link to="/appointments" className="text-[10px] font-black uppercase text-purple-500 tracking-[0.3em]">Full Log</Link>
          </div>
          <div className="divide-y divide-border-accent/30">
            {appointments.map((apt: any) => (
              <AppointmentItem key={apt.id} apt={apt} showPatient isDoctorView colorClass="text-purple-400" />
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-8">
        <div className="bg-[#f1f5f9] border border-purple-200 rounded-[40px] p-10 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-[0.05] text-purple-600">
             <Shield size={120} />
          </div>
          <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-purple-600 mb-8">System Health Sync</h3>
          <div className="space-y-6">
            <LoadIndicator label="Authentication Core" level={99} color="bg-purple-500" />
            <LoadIndicator label="Clinical Database" level={94} color="bg-blue-500" />
            <LoadIndicator label="AI Diagnostic Link" level={88} color="bg-emerald-500" />
          </div>
        </div>
        
        <div className="bg-card-bg rounded-[40px] p-10 border border-border-accent shadow-2xl">
          <h3 className="text-[10px] font-black text-text-dim mb-8 uppercase tracking-[0.3em]">Root Protocols</h3>
          <div className="space-y-4">
             <Link to="/admin" className="w-full py-5 bg-purple-600/10 hover:bg-purple-600/20 text-purple-400 border border-purple-500/20 rounded-2xl flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest transition-all">
                <Users size={14} />
                Registry Management
             </Link>
             <button className="w-full py-5 bg-white/5 hover:bg-white/10 text-text-muted hover:text-text-main border border-white/10 rounded-2xl flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest transition-all">
                <FileText size={14} />
                Generate Hash Audit
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DoctorDashboard({ intakeCount, appointments }: any) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-8">
        {intakeCount > 0 ? (
          <Link to="/records" className="bg-emerald-500/5 border border-emerald-500/20 rounded-[40px] p-10 flex items-center justify-between group hover:bg-emerald-500/10 transition-all shadow-2xl shadow-emerald-900/10 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl"></div>
            <div className="flex items-center gap-8 z-10">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-[28px] flex items-center justify-center text-emerald-500 border border-emerald-500/20 group-hover:scale-110 transition-transform">
                <ClipboardList size={40} />
              </div>
              <div>
                <h4 className="text-3xl font-black text-emerald-100 italic font-serif uppercase tracking-tighter">Diagnostic Queue</h4>
                <p className="text-xs text-text-dim uppercase tracking-widest mt-2">{intakeCount} biometric profiles awaiting clinical verification.</p>
              </div>
            </div>
            <div className="w-16 h-16 rounded-full border border-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500/20 transition-all">
              <ChevronRight className="text-emerald-500" />
            </div>
          </Link>
        ) : (
          <div className="bg-inner-bg border border-border-accent rounded-[40px] p-10 text-center italic opacity-40">
             <ClipboardList className="mx-auto mb-4" size={48} />
             <p className="text-xl font-serif">No diagnostic records awaiting sync.</p>
          </div>
        )}

        <div className="bg-card-bg border border-border-accent rounded-[40px] overflow-hidden shadow-2xl">
          <div className="p-10 border-b border-border-accent flex items-center justify-between bg-white/[0.01]">
            <h3 className="text-2xl font-black text-text-main uppercase tracking-tighter italic font-serif">Operational Timeline</h3>
            <span className="text-[10px] font-black uppercase text-emerald-500 tracking-widest px-3 py-1 bg-emerald-500/10 rounded-lg">Today // {format(new Date(), 'MMM dd')}</span>
          </div>
          <div className="divide-y divide-border-accent/30">
            {appointments.length > 0 ? appointments.map((apt: any) => (
              <AppointmentItem key={apt.id} apt={apt} showPatient isDoctorView colorClass="text-emerald-400" />
            )) : (
              <div className="p-24 text-center text-text-dim italic font-serif text-lg">No clinical sessions currently scheduled in rotation.</div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-8">
        <div className="bg-emerald-600 rounded-[40px] p-10 shadow-2xl shadow-emerald-900/30 text-white relative overflow-hidden group">
          <Activity size={160} className="absolute -right-12 -bottom-12 opacity-10 rotate-12 group-hover:scale-110 group-hover:rotate-6 transition-all duration-700" />
          <h4 className="text-[10px] font-black uppercase tracking-[0.4em] mb-8 opacity-60">Ops Capacity Hub</h4>
          <div className="space-y-6">
             <MetricRow label="Throughput Today" value="14" />
             <MetricRow label="Clinical Accuracy" value="99.2%" />
             <MetricRow label="Neural Latency" value="12ms" />
          </div>
          <button className="w-full mt-10 py-4 bg-white/10 hover:bg-white/20 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all border border-white/10">
             Optimise Cluster
          </button>
        </div>
        
        <div className="bg-card-bg border border-border-accent rounded-[40px] p-10 shadow-2xl">
           <h4 className="text-[10px] font-black uppercase tracking-[0.3em] mb-8 text-emerald-500">Clinical Protocol Links</h4>
           <div className="space-y-6">
              <Link to="/records" className="flex items-center gap-6 group">
                 <div className="w-12 h-12 bg-inner-bg rounded-2xl flex items-center justify-center text-text-dim group-hover:text-emerald-400 group-hover:bg-emerald-500/10 transition-all border border-border-accent"><FileText size={20} /></div>
                 <div>
                    <div className="text-sm font-black text-text-main group-hover:text-emerald-400 transition-colors uppercase tracking-tight italic font-serif">Patient Registry</div>
                    <div className="text-[10px] text-text-dim uppercase font-mono mt-1">Archive_Access_L3</div>
                 </div>
              </Link>
              <Link to="/navigation" className="flex items-center gap-6 group">
                 <div className="w-12 h-12 bg-inner-bg rounded-2xl flex items-center justify-center text-text-dim group-hover:text-amber-400 group-hover:bg-amber-500/10 transition-all border border-border-accent"><MapPin size={20} /></div>
                 <div>
                    <div className="text-sm font-black text-text-main group-hover:text-amber-400 transition-colors uppercase tracking-tight italic font-serif">Hospital Grid</div>
                    <div className="text-[10px] text-text-dim uppercase font-mono mt-1">Geo_Link_Enabled</div>
                 </div>
              </Link>
           </div>
        </div>
      </div>
    </div>
  );
}

function PatientDashboard({ appointments }: any) {
  return (
    <PatientPortalHub />
  );
}

function TrustMarker({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center group">
      <div className="text-2xl font-black text-text-main group-hover:text-blue-600 transition-colors uppercase italic font-serif leading-none tracking-tighter">{value}</div>
      <div className="text-[10px] font-black uppercase text-text-dim tracking-widest mt-2">{label}</div>
    </div>
  );
}

function HeroActionCard({ icon, title, desc, to, color, delay = 0 }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Link to={to} className="group block h-full p-8 bg-card-bg border border-border-accent rounded-[40px] shadow-sm hover:shadow-2xl hover:border-blue-500/30 transition-all text-left relative overflow-hidden active:scale-[0.98]">
        {/* Glow Hover */}
        <div className={`absolute top-0 right-0 w-32 h-32 ${color.replace('bg-', 'bg-')}/5 rounded-full blur-3xl group-hover:scale-150 transition-transform`}></div>
        
        <div className={`w-16 h-16 ${color} rounded-2xl flex items-center justify-center text-white mb-8 group-hover:scale-110 transition-transform shadow-lg ${color.replace('bg-', 'shadow-')}/20`}>
          {icon}
        </div>
        
        <div className="space-y-3 relative z-10">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-text-main uppercase tracking-tighter italic font-serif">{title}</h3>
            <ArrowRight size={18} className="text-text-dim group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
          </div>
          <p className="text-sm text-text-muted font-medium italic opacity-70 leading-relaxed">{desc}</p>
        </div>
      </Link>
    </motion.div>
  );
}

function AppointmentItem({ apt, showPatient = false, isDoctorView = false, colorClass = "text-blue-400" }: any) {
  return (
    <div className="p-8 hover:bg-slate-50/50 transition-all flex flex-col md:flex-row md:items-center gap-8 group relative overflow-hidden">
      {/* Priority Indicator */}
      {isDoctorView && (
        <div className={`absolute top-0 left-0 w-1.5 h-full ${
          apt.priority === 'high' ? 'bg-rose-500' : 
          apt.priority === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
        }`} />
      )}
      
      <div className={`w-16 h-16 rounded-2xl bg-inner-bg border border-border-accent flex flex-col items-center justify-center text-text-dim group-hover:border-blue-500/30 transition-all font-mono shrink-0 shadow-sm`}>
        <span className="text-[10px] font-black uppercase opacity-60 tracking-widest">{format(new Date(apt.dateTime), 'MMM')}</span>
        <span className={`text-2xl font-black leading-none text-text-main group-hover:${colorClass}`}>{format(new Date(apt.dateTime), 'dd')}</span>
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-1">
           <h4 className="text-xl font-black text-text-main leading-none uppercase tracking-tighter italic font-serif">
             {showPatient ? apt.patientName || 'Anonymous Node' : apt.doctorName || 'Clinical Lead'}
           </h4>
           {isDoctorView && (
             <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${
               apt.priority === 'high' ? 'bg-rose-50 border-rose-100 text-rose-600' : 
               apt.priority === 'medium' ? 'bg-amber-50 border-amber-100 text-amber-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'
             }`}>
               {apt.priority || 'standard'}
             </span>
           )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${colorClass.replace('text-', 'bg-')} animate-pulse`} />
            <span className={`text-[10px] font-black uppercase tracking-widest ${colorClass} opacity-80`}>
              {apt.departmentId.replace('-', ' ')}
            </span>
          </div>
          <span className="text-[10px] text-text-dim font-black uppercase tracking-widest flex items-center gap-1">
            <Clock size={10} />
            {format(new Date(apt.dateTime), 'h:mm a')}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {isDoctorView ? (
          <div className="flex items-center gap-2">
             <Link 
               to={`/records?patientId=${apt.patientId}`}
               className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg"
             >
               Consult
             </Link>
             <button className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all border border-transparent hover:border-slate-200">
                <Video size={16} />
             </button>
          </div>
        ) : (
          <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
            apt.status === 'scheduled' ? 'bg-blue-500/10 text-blue-400' : 
            apt.status === 'waiting' ? 'bg-yellow-500/10 text-yellow-500' :
            'bg-emerald-500/10 text-emerald-500'
          }`}>
            {apt.status}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricRow({ label, value }: any) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-white/10 last:border-0">
      <span className="text-sm opacity-80">{label}</span>
      <span className="font-mono font-black text-white/50">{value}</span>
    </div>
  );
}

function ResourceLink({ title, icon, to = "#" }: any) {
  return (
     <Link to={to} className="flex items-center justify-between group">
        <div className="flex items-center gap-3">
           <div className="p-2 bg-white/5 rounded-lg text-text-dim group-hover:text-blue-400 transition-colors">{icon}</div>
           <span className="text-sm font-medium text-text-muted group-hover:text-text-main transition-colors">{title}</span>
        </div>
        <ChevronRight size={14} className="text-text-dim opacity-0 group-hover:opacity-100 transition-all" />
     </Link>
  );
}


function AdminQuickAction({ title, desc, icon }: any) {
  return (
    <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl group hover:bg-blue-500/20 transition-all cursor-pointer">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">{icon}</div>
        <h4 className="font-black text-[10px] uppercase tracking-widest text-text-main">{title}</h4>
      </div>
      <p className="text-[10px] text-text-muted font-medium italic">{desc}</p>
    </div>
  );
}

function StatCard({ icon, label, value, trend }: any) {
  return (
    <div className="bg-card-bg p-6 rounded-[32px] border border-border-accent shadow-xl hover:border-blue-500/30 transition-all group">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 bg-inner-bg rounded-xl group-hover:scale-110 transition-transform">{icon}</div>
        <span className="text-[10px] font-black text-text-dim uppercase tracking-[0.2em] leading-none">{label}</span>
      </div>
      <p className="text-2xl font-black text-text-main truncate tracking-tight">{value}</p>
      <p className="text-[10px] text-text-muted mt-2 font-black uppercase tracking-widest">{trend}</p>
    </div>
  );
}

function LoadIndicator({ label, level, color }: any) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
        <span>{label}</span>
        <span className="text-text-muted">{level}%</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${level}%` }}></div>
      </div>
    </div>
  );
}

function SpecialistCard({ name, role, creds, stars, image }: any) {
  return (
    <div className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all group">
       <div className="relative mb-6">
          <img src={image} alt={name} className="w-full h-48 object-cover rounded-2xl grayscale group-hover:grayscale-0 transition-all duration-700" referrerPolicy="no-referrer" />
          <div className="absolute top-3 right-3 px-3 py-1 bg-white/90 backdrop-blur-md rounded-lg text-[10px] font-black text-slate-900 border border-slate-200 flex items-center gap-1">
             <Star size={10} className="fill-blue-500 text-blue-500" />
             {stars}
          </div>
       </div>
       <h4 className="text-lg font-black text-slate-900 italic font-serif leading-none uppercase tracking-tighter mb-1">{name}</h4>
       <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-3">{role}</p>
       <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
          <span className="text-[9px] font-mono text-slate-400 uppercase">{creds}</span>
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
       </div>
    </div>
  );
}

function NoticeItem({ title, desc }: any) {
  return (
    <div className="flex gap-3 group cursor-pointer">
      <div className="w-1 h-auto bg-white/5 group-hover:bg-blue-500 transition-colors rounded-full"></div>
      <div>
        <h4 className="font-bold text-sm text-text-main leading-tight group-hover:text-blue-400 transition-colors">{title}</h4>
        <p className="text-xs text-text-muted mt-1 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function CareLink({ title, subtitle, date, active, link }: any) {
  return (
    <Link to={link || "#"} className={`flex items-center justify-between p-6 rounded-2xl border transition-all group ${active ? 'bg-blue-600/10 border-blue-500/30' : 'bg-white/5 border-white/10 hover:border-blue-500/30'}`}>
       <div className="flex items-center gap-4">
          <div className={`w-2 h-2 rounded-full ${active ? 'bg-blue-500 animate-pulse' : 'bg-slate-700'}`} />
          <div>
             <div className="text-sm font-bold text-text-main uppercase tracking-tight">{title}</div>
             <div className="text-[10px] text-text-dim uppercase tracking-widest">{subtitle}</div>
          </div>
       </div>
       <div className="text-right">
          <div className="text-[10px] font-black text-text-dim uppercase tracking-widest">{date}</div>
          <ArrowRight size={14} className="ml-auto mt-1 transform group-hover:translate-x-1 transition-transform" />
       </div>
    </Link>
  );
}
