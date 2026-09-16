import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, onSnapshot, query, where, orderBy, limit, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { 
  AlertCircle, 
  Video, 
  Mic, 
  MapPin, 
  Phone, 
  Activity, 
  X, 
  ShieldAlert, 
  Zap,
  Radio,
  Signal,
  ArrowRight,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

import { useLocation } from 'react-router-dom';

interface EmergencySession {
  id: string;
  patientId: string;
  patientName: string;
  status: 'active' | 'resolved' | 'escalated';
  urgency: 'critical' | 'high';
  location?: { lat: number; lng: number };
  timestamp: any;
  vitals?: { bp: string; hr: string; spo2: string };
  clinicalNotes?: string;
  doctorName?: string;
}

export default function Emergency() {
  const { profile, isDoctor, isAdmin, loading: authLoading } = useAuth();
  const locationState = useLocation();
  const isStaff = isDoctor || isAdmin;

  const [session, setSession] = useState<EmergencySession | null>(null);
  const [activeSessions, setActiveSessions] = useState<EmergencySession[]>([]);
  const [loading, setLoading] = useState(false);
  const [vitals, setVitals] = useState({ bp: '120/80', hr: '72', spo2: '98' });
  const [staffNote, setStaffNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [videoActive, setVideoActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'linked' | 'idle'>('idle');
  const [stream, setStream] = useState<MediaStream | null>(null);

  const [hasAutoTriggered, setHasAutoTriggered] = useState(false);

  // Sync session data if joined
  useEffect(() => {
    if (!session?.id) return;

    const unsubscribe = onSnapshot(doc(db, 'emergencySessions', session.id), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setSession({ id: snapshot.id, ...data } as EmergencySession);
        if (data.clinicalNotes && isStaff) {
          setStaffNote(data.clinicalNotes);
        }
      } else {
        setSession(null);
        stopVideo();
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `emergencySessions/${session.id}`);
    });

    return () => unsubscribe();
  }, [session?.id, isStaff]);

  // Simulate Vitals Drift for Patient
  useEffect(() => {
    if (!session || isStaff || session.status !== 'active') return;

    const interval = setInterval(async () => {
      const newHr = (parseInt(vitals.hr) + (Math.random() > 0.5 ? 1 : -1)).toString();
      setVitals(prev => ({ ...prev, hr: newHr }));
      
      try {
        await updateDoc(doc(db, 'emergencySessions', session.id), {
          'vitals.hr': newHr
        });
      } catch (e) {
        console.error("Vitals sync fail:", e);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [session, isStaff, vitals.hr]);

  // Auto-trigger if coming from Vid-Link
  useEffect(() => {
    if (authLoading || hasAutoTriggered) return;
    
    const searchParams = new URLSearchParams(locationState.search);
    if (searchParams.get('autoStart') === 'true' && !isStaff && profile) {
      setHasAutoTriggered(true);
      triggerSOS();
    }
  }, [authLoading, isStaff, profile, locationState.search, hasAutoTriggered]);

  // Staff: Watch all active sessions
  useEffect(() => {
    if (!isStaff) return;
    const q = query(
      collection(db, 'emergencySessions'),
      where('status', '==', 'active'),
      orderBy('timestamp', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmergencySession));
      setActiveSessions(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'emergencySessions');
    });
    return () => unsubscribe();
  }, [isStaff]);

  // Request media access with high-fidelity constraints
  const startVideo = async () => {
    try {
      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);
      setVideoActive(true);
      setConnectionStatus('linked');
    } catch (err) {
      console.error("Clinical link failure:", err);
      // Fallback for demo environments if camera blocked
      setVideoActive(true);
      setConnectionStatus('linked');
    }
  };

  // Sync stream to video element
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const stopVideo = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setVideoActive(false);
    setConnectionStatus('idle');
  };

  // Fetch location on mount for patients
  useEffect(() => {
    let isMounted = true;
    if (!isStaff && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (isMounted) {
            setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          }
        },
        (err) => console.error("Location link failure:", err)
      );
    }
    return () => { isMounted = false; };
  }, [isStaff]);

  const triggerSOS = async () => {
    if (!profile) return;
    setLoading(true);
    
    try {
      const docRef = await addDoc(collection(db, 'emergencySessions'), {
        patientId: profile.userId,
        patientName: profile.name,
        status: 'active',
        urgency: 'critical',
        timestamp: serverTimestamp(),
        vitals: { ...vitals },
        location: location || null
      });
      
      setSession({
        id: docRef.id,
        patientId: profile.userId,
        patientName: profile.name,
        status: 'active',
        urgency: 'critical',
        timestamp: new Date().toISOString()
      });

      setConnectionStatus('connecting');
      
      // Automatic Doctor Paging Logic
      await addDoc(collection(db, 'pagingRequests'), {
        senderId: profile.userId,
        senderName: profile.name,
        message: `CRITICAL SOS: Patient ${profile.name} has triggered an emergency link. Real-time vitals: BP ${vitals.bp}, HR ${vitals.hr}.`,
        priority: 'critical',
        status: 'sent',
        timestamp: serverTimestamp()
      });

      // Simulate rapid escalation
      setTimeout(() => startVideo(), 1500);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'emergencySessions');
    } finally {
      setLoading(false);
    }
  };

  const joinSession = async (s: EmergencySession) => {
    try {
      await updateDoc(doc(db, 'emergencySessions', s.id), {
        doctorName: profile?.name || 'Practitioner',
        status: 'active'
      });
      setSession(s);
      setConnectionStatus('connecting');
      setTimeout(() => startVideo(), 1000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `emergencySessions/${s.id}`);
    }
  };

  const saveNote = async () => {
    if (!session || !isStaff) return;
    setSavingNote(true);
    try {
      await updateDoc(doc(db, 'emergencySessions', session.id), {
        clinicalNotes: staffNote
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `emergencySessions/${session.id}`);
    } finally {
      setSavingNote(false);
    }
  };
  const resolveSession = async (id: string) => {
    try {
      await updateDoc(doc(db, 'emergencySessions', id), { status: 'resolved' });
      if (session?.id === id) setSession(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `emergencySessions/${id}`);
    }
  };

  if (isStaff && !session) {
    return (
      <div className="min-h-[calc(100vh-80px)] bg-slate-950 text-white p-8 overflow-y-auto">
        <header className="flex justify-between items-end mb-12">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-600 rounded-lg animate-pulse">
                <ShieldAlert size={24} />
              </div>
              <h1 className="text-5xl font-black italic font-serif uppercase tracking-tighter leading-none">
                Trauma <br /><span className="text-rose-500">Nexus Console</span>
              </h1>
            </div>
            <p className="text-slate-500 font-mono text-[10px] uppercase tracking-widest">Global Emergency Monitoring & Response Unit</p>
          </div>
          <div className="flex gap-4">
            <div className="px-6 py-3 bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-3">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
              <span className="font-mono text-[10px] font-black uppercase text-slate-400">Node Secure</span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-4">Active Distress Signals</h3>
            
            <AnimatePresence mode="popLayout">
              {activeSessions.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-slate-900/40 border border-slate-800/50 rounded-[40px] p-20 flex flex-col items-center justify-center text-center space-y-6"
                >
                  <div className="p-8 bg-slate-950 rounded-full text-slate-800">
                    <Signal size={48} strokeWidth={1} />
                  </div>
                  <div>
                    <h4 className="text-xl font-black uppercase italic font-serif text-slate-700">All Nodes Clear</h4>
                    <p className="text-slate-600 text-xs font-mono mt-2 tracking-widest uppercase">No active critical signals detected</p>
                  </div>
                </motion.div>
              ) : (
                activeSessions.map((s) => (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="group bg-slate-900/80 border border-slate-800 hover:border-rose-500/50 rounded-[32px] p-8 flex items-center justify-between transition-all"
                  >
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-rose-600/20 rounded-2xl flex items-center justify-center text-rose-500 font-black text-xl animate-pulse">
                        <ShieldAlert />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-black uppercase tracking-widest text-rose-500">Critical Distress</span>
                          <span className="text-[10px] font-mono text-slate-500 italic">ID: {s.id.slice(0, 8)}</span>
                        </div>
                        <h4 className="text-2xl font-black text-white italic font-serif tracking-tight">{s.patientName}</h4>
                        <div className="flex items-center gap-4 mt-2">
                          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <Clock size={12} /> {format(new Date(s.timestamp?.toDate ? s.timestamp.toDate() : s.timestamp), 'HH:mm:ss')}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <MapPin size={12} /> Lagos Node-04
                          </div>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => joinSession(s)}
                      className="px-10 py-5 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-rose-900/20 flex items-center gap-3 group-hover:scale-105"
                    >
                      Establish Link <ArrowRight size={16} />
                    </button>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>

          <div className="space-y-8">
            <div className="bg-slate-900 border border-slate-800 rounded-[40px] p-8 space-y-6">
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">Node Status</h3>
              {[
                { label: 'Network Latency', val: '12ms', status: 'emerald' },
                { label: 'Clinical Uplink', val: '99.9%', status: 'emerald' },
                { label: 'Available Doctors', val: '14', status: 'blue' },
                { label: 'Hospital Buffer', val: 'Low', status: 'rose' }
              ].map((item: any) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 bg-${item.status}-500 rounded-full`} />
                    <span className="font-mono text-xs font-black text-white">{item.val}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-rose-600/10 border border-rose-600/20 rounded-[40px] p-8 space-y-2">
              <div className="flex items-center gap-2 text-rose-500 mb-2">
                <AlertCircle size={20} />
                <span className="text-[10px] font-black uppercase tracking-widest">Red-Line Warning</span>
              </div>
              <p className="text-rose-100 text-[10px] font-bold uppercase tracking-tight leading-relaxed">
                Emergency response times in Lagos central have increased by 14% due to infrastructure delays. Divert Triage to North-Axis Node if possible.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-80px)] bg-slate-950 text-white p-4 md:p-8 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background Pulse */}
      {session?.status === 'active' && (
        <div className="absolute inset-0 bg-rose-950/20 animate-pulse pointer-events-none" />
      )}

      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 z-10">
        
        {/* Left Side: Controls & Vitals */}
        <div className="lg:col-span-5 space-y-8 flex flex-col justify-center">
          <header className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-600 rounded-lg animate-bounce">
                <ShieldAlert size={24} />
              </div>
              <h1 className="text-4xl md:text-6xl font-black italic font-serif uppercase tracking-tighter leading-none">
                Red Alert <br /><span className="text-rose-500">Protocol</span>
              </h1>
            </div>
            <p className="text-slate-400 font-mono text-xs uppercase tracking-widest max-w-sm">
              Critical life-support nexus. Use only in Tier-1 clinical emergencies.
            </p>
          </header>

          {!session ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6 bg-slate-900/50 border border-slate-800 p-8 rounded-[40px] backdrop-blur-xl"
            >
              <div className="grid grid-cols-3 gap-4">
                {[
                  { id: 'hr', label: 'HR', placeholder: '72' },
                  { id: 'bp', label: 'BP', placeholder: '120/80' },
                  { id: 'spo2', label: 'SpO2', placeholder: '98' }
                ].map((v) => (
                  <div key={v.id} className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest pl-1">{v.label}</label>
                    <input 
                      type="text"
                      placeholder={v.placeholder}
                      value={(vitals as any)[v.id]}
                      onChange={(e) => setVitals(prev => ({ ...prev, [v.id]: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-center font-mono text-lg outline-none focus:border-rose-500/50 transition-all text-rose-500"
                    />
                  </div>
                ))}
              </div>

              <button 
                onClick={triggerSOS}
                disabled={loading}
                className="w-full py-10 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 text-white rounded-[40px] font-black text-2xl uppercase tracking-[0.2em] transition-all shadow-[0_0_50px_rgba(225,29,72,0.4)] flex flex-col items-center gap-4 group"
              >
                {loading ? (
                  <Zap className="animate-spin" size={48} />
                ) : (
                  <>
                    <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                      <ShieldAlert size={40} />
                    </div>
                    <span>Trigger Emergency SOS</span>
                    <span className="text-[10px] opacity-60 normal-case">Starts live video & paged physician node</span>
                  </>
                )}

              </button>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-8 bg-rose-600 rounded-[40px] shadow-[0_0_80px_rgba(225,29,72,0.6)] space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Signal className="animate-pulse text-white" size={24} />
                  <span className="font-mono text-sm font-black uppercase tracking-widest">Active Link</span>
                </div>
                <button 
                  onClick={() => setSession(null)}
                  className="p-2 bg-black/20 hover:bg-black/40 rounded-full transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-2">
                <h2 className="text-3xl font-black italic font-serif leading-none">
                  {isStaff ? `Linked to ${session.patientName}` : (session.doctorName ? `Linked to ${session.doctorName}` : 'Escalated to Trauma Node-01')}
                </h2>
                <p className="text-white/80 font-medium italic">
                  {isStaff ? 'Analyzing high-fidelity biological metrics and spatial coordinates.' : (session.doctorName ? 'Your physician has established a secure link and is reviewing your vitals.' : 'Physician is reviewing your genetic profile and live vitals.')}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {isStaff ? (
                  <>
                    <button 
                      onClick={() => resolveSession(session.id)}
                      className="flex items-center justify-center gap-2 p-4 bg-emerald-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-400 transition-all border border-emerald-400/30"
                    >
                      <CheckCircle2 size={16} /> Resolve Case
                    </button>
                    <button 
                      onClick={() => {
                         stopVideo();
                         setSession(null);
                      }}
                      className="flex items-center justify-center gap-2 p-4 bg-black text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black/80 transition-all border border-white/10"
                    >
                      <X size={16} /> End Session
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-center gap-2 p-4 bg-white/10 border border-white/20 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest">
                      <MapPin size={16} className="text-rose-300" /> Loc Sync: ON
                    </div>
                    <button 
                      onClick={stopVideo}
                      className="flex items-center justify-center gap-2 p-4 bg-black text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black/80 transition-all border border-white/10"
                    >
                      <Phone size={16} className="text-rose-500" /> Disconnect
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </div>

        {/* Right Side: Clinical Visualizer / Video */}
        <div className={`${isStaff ? 'lg:col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-8' : 'lg:col-span-7 h-[400px] lg:h-[600px] bg-slate-900 border border-slate-800 rounded-[60px] overflow-hidden relative shadow-2xl'}`}>
          <div className={`${isStaff ? 'lg:col-span-8 h-[600px]' : 'w-full h-full'} bg-slate-900 border border-slate-800 rounded-[60px] overflow-hidden relative shadow-2xl transition-all`}>
            {!videoActive ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12 space-y-6">
                <div className="w-32 h-32 border-2 border-slate-800 border-dashed rounded-full flex items-center justify-center text-slate-700">
                  <Video size={48} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black uppercase italic font-serif text-slate-700">Clinical Visualizer // Offline</h3>
                  <p className="text-slate-600 text-xs font-mono">STANDBY FOR SECURE TELE-METRY LINK</p>
                </div>
              </div>
            ) : (
              <>
                <video 
                  ref={(node) => {
                    (videoRef as any).current = node;
                    if (node && stream) {
                      node.srcObject = stream;
                    }
                  }} 
                  autoPlay 
                  playsInline 
                  muted={true}
                  className="w-full h-full object-cover brightness-90 contrast-110"
                />
                {!stream && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-center p-8">
                    <Activity className="text-blue-500 animate-pulse mb-4" size={48} />
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                      Camera Access Blocked or Not Found
                    </p>
                    <p className="text-[10px] text-slate-500 mt-2">
                      Running in Clinical Simulation Mode
                    </p>
                  </div>
                )}
                <div className="absolute inset-0 border-[20px] border-rose-600/20 pointer-events-none" />
                <div className="absolute top-8 left-8 bg-black/60 backdrop-blur-md p-4 rounded-2xl border border-white/10 flex items-center gap-4">
                  <div className="w-3 h-3 bg-rose-500 rounded-full animate-ping" />
                  <div className="font-mono text-[10px] uppercase font-black">Secure Clinical Proxy: ACTIVE</div>
                </div>
                
                {/* Real Vitals Overlay */}
                <div className="absolute bottom-8 right-8 space-y-2">
                  {[
                    { label: 'HR', val: session?.vitals?.hr || vitals.hr, unit: 'BPM', color: 'rose' },
                    { label: 'BP', val: session?.vitals?.bp || vitals.bp, unit: 'mmHg', color: 'blue' },
                    { label: 'SPO2', val: session?.vitals?.spo2 || vitals.spo2, unit: '%', color: 'emerald' }
                  ].map((item) => (
                    <div key={item.label} className="bg-black/60 backdrop-blur-md p-3 rounded-xl border border-white/10 flex items-center gap-4 justify-between min-w-[140px]">
                      <span className="text-[9px] font-black text-slate-500 uppercase">{item.label}</span>
                      <span className="font-mono text-sm font-black text-white">{item.val}<span className="text-[9px] ml-1 opacity-50">{item.unit}</span></span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Connection Lines animation */}
            {connectionStatus === 'connecting' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
                <div className="text-center space-y-8">
                  <div className="flex gap-1 justify-center">
                    {[...Array(5)].map((_, i) => (
                      <motion.div 
                        key={i}
                        animate={{ height: [20, 60, 20] }}
                        transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                        className="w-1 bg-rose-500 rounded-full"
                      />
                    ))}
                  </div>
                  <div className="font-mono text-xs font-black uppercase tracking-widest text-rose-500">Establishing Neuro-Link...</div>
                </div>
              </div>
            )}
          </div>

          {/* Staff Workstation Sidebar */}
          {isStaff && session && (
            <div className="lg:col-span-4 flex flex-col gap-6">
              <div className="bg-slate-900 border border-slate-800 rounded-[40px] p-8 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">Clinical Workstation</h3>
                  <div className="px-3 py-1 bg-rose-500/10 border border-rose-500/20 rounded-full text-rose-500 text-[10px] font-black uppercase">Live Notes</div>
                </div>

                <div className="flex-1 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                   <div className="space-y-2">
                     <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Patient Profile</label>
                     <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                       <p className="text-white font-black italic font-serif text-lg">{session.patientName}</p>
                       <p className="text-[10px] text-slate-500 font-mono mt-1">ID: {session.patientId.slice(0, 12)}</p>
                     </div>
                   </div>

                   <div className="space-y-2 flex-1 flex flex-col min-h-0">
                     <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1">Observations & Triage Record</label>
                     <textarea 
                        value={staffNote}
                        onChange={(e) => setStaffNote(e.target.value)}
                        placeholder="Begin documenting clinical observations..."
                        className="flex-1 w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm font-medium text-white outline-none focus:border-blue-500/50 transition-all font-sans resize-none placeholder:text-slate-700"
                     />
                   </div>
                </div>

                <button 
                  onClick={saveNote}
                  disabled={savingNote}
                  className="w-full mt-6 py-5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-blue-900/20 flex items-center justify-center gap-3"
                >
                  {savingNote ? <Zap className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                  {savingNote ? 'Syncing...' : 'Sync Record'}
                </button>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-[40px] p-8">
                <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-4">Command Actions</h4>
                <div className="grid grid-cols-2 gap-4">
                  <button className="p-4 bg-slate-950 border border-slate-800 rounded-2xl hover:border-blue-500/50 transition-all text-center group">
                    <Radio className="mx-auto mb-2 text-slate-500 group-hover:text-blue-500" size={18} />
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Escalate</span>
                  </button>
                  <button className="p-4 bg-slate-950 border border-slate-800 rounded-2xl hover:border-emerald-500/50 transition-all text-center group">
                    <CheckCircle2 className="mx-auto mb-2 text-slate-500 group-hover:text-emerald-500" size={18} />
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Acknowledge</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Triage Referral Alert (Mock) */}
      <AnimatePresence>
        {!session && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="fixed bottom-32 right-8 max-w-sm bg-blue-600 p-6 rounded-3xl shadow-2xl border border-blue-400 hidden xl:block"
          >
            <div className="flex items-start gap-4">
              <Activity className="text-white shrink-0" size={24} />
              <div>
                <h4 className="text-white font-black italic uppercase text-xs tracking-tight">AI Diagnostic Suggestion</h4>
                <p className="text-blue-100 text-[10px] mt-2 font-medium">Your recent triage flagged cardiac red-flags. Escalate immediately.</p>
                <button className="mt-4 flex items-center gap-2 text-white font-black text-[10px] uppercase tracking-widest group">
                  Load Context <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
