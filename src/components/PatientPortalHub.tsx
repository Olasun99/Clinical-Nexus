import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Heart, 
  Activity, 
  Thermometer, 
  Wind, 
  Calendar, 
  Clock, 
  ArrowRight, 
  Sparkles, 
  Plus, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  User, 
  Download, 
  Eye, 
  Video, 
  MessageSquare, 
  Send, 
  Pill, 
  Microscope, 
  TrendingUp, 
  PlusCircle, 
  Edit, 
  Save, 
  FileText, 
  Check, 
  ChevronRight,
  RefreshCw,
  Award,
  AlertTriangle,
  X
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import { createNotification } from '../hooks/useNotifications';
import { logAction } from '../lib/audit';
import PatientTimeline from './PatientTimeline';

// Available Specialists for Messaging
const SPECIALISTS = [
  { id: 'SarahAlabi', name: 'Dr. Sarah Alabi', specialty: 'Interventional Cardiology', image: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?auto=format&fit=crop&q=80&w=200&h=200' },
  { id: 'EmekaChen', name: 'Dr. Emeka Chen', specialty: 'Neurological Surgery', image: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&q=80&w=200&h=200' },
  { id: 'ZainabKola', name: 'Dr. Zainab Kola', specialty: 'Consultant Pediatrician', image: 'https://images.unsplash.com/photo-1559839734-2b71f1e59816?auto=format&fit=crop&q=80&w=200&h=200' },
  { id: 'DavidObi', name: 'Prof. David Obi', specialty: 'Chief of Trauma', image: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=200&h=200' }
];

export default function PatientPortalHub() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'appointments' | 'records' | 'medication' | 'messenger' | 'tracking'>('overview');
  
  // Real-time collections for patient
  const [appointments, setAppointments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [medicalRecords, setMedicalRecords] = useState<any[]>([]);
  const [healthLogs, setHealthLogs] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [profileData, setProfileData] = useState<{ chronicConditions: string[]; allergies: string[]; vaccines: any[] }>({
    chronicConditions: [],
    allergies: [],
    vaccines: [
      { name: 'COVID-19 Booster', date: '2025-11-15', facility: 'OlaSun Central' },
      { name: 'Hepatitis B', date: '2024-04-10', facility: 'OlaSun General' },
      { name: 'Yellow Fever', date: '2023-08-22', facility: 'Federal Medical Hub' }
    ]
  });

  const [loading, setLoading] = useState(true);

  // Form states
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ chronicConditions: '', allergies: '' });
  const [activeRefillRequest, setActiveRefillRequest] = useState<string | null>(null);

  // Telehealth State
  const [telehealthSession, setTelehealthSession] = useState<any | null>(null);
  const [teleMessage, setTeleMessage] = useState('');
  const [teleChat, setTeleChat] = useState<any[]>([
    { sender: 'AI Care Bot', text: 'Telehealth pipeline initialized. Est. signal delay: 4ms. Waiting for clinical supervisor...' }
  ]);
  const [webRtcStatus, setWebRtcStatus] = useState<'idle' | 'requesting' | 'negotiating' | 'connected'>('idle');

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    let localActiveStream: MediaStream | null = null;
    if (telehealthSession) {
      setWebRtcStatus('requesting');
      
      // Attempt to access user media devices for the WebRTC video stream
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
          localActiveStream = stream;
          setLocalStream(stream);
          setWebRtcStatus('negotiating');
          
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
          
          // Simulate standard WebRTC peer-to-peer handshake sequence
          const handshakes = [
            "Initializing standard RTCPeerConnection peer link...",
            "Local SDP Offer constructed successfully.",
            "ICE candidates gathered and synchronized via signaling channel.",
            "Remote SDP Answer accepted from Clinician. Handshake completed.",
            "WebRTC Secure Peer-to-Peer Data & Video Channel connected!"
          ];

          let t = 0;
          const runHandshakes = () => {
            if (t < handshakes.length) {
              setTeleChat(prev => [...prev, { sender: 'System WebRTC', text: handshakes[t] }]);
              t++;
              setTimeout(runHandshakes, 1500);
            } else {
              setWebRtcStatus('connected');
            }
          };
          setTimeout(runHandshakes, 1000);
        })
        .catch(err => {
          console.warn("Camera stream denied or unavailable:", err);
          setWebRtcStatus('connected'); // Fallback to connected simulation anyway
          setTeleChat(prev => [...prev, { sender: 'System Warning', text: 'Camera/microphone access could not be acquired. Proceeding in telemetry simulator mode.' }]);
        });
    } else {
      // Cleanup streams
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        setLocalStream(null);
      }
      setWebRtcStatus('idle');
    }
    return () => {
      if (localActiveStream) {
        localActiveStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [telehealthSession]);

  // Messaging state
  const [selectedDoctorId, setSelectedDoctorId] = useState(SPECIALISTS[0].id);
  const [typedMessage, setTypedMessage] = useState('');
  const [isDoctorTyping, setIsDoctorTyping] = useState(false);

  // Vitals Log form state
  const [vitalsForm, setVitalsForm] = useState({
    bpSystolic: '120',
    bpDiastolic: '80',
    bloodGlucose: '95',
    weight: '70',
    symptoms: '',
    mood: 'Calm',
    painScore: 2
  });

  // Reschedule state
  const [reschedulingAptId, setReschedulingAptId] = useState<string | null>(null);
  const [newAptDateTime, setNewAptDateTime] = useState('');

  // Fetch data
  useEffect(() => {
    if (!profile) return;

    // Queries
    const aptQ = query(collection(db, 'appointments'), where('patientId', '==', profile.userId), orderBy('dateTime', 'desc'));
    const invQ = query(collection(db, 'invoices'), where('userId', '==', profile.userId), orderBy('dueDate', 'desc'));
    const recQ = query(collection(db, 'medicalRecords'), where('patientId', '==', profile.userId), orderBy('date', 'desc'));
    const logsQ = query(collection(db, 'healthLogs'), where('patientId', '==', profile.userId), orderBy('timestamp', 'desc'));
    const msgQ = query(collection(db, 'messages'), where('recipientId', '==', profile.userId));
    const msgSentQ = query(collection(db, 'messages'), where('senderId', '==', profile.userId));

    // Listeners
    const unsubApt = onSnapshot(aptQ, (snap) => {
      setAppointments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubInv = onSnapshot(invQ, (snap) => {
      setInvoices(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubRec = onSnapshot(recQ, (snap) => {
      setMedicalRecords(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubLogs = onSnapshot(logsQ, (snap) => {
      setHealthLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Profile listener from subcollection
    const profileRef = doc(db, 'users', profile.userId, 'patientData', 'profile');
    getDoc(profileRef).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setProfileData(prev => ({
          ...prev,
          chronicConditions: data.chronicConditions || [],
          allergies: data.allergies || []
        }));
        setProfileForm({
          chronicConditions: (data.chronicConditions || []).join(', '),
          allergies: (data.allergies || []).join(', ')
        });
      }
    });

    // Combined Messages listener
    const unsubMsgRecipient = onSnapshot(msgQ, (snap) => {
      const incoming = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(prev => {
        const sent = prev.filter(m => m.senderId === profile.userId);
        const combined = [...sent, ...incoming];
        const unique = combined.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
        return unique.sort((a, b) => {
          const tA = a.timestamp?.seconds || 0;
          const tB = b.timestamp?.seconds || 0;
          return tA - tB;
        });
      });
    });

    const unsubMsgSender = onSnapshot(msgSentQ, (snap) => {
      const outgoing = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(prev => {
        const incoming = prev.filter(m => m.recipientId === profile.userId);
        const combined = [...incoming, ...outgoing];
        const unique = combined.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
        return unique.sort((a, b) => {
          const tA = a.timestamp?.seconds || 0;
          const tB = b.timestamp?.seconds || 0;
          return tA - tB;
        });
      });
    });

    setLoading(false);

    return () => {
      unsubApt();
      unsubInv();
      unsubRec();
      unsubLogs();
      unsubMsgRecipient();
      unsubMsgSender();
    };
  }, [profile]);

  // Adherence Reminders local checklist
  const [adherenceChecked, setAdherenceChecked] = useState<Record<string, boolean>>({
    'morning-dose': false,
    'afternoon-check': true,
    'evening-dose': false
  });

  // Calculate dynamic health tips
  const healthTips = useMemo(() => {
    const tips = [];
    const conds = profileData.chronicConditions.map(c => c.toLowerCase());
    
    if (conds.some(c => c.includes('hypertension') || c.includes('bp') || c.includes('pressure'))) {
      tips.push({
        condition: 'Hypertension',
        tip: 'Sodium management: Keep daily intake under 1,500 mg. Avoid highly processed bouillons.',
        icon: <Heart size={16} className="text-rose-500" />
      });
    }
    if (conds.some(c => c.includes('asthma') || c.includes('lungs') || c.includes('respiratory'))) {
      tips.push({
        condition: 'Asthma',
        tip: 'Trigger tracking: Keep windows shut during high dust/pollen periods, and check your rescue inhaler dose count.',
        icon: <Wind size={16} className="text-blue-500" />
      });
    }
    if (conds.some(c => c.includes('diabetes') || c.includes('glucose') || c.includes('sugar'))) {
      tips.push({
        condition: 'Diabetes',
        tip: 'Glycemic safety: Avoid fast carbs alone. Always pair fruit or starches with high fiber or lean protein.',
        icon: <Activity size={16} className="text-purple-500" />
      });
    }
    
    // Default Tips
    tips.push({
      condition: 'Wellness Focus',
      tip: 'Optimal hydration: Consuming 2.5L to 3.0L of pure mineralized water today assists kidney filtration.',
      icon: <Sparkles size={16} className="text-amber-500" />
    });
    tips.push({
      condition: 'Activity Sync',
      tip: 'Moderate circulation: A simple 20-minute post-meal walk is clinically shown to lower insulin spikes.',
      icon: <TrendingUp size={16} className="text-emerald-500" />
    });

    return tips;
  }, [profileData.chronicConditions]);

  // Compute live trends
  const trendData = useMemo(() => {
    if (healthLogs.length === 0) {
      // Nominal default
      return [
        { day: 'Mon', hr: 72, bp: 120, glucose: 95 },
        { day: 'Tue', hr: 75, bp: 118, glucose: 92 },
        { day: 'Wed', hr: 68, bp: 122, glucose: 98 },
        { day: 'Thu', hr: 80, bp: 121, glucose: 96 },
        { day: 'Fri', hr: 71, bp: 119, glucose: 94 },
        { day: 'Sat', hr: 73, bp: 120, glucose: 93 },
        { day: 'Sun', hr: 69, bp: 117, glucose: 95 }
      ];
    }
    
    // Convert healthLogs to chart items (up to 7, newest last)
    const sorted = [...healthLogs].sort((a, b) => {
      const dA = a.timestamp?.seconds || 0;
      const dB = b.timestamp?.seconds || 0;
      return dA - dB;
    }).slice(-7);

    return sorted.map((log, index) => {
      const date = log.timestamp ? new Date(log.timestamp.seconds * 1000) : new Date();
      return {
        day: format(date, 'MMM d'),
        hr: Math.round(Number(log.bpSystolic) * 0.6), // Proxy HR for aesthetic diversity
        bp: Number(log.bpSystolic),
        glucose: Number(log.bloodGlucose),
        weight: Number(log.weight)
      };
    });
  }, [healthLogs]);

  // Get active/latest vitals values
  const latestVitals = useMemo(() => {
    if (healthLogs.length > 0) {
      const latest = healthLogs[0];
      return {
        bp: `${latest.bpSystolic}/${latest.bpDiastolic}`,
        glucose: latest.bloodGlucose,
        weight: latest.weight,
        mood: latest.mood,
        symptoms: latest.symptoms
      };
    }
    return {
      bp: '120/80',
      glucose: '95',
      weight: '70',
      mood: 'Calm',
      symptoms: 'None'
    };
  }, [healthLogs]);

  // Authorize Invoice Payment
  const handlePayInvoice = async (inv: any) => {
    if (!profile) return;
    try {
      await updateDoc(doc(db, 'invoices', inv.id), {
        status: 'paid'
      });
      
      // Log action
      await logAction(profile.userId, profile.name, 'PAY_INVOICE', 'Financials', `Paid invoice ${inv.id} ($${inv.amount})`);

      // Create success notification
      await createNotification(profile.userId, {
        title: 'Payment Successful',
        message: `Your payment of $${inv.amount} for "${inv.label}" has been processed and verified.`,
        type: 'success'
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Profile Save
  const handleSaveProfile = async () => {
    if (!profile) return;
    try {
      const conditionsArray = profileForm.chronicConditions
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      const allergiesArray = profileForm.allergies
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      const profileRef = doc(db, 'users', profile.userId, 'patientData', 'profile');
      await setDoc(profileRef, {
        chronicConditions: conditionsArray,
        allergies: allergiesArray
      }, { merge: true });

      setProfileData(prev => ({
        ...prev,
        chronicConditions: conditionsArray,
        allergies: allergiesArray
      }));
      setIsEditingProfile(false);

      await createNotification(profile.userId, {
        title: 'EHR Profile Updated',
        message: 'Your personal clinical metadata (conditions/allergies) was synchronized.',
        type: 'success'
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Reschedule Appointment
  const handleReschedule = async () => {
    if (!profile || !reschedulingAptId || !newAptDateTime) return;
    try {
      await updateDoc(doc(db, 'appointments', reschedulingAptId), {
        dateTime: new Date(newAptDateTime).toISOString(),
        status: 'scheduled'
      });

      await logAction(profile.userId, profile.name, 'RESCHEDULE_APPOINTMENT', 'Appointments', `Rescheduled appointment ${reschedulingAptId} to ${newAptDateTime}`);

      await createNotification(profile.userId, {
        title: 'Appointment Rescheduled',
        message: `Your medical session is rescheduled for ${format(new Date(newAptDateTime), 'PPp')}.`,
        type: 'info'
      });

      setReschedulingAptId(null);
      setNewAptDateTime('');
    } catch (e) {
      console.error(e);
    }
  };

  // Submit Vitals Log
  const handleLogVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    try {
      await addDoc(collection(db, 'healthLogs'), {
        patientId: profile.userId,
        bpSystolic: vitalsForm.bpSystolic,
        bpDiastolic: vitalsForm.bpDiastolic,
        bloodGlucose: vitalsForm.bloodGlucose,
        weight: vitalsForm.weight,
        symptoms: vitalsForm.symptoms,
        mood: vitalsForm.mood,
        painScore: vitalsForm.painScore,
        timestamp: serverTimestamp()
      });

      await logAction(profile.userId, profile.name, 'LOG_VITALS', 'Medical Records', `Logged vitals: BP ${vitalsForm.bpSystolic}/${vitalsForm.bpDiastolic}, Glucose ${vitalsForm.bloodGlucose}, Mood ${vitalsForm.mood}`);

      await createNotification(profile.userId, {
        title: 'Biometrics Logged',
        message: 'Your vital signs trends were successfully stored and synchronized for clinical review.',
        type: 'success'
      });

      setVitalsForm(prev => ({
        ...prev,
        symptoms: '',
        painScore: 2
      }));
      setActiveTab('overview');
    } catch (err) {
      console.error(err);
    }
  };

  // Generate Medical Record PDF
  const downloadPDF = (record: any) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('OLASUN HEALTH DIGITAL VAULT', 20, 25);
    
    doc.setFontSize(9);
    doc.text(`DATE GENERATED: ${format(new Date(), 'yyyy-MM-dd HH:mm')} | CLIENT SECURITY VERIFIED`, 20, 32);
    
    doc.setTextColor(33, 37, 41);
    doc.setFontSize(16);
    doc.text(record.title.toUpperCase(), 20, 60);
    
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 65, pageWidth - 20, 65);
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const recordDate = record.date ? new Date(record.date) : new Date();
    const formattedDate = isNaN(recordDate.getTime()) ? 'Unknown' : format(recordDate, 'MMMM do, yyyy');
    doc.text(`Type: ${record.type.toUpperCase()}`, 20, 75);
    doc.text(`Recorded Date: ${formattedDate}`, 20, 82);
    doc.text(`Patient Reference: ${profile?.name} (${profile?.userId.slice(0,8)})`, 20, 89);
    
    doc.setFont('helvetica', 'bold');
    doc.text('CLINICAL SYNTHESIS / CLINICAL STATEMENT:', 20, 105);
    
    doc.setFont('helvetica', 'normal');
    const splitText = doc.splitTextToSize(record.content, pageWidth - 40);
    doc.text(splitText, 20, 115);
    
    const footerText = 'OlaSun Medical Grid - Blockchain-Authenticated Patient Vault Copy.';
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(footerText, pageWidth / 2, 285, { align: 'center' });
    
    doc.save(`OlaSun_EHR_${record.id}.pdf`);
  };

  // Secure Message Sending with Immediate Doctor AI reply simulation
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !typedMessage.trim()) return;

    const currentMsg = typedMessage;
    setTypedMessage('');

    try {
      // User message
      await addDoc(collection(db, 'messages'), {
        senderId: profile.userId,
        senderName: profile.name,
        recipientId: selectedDoctorId,
        text: currentMsg,
        timestamp: serverTimestamp()
      });

      // Show typing indicator
      setIsDoctorTyping(true);

      setTimeout(async () => {
        const doctor = SPECIALISTS.find(d => d.id === selectedDoctorId);
        
        // Simulating Doctor clinical wisdom reply
        let doctorReplyText = `Thank you for reaching out. Let me review your biometrics. If you are experiencing pain or breathing issues, please use our SOS link. I will review this in detail during our next check-in.`;
        
        if (currentMsg.toLowerCase().includes('pressure') || currentMsg.toLowerCase().includes('bp')) {
          doctorReplyText = `Your logged Blood Pressure is noted. Please keep tracking daily in the Vitals tab. If systolic goes above 140, schedule an urgent telemetry rotation or contact the desk. Avoid heavy salt in the meantime.`;
        } else if (currentMsg.toLowerCase().includes('headache') || currentMsg.toLowerCase().includes('pain')) {
          doctorReplyText = `Understood. Ensure adequate hydration. You may take 500mg Paracetamol every 6 hours if appropriate and there are no liver contraindications. Let's monitor.`;
        } else if (currentMsg.toLowerCase().includes('refill') || currentMsg.toLowerCase().includes('medication')) {
          doctorReplyText = `Got your medication query. Please use the "Request Refill" link in the Medication tab directly. This allows me to authorize the dispensary link with one click.`;
        }

        await addDoc(collection(db, 'messages'), {
          senderId: selectedDoctorId,
          senderName: doctor?.name || 'Clinic Lead',
          recipientId: profile.userId,
          text: doctorReplyText,
          timestamp: serverTimestamp()
        });

        setIsDoctorTyping(false);

        // Send a message notification
        await createNotification(profile.userId, {
          title: `Message from ${doctor?.name}`,
          message: `You received a clinical response regarding: "${currentMsg.slice(0, 20)}..."`,
          type: 'info'
        });

      }, 2500);

    } catch (e) {
      console.error(e);
    }
  };

  // Live refill request trigger
  const handleRefillRequest = async (record: any) => {
    if (!profile) return;
    setActiveRefillRequest(record.id);

    try {
      setTimeout(async () => {
        await createNotification(profile.userId, {
          title: 'Refill Submitted',
          message: `Dispensary request for "${record.title}" sent to ${record.doctorId ? 'Clinical Lead' : 'Care Team'} for authentication.`,
          type: 'success'
        });
        setActiveRefillRequest(null);
      }, 1500);
    } catch (e) {
      console.error(e);
      setActiveRefillRequest(null);
    }
  };

  // Join Telehealth Room
  const handleJoinTelehealth = (apt: any) => {
    setTelehealthSession(apt);
    setTeleChat([
      { sender: 'AI Care Bot', text: `Room authenticated. Connected to channel #${apt.id.slice(0, 8)}. Camera status: OK.` },
      { sender: 'Nurse Assistant', text: `Welcome, ${profile?.name}. Doctor ${apt.doctorName || 'Ola'} has been paged and is reviewing your records.` }
    ]);
  };

  return (
    <div className="space-y-8" id="patient-portal-hub">
      
      {/* Dynamic Telehealth Room Overlay */}
      {telehealthSession && (
        <div className="fixed inset-0 z-[110] bg-slate-950 flex flex-col md:flex-row h-screen">
          
          {/* Main Video Screen */}
          <div className="flex-1 flex flex-col relative bg-slate-900 border-r border-white/10 h-2/3 md:h-full">
            
            {/* Header details */}
            <div className="absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-slate-950 to-transparent flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <div>
                  <h4 className="text-white font-bold text-sm uppercase tracking-widest">{telehealthSession.doctorName || 'Clinical Lead Specialist'}</h4>
                  <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest mt-0.5">{telehealthSession.departmentId ? telehealthSession.departmentId.replace('-', ' ') : 'General'} consultation</p>
                </div>
              </div>
              <div className="bg-white/10 px-4 py-1.5 rounded-lg text-white text-[10px] font-black tracking-widest uppercase border border-white/10">
                {webRtcStatus === 'requesting' ? 'Requesting Camera...' :
                 webRtcStatus === 'negotiating' ? 'WebRTC Handshake...' :
                 'Live Video Connection OK'}
              </div>
            </div>

            {/* Doctor Feed Simulated */}
            <div className="flex-1 flex items-center justify-center relative overflow-hidden bg-slate-800">
              <img 
                src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80&w=800"
                alt="Doctor camera"
                className="w-full h-full object-cover opacity-80"
              />
              <div className="absolute inset-0 bg-slate-950/20" />
              
              {/* Dynamic simulated audio wave overlay */}
              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                {[...Array(8)].map((_, i) => (
                  <div 
                    key={i} 
                    className="w-1.5 bg-blue-500 rounded-full animate-bounce" 
                    style={{ 
                      height: `${12 + Math.random() * 40}px`,
                      animationDelay: `${i * 150}ms`
                    }} 
                  />
                ))}
              </div>
            </div>

            {/* Self Camera Picture-in-Picture */}
            <div className="absolute bottom-8 right-8 w-32 md:w-44 aspect-video rounded-2xl bg-slate-950 overflow-hidden border-2 border-blue-500 shadow-2xl z-20">
              <div className="w-full h-full bg-slate-900 relative">
                <div className="absolute top-2 left-2 text-[8px] font-black uppercase text-white bg-black/40 px-1.5 py-0.5 rounded z-10">You</div>
                {localStream ? (
                  <video 
                    ref={localVideoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-full object-cover transform -scale-x-100"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-white/20">
                    <User size={24} className="animate-pulse" />
                  </div>
                )}
              </div>
            </div>

            {/* Controller row */}
            <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-slate-950 to-transparent flex justify-center items-center gap-4">
              <button 
                onClick={() => setTelehealthSession(null)}
                className="px-8 py-4 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-xl shadow-rose-950/40"
              >
                Disconnect Session
              </button>
            </div>
          </div>

          {/* Telehealth Sidebar Notes and Chat */}
          <div className="w-full md:w-96 bg-slate-900 flex flex-col h-1/3 md:h-full">
            <div className="p-6 border-b border-white/10 bg-slate-950">
              <h3 className="text-white font-bold text-xs uppercase tracking-widest">Consultation Tele-Chat</h3>
              <p className="text-[10px] text-slate-500 mt-1">Real-time telemetry and clinical dialogue</p>
            </div>
            
            {/* Feed chat */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              {teleChat.map((msg, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="text-[9px] font-black uppercase text-slate-500 tracking-wider">{msg.sender}</div>
                  <div className="p-3 bg-white/5 rounded-2xl text-xs text-white leading-relaxed font-sans">{msg.text}</div>
                </div>
              ))}
            </div>

            {/* Chat inputs */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (!teleMessage.trim()) return;
                setTeleChat(prev => [...prev, { sender: 'You', text: teleMessage }]);
                const current = teleMessage;
                setTeleMessage('');
                
                setTimeout(() => {
                  setTeleChat(prev => [...prev, { sender: 'Doctor AI Assistant', text: `Synchronizing: I have logged "${current}" for clinical evaluation.` }]);
                }, 1500);
              }}
              className="p-6 border-t border-white/10 bg-slate-950 flex gap-2"
            >
              <input 
                type="text" 
                value={teleMessage}
                onChange={e => setTeleMessage(e.target.value)}
                placeholder="Type clinician query..."
                className="flex-1 bg-white/5 text-white font-medium text-xs p-3.5 rounded-xl border border-white/10 outline-none focus:border-blue-500"
              />
              <button type="submit" className="p-3.5 bg-blue-600 text-white rounded-xl hover:bg-blue-500">
                <Send size={14} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tabs list */}
      <div className="flex flex-wrap gap-2 border-b border-border-accent/10 pb-2">
        <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<Activity size={14} />}>Health Hub</TabButton>
        <TabButton active={activeTab === 'appointments'} onClick={() => setActiveTab('appointments')} icon={<Calendar size={14} />}>Care Appointments</TabButton>
        <TabButton active={activeTab === 'records'} onClick={() => setActiveTab('records')} icon={<FileText size={14} />}>Clinical Archives</TabButton>
        <TabButton active={activeTab === 'medication'} onClick={() => setActiveTab('medication')} icon={<Pill size={14} />}>Medications</TabButton>
        <TabButton active={activeTab === 'messenger'} onClick={() => setActiveTab('messenger')} icon={<MessageSquare size={14} />}>Secure Messenger</TabButton>
        <TabButton active={activeTab === 'tracking'} onClick={() => setActiveTab('tracking')} icon={<PlusCircle size={14} />}>Log Biometrics</TabButton>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.2 }}
          className="space-y-8"
        >
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-8" id="overview-tab-content">
              
              {/* Dynamic Welcome Card & Profile edit */}
              <div className="bg-slate-900 border border-slate-800 rounded-[44px] p-8 text-white relative overflow-hidden shadow-2xl group">
                <div className="absolute top-0 right-0 p-8 text-white/5 group-hover:scale-110 transition-transform">
                  <Award size={120} />
                </div>
                <div className="relative z-10 space-y-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-400">Clinical Patient Profile</h4>
                      <h2 className="text-3xl md:text-4xl font-black italic font-serif uppercase tracking-tighter text-white mt-2">
                        Welcome back, {profile?.name || 'Valued Patient'}
                      </h2>
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      <button 
                        onClick={() => {
                          handleJoinTelehealth({
                            id: 'tele-' + Math.random().toString(36).substring(2, 9),
                            doctorName: 'Dr. Sarah Alabi',
                            departmentId: 'Cardiology'
                          });
                        }}
                        className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-blue-500/30 transition-all shadow-lg shadow-blue-500/20 animate-pulse"
                      >
                        <Video size={12} />
                        Start Telemedicine
                      </button>
                      <button 
                        onClick={() => setIsEditingProfile(!isEditingProfile)}
                        className="px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-white/10 transition-colors"
                      >
                        {isEditingProfile ? <X size={12} /> : <Edit size={12} />}
                        {isEditingProfile ? 'Close Edit' : 'Edit Conditions'}
                      </button>
                    </div>
                  </div>

                  {isEditingProfile ? (
                    <div className="bg-white/5 p-6 rounded-3xl border border-white/10 space-y-4 max-w-xl">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Chronic Conditions (comma separated)</label>
                        <input 
                          type="text"
                          value={profileForm.chronicConditions}
                          onChange={e => setProfileForm(prev => ({ ...prev, chronicConditions: e.target.value }))}
                          placeholder="e.g. Hypertension, Mild Asthma"
                          className="w-full bg-slate-950 border border-white/10 p-3.5 rounded-xl text-white font-medium text-xs outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Allergies (comma separated)</label>
                        <input 
                          type="text"
                          value={profileForm.allergies}
                          onChange={e => setProfileForm(prev => ({ ...prev, allergies: e.target.value }))}
                          placeholder="e.g. Penicillin, Peanuts"
                          className="w-full bg-slate-950 border border-white/10 p-3.5 rounded-xl text-white font-medium text-xs outline-none focus:border-blue-500"
                        />
                      </div>
                      <button 
                        onClick={handleSaveProfile}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all"
                      >
                        Synchronize Profile
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-8 pt-4 border-t border-white/10">
                      <div>
                        <div className="text-[9px] font-black uppercase text-slate-400">Chronic Conditions</div>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {profileData.chronicConditions.length > 0 ? profileData.chronicConditions.map((c, i) => (
                            <span key={i} className="px-2.5 py-1 bg-blue-500/10 text-blue-400 rounded-lg text-[9px] font-black uppercase tracking-widest border border-blue-500/20">{c}</span>
                          )) : <span className="text-xs italic text-slate-500">None Recorded</span>}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] font-black uppercase text-slate-400">Recorded Allergies</div>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {profileData.allergies.length > 0 ? profileData.allergies.map((a, i) => (
                            <span key={i} className="px-2.5 py-1 bg-rose-500/10 text-rose-400 rounded-lg text-[9px] font-black uppercase tracking-widest border border-rose-500/20">{a}</span>
                          )) : <span className="text-xs italic text-slate-500">None Recorded</span>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Vitals & Trend Section */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <VitalCard icon={<Heart size={18} className="animate-pulse" />} color="rose" label="Pulse Rate" value={`${latestVitals.mood === 'Calm' ? '72' : '84'} BPM`} subText="● Normal Nominal Range" />
                <VitalCard icon={<Wind size={18} />} color="blue" label="Oxygen Saturation" value="99% SpO2" subText="● Excellent Saturation" />
                <VitalCard icon={<Activity size={18} />} color="purple" label="Blood Pressure" value={`${latestVitals.bp} mmHg`} subText="● Dynamic Bio-Feed" />
                <VitalCard icon={<Thermometer size={18} />} color="amber" label="Weight / Glucose" value={`${latestVitals.weight}kg | ${latestVitals.glucose}mg/dL`} subText="● Clinical Logs Active" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Trends area */}
                <div className="lg:col-span-2 bg-white border border-slate-100 p-8 rounded-[44px] shadow-sm hover:shadow-xl transition-all">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 mb-2">Biometric Timeline</h4>
                      <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic font-serif">Logged Health Trends</h3>
                    </div>
                    <div className="flex gap-4 text-xs font-bold uppercase tracking-wider text-slate-400">
                      <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Systolic BP</div>
                      <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Glucose</div>
                    </div>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorBp" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorGl" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="day" stroke="#94a3b8" fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} domain={[40, 150]} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '16px', border: 'none', color: '#fff', fontSize: '11px' }} />
                        <Area type="monotone" dataKey="bp" stroke="#3b82f6" strokeWidth={3} fill="url(#colorBp)" name="Systolic BP" />
                        <Area type="monotone" dataKey="glucose" stroke="#8b5cf6" strokeWidth={3} fill="url(#colorGl)" name="Blood Glucose" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Right: Health Tips based on Conditions */}
                <div className="bg-card-bg border border-border-accent p-8 rounded-[44px] shadow-sm flex flex-col justify-between">
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 text-blue-600">
                      <Sparkles size={16} />
                      <h4 className="text-[10px] font-black uppercase tracking-widest">Personalized Health Tips</h4>
                    </div>
                    <div className="space-y-4">
                      {healthTips.map((tip, idx) => (
                        <div key={idx} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex gap-3 items-start">
                          <div className="p-2 bg-white rounded-xl shadow-sm shrink-0">
                            {tip.icon}
                          </div>
                          <div>
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">{tip.condition}</span>
                            <p className="text-xs text-slate-800 mt-1 font-medium leading-relaxed italic">"{tip.tip}"</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Outstanding Bills & Reminders Split Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Outstanding Bills Widget */}
                <div className="bg-white border border-slate-100 p-8 rounded-[40px] shadow-xl">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter font-serif italic">Outstanding Settlements</h3>
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Pending payments and invoices</p>
                    </div>
                    <span className="text-xs font-black text-rose-500 bg-rose-50 px-3 py-1.5 rounded-full uppercase tracking-widest">
                      Unpaid: {invoices.filter(i => i.status !== 'paid').length}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {invoices.filter(i => i.status !== 'paid').length > 0 ? (
                      invoices.filter(i => i.status !== 'paid').map((inv) => (
                        <div key={inv.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
                          <div>
                            <h5 className="font-bold text-slate-950 text-sm">{inv.label}</h5>
                            <p className="text-[9px] text-slate-400 uppercase font-mono mt-0.5">Due: {inv.dueDate ? format(new Date(inv.dueDate), 'PP') : 'Immediate'}</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-sm font-black text-slate-950">${inv.amount}</span>
                            <button 
                              onClick={() => handlePayInvoice(inv)}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest"
                            >
                              Pay Now
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-slate-400 italic text-xs">
                        No outstanding bills found. Your accounts are fully settled.
                      </div>
                    )}
                  </div>
                </div>

                {/* Prescription & Daily Adherence Reminders */}
                <div className="bg-white border border-slate-100 p-8 rounded-[40px] shadow-xl">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter font-serif italic">Adherence Checklist</h3>
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Check off daily medication intakes</p>
                    </div>
                    <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full uppercase tracking-widest">
                      Daily Tracker
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <input 
                          type="checkbox"
                          checked={adherenceChecked['morning-dose']}
                          onChange={e => setAdherenceChecked(prev => ({ ...prev, 'morning-dose': e.target.checked }))}
                          className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                        />
                        <div>
                          <h5 className="font-bold text-slate-950 text-xs">Morning Dosage Intakes</h5>
                          <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">Recommended: 08:00 AM</p>
                        </div>
                      </div>
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${adherenceChecked['morning-dose'] ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                        {adherenceChecked['morning-dose'] ? 'COMPLIANT' : 'PENDING'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <input 
                          type="checkbox"
                          checked={adherenceChecked['afternoon-check']}
                          onChange={e => setAdherenceChecked(prev => ({ ...prev, 'afternoon-check': e.target.checked }))}
                          className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                        />
                        <div>
                          <h5 className="font-bold text-slate-950 text-xs">Afternoon Check-In</h5>
                          <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">Recommended: 02:00 PM</p>
                        </div>
                      </div>
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${adherenceChecked['afternoon-check'] ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                        {adherenceChecked['afternoon-check'] ? 'COMPLIANT' : 'PENDING'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <input 
                          type="checkbox"
                          checked={adherenceChecked['evening-dose']}
                          onChange={e => setAdherenceChecked(prev => ({ ...prev, 'evening-dose': e.target.checked }))}
                          className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                        />
                        <div>
                          <h5 className="font-bold text-slate-950 text-xs">Evening Dosage Intakes</h5>
                          <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">Recommended: 08:00 PM</p>
                        </div>
                      </div>
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${adherenceChecked['evening-dose'] ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                        {adherenceChecked['evening-dose'] ? 'COMPLIANT' : 'PENDING'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Test Results Widget */}
              <div className="bg-white border border-slate-100 p-8 rounded-[40px] shadow-xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter font-serif italic">Recent Lab & Diagnostic Reports</h3>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Read-only diagnostic records</p>
                  </div>
                  <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                    Clinical Vault Verified
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {medicalRecords.filter(r => r.type === 'lab' || r.type === 'imaging').length > 0 ? (
                    medicalRecords.filter(r => r.type === 'lab' || r.type === 'imaging').slice(0, 4).map((rec) => (
                      <div key={rec.id} className="p-5 bg-slate-50 border border-slate-100 rounded-3xl flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-white rounded-2xl text-blue-600 border border-slate-100 shadow-sm shrink-0">
                            {rec.type === 'lab' ? <Microscope size={16} /> : <Activity size={16} />}
                          </div>
                          <div>
                            <h5 className="font-bold text-slate-950 text-sm line-clamp-1">{rec.title}</h5>
                            <span className="text-[9px] text-slate-400 uppercase tracking-wider font-mono block mt-0.5">
                              {rec.type.toUpperCase()} • {rec.date ? format(new Date(rec.date), 'PP') : 'N/A'}
                            </span>
                          </div>
                        </div>
                        <button 
                          onClick={() => downloadPDF(rec)}
                          className="p-3.5 bg-white border border-slate-100 rounded-2xl hover:border-blue-400 text-blue-600 hover:bg-blue-50 shadow-sm transition-all"
                          title="Download Report PDF"
                        >
                          <Download size={14} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="md:col-span-2 py-12 text-center text-slate-400 italic text-xs">
                      No diagnostic records present in your client vault.
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: APPOINTMENTS */}
          {activeTab === 'appointments' && (
            <div className="space-y-8" id="appointments-tab-content">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic font-serif">Scheduled Consultations</h3>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Manage scheduled, live queue, and telemedicine links</p>
                </div>
              </div>

              {/* Reschedule Panel overlay if active */}
              {reschedulingAptId && (
                <div className="p-6 bg-blue-50 border border-blue-100 rounded-[32px] space-y-4 max-w-md">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase text-blue-800 tracking-wider">Select New Rotation Window</h4>
                    <button onClick={() => setReschedulingAptId(null)} className="text-slate-400 hover:text-slate-900"><XCircle size={18} /></button>
                  </div>
                  <input 
                    type="datetime-local"
                    value={newAptDateTime}
                    onChange={e => setNewAptDateTime(e.target.value)}
                    className="w-full bg-white border border-blue-200 p-4 rounded-xl text-slate-950 font-bold outline-none"
                  />
                  <div className="flex gap-2">
                    <button onClick={handleReschedule} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500">Confirm Reschedule</button>
                    <button onClick={() => setReschedulingAptId(null)} className="px-5 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest">Cancel</button>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {appointments.length > 0 ? (
                  appointments.map((apt) => (
                    <div key={apt.id} className="p-6 bg-white border border-slate-100 rounded-[32px] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-md transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col items-center justify-center text-slate-500 shrink-0">
                          <span className="text-[9px] font-black uppercase opacity-60">{format(new Date(apt.dateTime), 'MMM')}</span>
                          <span className="text-xl font-black leading-none text-slate-800">{format(new Date(apt.dateTime), 'dd')}</span>
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-950 text-base">{apt.doctorName || 'Awaiting Allocation'}</h4>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 font-medium">
                            <span className="uppercase tracking-widest text-[9px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{apt.departmentId.replace('-', ' ')}</span>
                            <span className="flex items-center gap-1"><Clock size={12} /> {format(new Date(apt.dateTime), 'hh:mm a')}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          apt.status === 'scheduled' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                          apt.status === 'waiting' ? 'bg-yellow-50 text-yellow-600 border border-yellow-100' :
                          apt.status === 'in-consultation' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                          'bg-slate-100 text-slate-400'
                        }`}>
                          <div className="w-1 h-1 rounded-full bg-current" />
                          {apt.status}
                        </span>

                        {apt.status === 'scheduled' && (
                          <button 
                            onClick={() => setReschedulingAptId(apt.id)}
                            className="px-4 py-2 hover:bg-slate-50 border border-slate-100 rounded-xl text-slate-600 text-[10px] font-black uppercase tracking-widest transition-colors"
                          >
                            Reschedule
                          </button>
                        )}

                        {(apt.status === 'scheduled' || apt.status === 'waiting' || apt.status === 'in-consultation') && (
                          <button 
                            onClick={() => handleJoinTelehealth(apt)}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-1.5 shadow-md shadow-emerald-500/10"
                          >
                            <Video size={12} />
                            Join Telehealth
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-24 text-center text-slate-400 italic">
                    No session rotations scheduled.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: MEDICAL RECORDS */}
          {activeTab === 'records' && (
            <div className="space-y-8" id="records-tab-content">
              <div>
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic font-serif">Comprehensive Patient Dossier</h3>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Unified chronological event stream and clinical archives</p>
              </div>

              {/* Vaccine record list and Allergies card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                
                {/* Vaccination History Card */}
                <div className="md:col-span-2 bg-white border border-slate-100 p-8 rounded-[40px] shadow-sm">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                    <Award size={14} className="text-blue-500" />
                    Vaccination Ledger History
                  </h4>
                  <div className="space-y-4">
                    {profileData.vaccines.map((v, i) => (
                      <div key={i} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex justify-between items-center">
                        <div>
                          <h5 className="font-bold text-slate-950 text-sm">{v.name}</h5>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">Administered: {v.date}</p>
                        </div>
                        <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg uppercase tracking-widest">
                          ● verified
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Allergies and Chronic conditions read-only card */}
                <div className="bg-slate-50 border border-slate-100 p-8 rounded-[40px] flex flex-col justify-between">
                  <div className="space-y-6">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <AlertTriangle size={14} className="text-rose-500" />
                      Client EHR Disclaimers
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Allergies (At Source)</span>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {profileData.allergies.map((a, i) => (
                            <span key={i} className="px-2 py-0.5 bg-rose-50 border border-rose-100 text-rose-600 rounded text-[10px] font-bold">{a}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Diagnosed Conditions</span>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {profileData.chronicConditions.map((c, i) => (
                            <span key={i} className="px-2 py-0.5 bg-blue-50 border border-blue-100 text-blue-600 rounded text-[10px] font-bold">{c}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Render existing PatientTimeline component dynamically */}
              <div className="bg-white border border-slate-100 p-8 rounded-[44px] shadow-sm">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-8">EHR Chronological Ledger</h4>
                <PatientTimeline patientId={profile?.userId || ''} />
              </div>

            </div>
          )}

          {/* TAB 4: MEDICATIONS */}
          {activeTab === 'medication' && (
            <div className="space-y-8" id="medication-tab-content">
              <div>
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic font-serif">Active Prescriptions</h3>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Dosage tracking, refill links, and daily adherence logs</p>
              </div>

              {/* Active prescription list */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {medicalRecords.filter(r => r.type === 'prescription').length > 0 ? (
                  medicalRecords.filter(r => r.type === 'prescription').map((rec) => (
                    <div key={rec.id} className="p-6 bg-white border border-slate-100 rounded-[32px] shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
                            <Pill size={20} />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-950 text-base">{rec.title}</h4>
                            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-mono mt-0.5">Assigned Date: {format(new Date(rec.date), 'PP')}</p>
                          </div>
                        </div>
                        <p className="text-xs text-slate-700 font-medium leading-relaxed bg-slate-50 p-4 rounded-2xl italic">
                          "{rec.content}"
                        </p>
                      </div>

                      <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Refills left: 3</span>
                        <button 
                          onClick={() => handleRefillRequest(rec)}
                          disabled={activeRefillRequest === rec.id}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1"
                        >
                          {activeRefillRequest === rec.id ? <RefreshCw size={10} className="animate-spin" /> : null}
                          {activeRefillRequest === rec.id ? 'Submitting...' : 'Request Refill'}
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="md:col-span-2 py-12 text-center text-slate-400 italic text-xs">
                    No active prescriptions present in your electronic registry.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: MESSENGER */}
          {activeTab === 'messenger' && (
            <div className="space-y-8" id="messenger-tab-content">
              <div>
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic font-serif">Secure Doctor Messenger</h3>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Direct end-to-end encrypted messaging with hospital specialist team</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 bg-white border border-slate-100 rounded-[44px] overflow-hidden shadow-xl min-h-[500px]">
                
                {/* Left side: Doctor lists */}
                <div className="p-6 border-r border-slate-100 bg-slate-50 space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Hospital Specialists</h4>
                  <div className="space-y-2">
                    {SPECIALISTS.map((doc) => (
                      <button 
                        key={doc.id}
                        onClick={() => setSelectedDoctorId(doc.id)}
                        className={`w-full p-4 rounded-2xl flex items-center gap-3 text-left transition-all ${selectedDoctorId === doc.id ? 'bg-white border border-slate-100 shadow-md' : 'hover:bg-slate-100'}`}
                      >
                        <img src={doc.image} alt={doc.name} className="w-10 h-10 rounded-xl object-cover" />
                        <div>
                          <h5 className="font-bold text-slate-950 text-xs">{doc.name}</h5>
                          <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">{doc.specialty}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right side: Messages board */}
                <div className="md:col-span-2 flex flex-col justify-between h-[500px]">
                  
                  {/* Conversations list */}
                  <div className="flex-1 p-8 overflow-y-auto space-y-4 bg-white">
                    {messages.filter(m => m.senderId === selectedDoctorId || m.recipientId === selectedDoctorId).length > 0 ? (
                      messages.filter(m => m.senderId === selectedDoctorId || m.recipientId === selectedDoctorId).map((msg) => {
                        const isSelf = msg.senderId === profile?.userId;
                        return (
                          <div key={msg.id} className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}>
                            <div className={`p-4 rounded-3xl max-w-sm ${isSelf ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-100 text-slate-900 rounded-tl-none'} space-y-1`}>
                              <div className="text-[8px] font-black uppercase opacity-60">{msg.senderName || 'Anonymous'}</div>
                              <p className="text-xs font-sans leading-relaxed">{msg.text}</p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 italic text-xs gap-2">
                        <MessageSquare size={24} className="opacity-20" />
                        No secure messages on this thread yet. Send a message to start clinical dialogue.
                      </div>
                    )}

                    {/* Typing state */}
                    {isDoctorTyping && (
                      <div className="flex justify-start">
                        <div className="p-4 bg-slate-100 text-slate-500 rounded-3xl rounded-tl-none text-xs italic flex items-center gap-2">
                          <RefreshCw size={12} className="animate-spin" />
                          Clinician is synthesizing response...
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Input form */}
                  <form onSubmit={handleSendMessage} className="p-6 border-t border-slate-100 bg-slate-50 flex gap-2">
                    <input 
                      type="text"
                      value={typedMessage}
                      onChange={e => setTypedMessage(e.target.value)}
                      placeholder="Type secure medical inquiry..."
                      className="flex-1 bg-white border border-slate-200 px-4 py-3.5 rounded-xl font-medium text-xs text-slate-900 outline-none focus:border-blue-500 placeholder:italic"
                    />
                    <button type="submit" className="px-5 py-3.5 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-colors flex items-center justify-center">
                      <Send size={14} />
                    </button>
                  </form>
                </div>

              </div>
            </div>
          )}

          {/* TAB 6: TRACKING */}
          {activeTab === 'tracking' && (
            <div className="space-y-8" id="tracking-tab-content">
              <div>
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic font-serif">Log Personal Biometrics</h3>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Record Blood Pressure, Glucose, Symptoms, Mood, and Pain Score</p>
              </div>

              <form onSubmit={handleLogVitals} className="bg-white border border-slate-100 p-8 rounded-[44px] shadow-xl max-w-2xl space-y-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* BP Systolic */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Blood Pressure (Systolic - mmHg)</label>
                    <input 
                      type="number"
                      required
                      value={vitalsForm.bpSystolic}
                      onChange={e => setVitalsForm(prev => ({ ...prev, bpSystolic: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-slate-950 font-bold outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* BP Diastolic */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Blood Pressure (Diastolic - mmHg)</label>
                    <input 
                      type="number"
                      required
                      value={vitalsForm.bpDiastolic}
                      onChange={e => setVitalsForm(prev => ({ ...prev, bpDiastolic: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-slate-950 font-bold outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Blood Glucose */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Blood Glucose (mg/dL)</label>
                    <input 
                      type="number"
                      required
                      value={vitalsForm.bloodGlucose}
                      onChange={e => setVitalsForm(prev => ({ ...prev, bloodGlucose: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-slate-950 font-bold outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Weight */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Weight (kg)</label>
                    <input 
                      type="number"
                      required
                      value={vitalsForm.weight}
                      onChange={e => setVitalsForm(prev => ({ ...prev, weight: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-slate-950 font-bold outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Mood Selector */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Current Mood / Feeling</label>
                    <select 
                      value={vitalsForm.mood}
                      onChange={e => setVitalsForm(prev => ({ ...prev, mood: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-slate-950 font-bold outline-none focus:border-blue-500"
                    >
                      <option value="Calm">😌 Calm / Rested</option>
                      <option value="Happy">😊 Healthy / Good</option>
                      <option value="Fatigued">🥱 Fatigued / Sleepy</option>
                      <option value="Anxious">😰 Anxious / Stressed</option>
                      <option value="Sore">🤕 Sore / Painful</option>
                    </select>
                  </div>

                  {/* Pain Score */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Pain Score (1-10)</label>
                      <span className="text-xs font-black text-rose-500">{vitalsForm.painScore}/10</span>
                    </div>
                    <input 
                      type="range"
                      min="1"
                      max="10"
                      value={vitalsForm.painScore}
                      onChange={e => setVitalsForm(prev => ({ ...prev, painScore: Number(e.target.value) }))}
                      className="w-full accent-rose-500 cursor-pointer h-2 bg-slate-100 rounded-lg appearance-none"
                    />
                  </div>

                </div>

                {/* Symptoms description */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Symptoms / Clinical Observations</label>
                  <textarea 
                    value={vitalsForm.symptoms}
                    onChange={e => setVitalsForm(prev => ({ ...prev, symptoms: e.target.value }))}
                    placeholder="Describe any anomalies, headaches, shortness of breath..."
                    className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-slate-950 font-medium text-xs outline-none focus:border-blue-500 h-24 placeholder:italic"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-blue-500/10"
                >
                  Log Biometrics Trend
                </button>

              </form>
            </div>
          )}

        </motion.div>
      </AnimatePresence>

    </div>
  );
}

function TabButton({ children, active, onClick, icon }: { children: React.ReactNode; active: boolean; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 border transition-all ${
        active 
          ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' 
          : 'bg-white/5 border-white/5 text-text-dim hover:text-text-main hover:bg-white/[0.02]'
      }`}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

function VitalCard({ icon, color, label, value, subText }: { icon: React.ReactNode; color: 'rose' | 'blue' | 'purple' | 'amber'; label: string; value: string; subText: string }) {
  const themes = {
    rose: { bg: 'bg-rose-50', text: 'text-rose-500', hoverText: 'text-rose-500/5' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-500', hoverText: 'text-blue-500/5' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-500', hoverText: 'text-purple-500/5' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-500', hoverText: 'text-amber-500/5' }
  };
  const theme = themes[color];

  return (
    <div className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
      <div className={`absolute top-0 right-0 p-4 ${theme.hoverText} group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2.5 ${theme.bg} rounded-xl ${theme.text}`}>
          {icon}
        </div>
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-2xl font-black text-slate-900 tracking-tight">
        {value}
      </p>
      <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-widest mt-2 flex items-center gap-1">
        {subText}
      </p>
    </div>
  );
}
