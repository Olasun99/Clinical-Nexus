import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { MedicalRecord } from '../types';
import { format } from 'date-fns';
import { GoogleGenAI } from '@google/genai';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { medicalRecordSchema, MedicalRecordFormValues } from '../lib/validation';
import { jsPDF } from 'jspdf';
import { useSearchParams } from 'react-router-dom';
import DoctorConsultationWorkspace from '../components/DoctorConsultationWorkspace';
import { 
  FileText, 
  Search, 
  Plus, 
  Download, 
  Eye, 
  Activity, 
  Microscope, 
  Pill,
  ChevronRight,
  Filter,
  X,
  AlertTriangle,
  Sparkles,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { createNotification } from '../hooks/useNotifications';
import { logAction } from '../lib/audit';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export default function Records() {
  const { profile, isDoctor, isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activePatientId = searchParams.get('patientId');
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [intakeForms, setIntakeForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'records' | 'intake'>('records');
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  
  // Real-time live consultation queue
  const [waitingQueue, setWaitingQueue] = useState<any[]>([]);

  // AI Summary State
  const [summarizing, setSummarizing] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Record<string, string>>({});

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<MedicalRecordFormValues>({
    resolver: zodResolver(medicalRecordSchema),
    defaultValues: {
      type: 'note',
      patientId: '',
      title: '',
      content: ''
    }
  });

  useEffect(() => {
    if (!profile) return;

    const recordsRef = collection(db, 'medicalRecords');
    let q;
    
    if (isAdmin || isDoctor) {
      q = query(recordsRef, orderBy('date', 'desc'));
    } else {
      q = query(recordsRef, where('patientId', '==', profile.userId), orderBy('date', 'desc'));
    }

    const unsubscribeRecords = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MedicalRecord));
      setRecords(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'medicalRecords');
    });

    // If doctor or admin, also watch intake forms and the Live Waitlist/Check-in queue
    let unsubscribeIntake: any;
    let unsubscribeQueue: any;
    if (isDoctor || isAdmin) {
      const intakeRef = collection(db, 'intakeForms');
      const qi = query(intakeRef, orderBy('timestamp', 'desc'));
      unsubscribeIntake = onSnapshot(qi, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setIntakeForms(docs);
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'intakeForms');
      });

      const qQueue = query(
        collection(db, 'appointments'),
        where('status', 'in', ['waiting', 'in-consultation'])
      );
      unsubscribeQueue = onSnapshot(qQueue, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setWaitingQueue(docs);
      });
    } else {
      setLoading(false);
    }

    return () => {
      unsubscribeRecords();
      if (unsubscribeIntake) unsubscribeIntake();
      if (unsubscribeQueue) unsubscribeQueue();
    };
  }, [profile, isDoctor, isAdmin]);

  const handleStartConsultation = async (apptId: string, patientId: string) => {
    try {
      await updateDoc(doc(db, 'appointments', apptId), {
        status: 'in-consultation',
        doctorId: profile?.userId || '',
        doctorName: profile?.name || 'Attending Physician'
      });
      setSearchParams({ patientId });
    } catch (err) {
      console.error("Failed to start consultation:", err);
    }
  };

  const approveIntake = async (intakeId: string) => {
    try {
      const intake = intakeForms.find(f => f.id === intakeId);
      await updateDoc(doc(db, 'intakeForms', intakeId), { status: 'verified' });
      
      if (intake && profile) {
        await logAction(profile.userId, profile.name, 'VERIFY_INTAKE', 'Medical Records', `Verified intake form for ${intake.fullName} (${intakeId})`);
        await createNotification(intake.userId, {
          title: 'Intake Verified',
          message: 'Your bio-intake form has been reviewed and verified by the clinical staff.',
          type: 'success'
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `intakeForms/${intakeId}`);
    }
  };

  const summarizeRecord = async (record: MedicalRecord) => {
    if (summarizing === record.id || summaries[record.id]) return;
    setSummarizing(record.id);

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ 
          role: 'user', 
          parts: [{ 
            text: `Perform a high-fidelity clinical synthesis of the following medical record. 
            Highlight key diagnostic findings, prescribed interventions, and any critical anomalies.
            Provide exactly 3 bullet points.
            
            Title: ${record.title}
            Type: ${record.type}
            Content: ${record.content}` 
          }] 
        }],
        config: {
          systemInstruction: "You are an expert clinical auditor. Synthesize medical records into high-impact, actionable insights for physicians.",
          temperature: 0.2,
        },
      });

      setSummaries(prev => ({ ...prev, [record.id!]: response.text || "Summary unavailable." }));
    } catch (err) {
      console.error("AI Summary error:", err);
    } finally {
      setSummarizing(null);
    }
  };

  const downloadPDF = (record: MedicalRecord) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('OLASUN MEDICAL RECORD', 20, 25);
    
    doc.setFontSize(10);
    doc.text(`DATE GENERATED: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`, 20, 32);
    
    // Body
    doc.setTextColor(33, 37, 41);
    doc.setFontSize(18);
    doc.text(record.title.toUpperCase(), 20, 60);
    
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 65, pageWidth - 20, 65);
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    const recordDate = record.date ? new Date(record.date) : new Date();
    const formattedDate = isNaN(recordDate.getTime()) ? 'Date Unknown' : format(recordDate, 'MMMM do, yyyy');
    doc.text(`Type: ${record.type.toUpperCase()}`, 20, 75);
    doc.text(`Date of Record: ${formattedDate}`, 20, 82);
    doc.text(`Patient ID: ${record.patientId}`, 20, 89);
    
    doc.setFont('helvetica', 'bold');
    doc.text('CLINICAL CONTENT:', 20, 105);
    
    doc.setFont('helvetica', 'normal');
    const splitText = doc.splitTextToSize(record.content, pageWidth - 40);
    doc.text(splitText, 20, 115);
    
    // Footer
    const footerText = 'This is a secure clinical document generated via the OlaSun platform.';
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(footerText, pageWidth / 2, 280, { align: 'center' });
    
    doc.save(`OlaSun_Record_${record.id}.pdf`);
  };

  const onAddRecord = async (data: MedicalRecordFormValues) => {
    if (!profile) return;

    try {
      const docRef = await addDoc(collection(db, 'medicalRecords'), {
        ...data,
        doctorId: profile.userId,
        date: new Date().toISOString()
      });

      await logAction(profile.userId, profile.name, 'CREATE_RECORD', 'Medical Records', `Created ${data.type} record "${data.title}" (ID: ${docRef.id}) for patient ${data.patientId}`);

      if (isDoctor && data.patientId !== profile.userId) {
        await createNotification(data.patientId, {
          title: 'New Medical Record',
          message: `A new ${data.type} record "${data.title}" has been added to your profile.`,
          type: 'info'
        });
      }

      setShowAdd(false);
      reset();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'medicalRecords');
    }
  };

  const filteredRecords = React.useMemo(() => {
    return records.filter(r => {
      const matchesSearch = r.title.toLowerCase().includes(search.toLowerCase()) || 
                           r.content.toLowerCase().includes(search.toLowerCase());
      const matchesType = filterType === 'all' || r.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [records, search, filterType]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'lab': return <Microscope className="text-blue-400" />;
      case 'imaging': return <Activity className="text-purple-400" />;
      case 'prescription': return <Pill className="text-emerald-400" />;
      default: return <FileText className="text-text-dim" />;
    }
  };

  const safeFormatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? 'N/A' : format(d, 'MMM d, yyyy');
    } catch {
      return 'N/A';
    }
  };

  const accentColor = isDoctor || isAdmin ? 'emerald' : 'blue';
  const themeClasses = {
    bg: accentColor === 'emerald' ? 'bg-emerald-600' : 'bg-blue-600',
    hoverBg: accentColor === 'emerald' ? 'hover:bg-emerald-700' : 'hover:bg-blue-700',
    shadow: accentColor === 'emerald' ? 'shadow-emerald-500/20' : 'shadow-blue-500/20',
    text: accentColor === 'emerald' ? 'text-emerald-500' : 'text-blue-500',
    border: accentColor === 'emerald' ? 'border-emerald-500/30' : 'border-blue-500/30',
    lightBg: accentColor === 'emerald' ? 'bg-emerald-500/10' : 'bg-blue-500/10',
    ring: accentColor === 'emerald' ? 'focus:ring-emerald-600/50' : 'focus:ring-blue-600/50',
  };

  if ((isDoctor || isAdmin) && activePatientId) {
    return (
      <div className="pb-20">
        <DoctorConsultationWorkspace 
          patientId={activePatientId} 
          onBack={() => setSearchParams({})}
        />
      </div>
    );
  }

  return (
    <div className={`space-y-8 selection:bg-${accentColor}-500/30`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-text-main uppercase tracking-[0.05em] italic font-serif">Medical Records</h1>
          <p className="text-text-muted mt-2 font-medium italic opacity-70 border-l-2 border-emerald-500 pl-6">Unified clinical history and patient intake verification.</p>
        </div>
        <div className="flex gap-4">
          {(isDoctor || isAdmin) && (
            <div className="bg-white p-1 rounded-2xl border border-border-accent flex shadow-sm">
              <button 
                onClick={() => setViewMode('records')}
                className={`px-6 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${viewMode === 'records' ? 'bg-emerald-600 text-white shadow-md' : 'text-text-dim hover:text-text-main'}`}
              >
                Patient Records
              </button>
              <button 
                onClick={() => setViewMode('intake')}
                className={`px-6 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${viewMode === 'intake' ? 'bg-rose-600 text-white shadow-md' : 'text-text-dim hover:text-text-main'}`}
              >
                Intake Review ({intakeForms.filter(f => f.status === 'pending_review').length})
              </button>
            </div>
          )}
          {(isDoctor || isAdmin) && (
            <button
              onClick={() => setShowAdd(true)}
              className={`${themeClasses.bg} text-white px-8 py-4 rounded-xl font-black flex items-center justify-center gap-3 shadow-lg ${themeClasses.shadow} ${themeClasses.hoverBg} transition-all active:scale-95 uppercase tracking-widest text-xs`}
            >
              <Plus size={20} />
              Add Record
            </button>
          )}
        </div>
      </div>

      {viewMode === 'records' ? (
        <>
          {/* Real-time Live Consultation Waitlist Queue */}
          {(isDoctor || isAdmin) && waitingQueue.length > 0 && (
            <div className="bg-card-bg border border-border-accent rounded-[32px] p-6 space-y-4 shadow-sm mb-6">
              <div className="flex items-center justify-between border-b border-border-accent pb-3">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <h3 className="text-xs font-black uppercase tracking-widest text-text-main">
                    Live Clinic Waitlist Queue ({waitingQueue.length})
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-text-dim uppercase tracking-wider">RECEPTION INTAKE ACTIVE</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {waitingQueue.map((appt) => (
                  <div key={appt.id} className="bg-inner-bg p-4 border border-border-accent/40 rounded-2xl flex flex-col justify-between gap-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-black rounded-md uppercase tracking-wider">
                            {appt.queueNumber || 'Q-N/A'}
                          </span>
                          <span className="text-xs font-black text-text-main truncate max-w-[130px]">{appt.patientName}</span>
                        </div>
                        <p className="text-[11px] text-text-muted mt-1 italic line-clamp-1">"{appt.symptoms || 'General wellness review'}"</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${appt.status === 'in-consultation' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                        {appt.status}
                      </span>
                    </div>
                    <button 
                      onClick={() => handleStartConsultation(appt.id, appt.patientId)}
                      className={`w-full py-2.5 ${appt.status === 'in-consultation' ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'} rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-sm`}
                    >
                      {appt.status === 'in-consultation' ? 'Resume Consultation' : 'Open Consultation'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search & Filter Bar */}
          <div className="bg-card-bg p-4 rounded-[32px] border border-border-accent shadow-xl flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-text-dim" size={20} />
              <input 
                type="text" 
                placeholder="Query clinical archives..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`w-full pl-16 pr-8 py-4 rounded-2xl bg-inner-bg border border-border-accent ${themeClasses.ring} focus:border-opacity-50 outline-none transition-all font-medium text-text-main placeholder:text-text-dim`}
              />
            </div>
            <div className="relative group">
              <select 
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="appearance-none px-8 py-4 pr-12 rounded-2xl border border-white/10 bg-white/5 font-black text-xs uppercase tracking-widest text-text-muted hover:bg-white/10 hover:text-text-main transition-all outline-none cursor-pointer"
              >
                <option value="all" className="bg-slate-900">All Records</option>
                <option value="note" className="bg-slate-900">Clinical Notes</option>
                <option value="lab" className="bg-slate-900">Lab Reports</option>
                <option value="imaging" className="bg-slate-900">Imaging Reports</option>
                <option value="prescription" className="bg-slate-900">Prescriptions</option>
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-text-dim pointer-events-none" size={16} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <AnimatePresence>
              {filteredRecords.map((record) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  key={record.id}
                  className={`bg-card-bg p-8 rounded-[32px] border border-border-accent shadow-2xl hover:${themeClasses.border} transition-all cursor-pointer group flex flex-col justify-between`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <div className={`p-3.5 bg-inner-bg rounded-2xl group-hover:${themeClasses.lightBg} transition-colors border border-border-accent`}>
                        {getIcon(record.type)}
                      </div>
                      <span className="text-[10px] font-black uppercase text-text-dim tracking-widest">{safeFormatDate(record.date)}</span>
                    </div>
                    <h3 className={`text-xl font-bold text-text-main group-hover:${themeClasses.text} transition-colors mb-3 tracking-tight`}>{record.title}</h3>
                    <p className="text-text-muted text-sm line-clamp-3 leading-relaxed mb-4 font-medium font-sans opacity-80 italic">
                      {record.content}
                    </p>

                    <AnimatePresence>
                      {summaries[record.id!] && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className={`mb-8 p-4 ${themeClasses.lightBg} border ${themeClasses.border} rounded-2xl`}
                        >
                          <div className={`text-[10px] font-black uppercase ${themeClasses.text} tracking-widest mb-2 flex items-center gap-2`}>
                             <Sparkles size={12} />
                             AI Synthesis
                          </div>
                          <p className="text-xs text-text-main font-medium italic leading-relaxed whitespace-pre-line">
                            {summaries[record.id!]}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  
                  <div className="flex items-center justify-between pt-8 border-t border-border-accent/30">
                    <div className="flex -space-x-2">
                      <div className={`px-3 py-1 rounded-lg border border-border-accent bg-inner-bg flex items-center justify-center text-[10px] font-black uppercase ${themeClasses.text} shadow-lg`}>
                       NODE: {record.patientId.slice(0, 6).toUpperCase()}
                      </div>
                    </div>
                    <div className="flex gap-2">
                       <button 
                         onClick={(e) => {
                           e.stopPropagation();
                           summarizeRecord(record);
                         }}
                         disabled={summarizing === record.id}
                         className={`p-2.5 text-text-dim hover:${themeClasses.text} hover:${themeClasses.lightBg} rounded-xl transition-all border border-transparent hover:${themeClasses.border} disabled:opacity-50`}
                         title="AI Summary"
                       >
                         <Sparkles size={18} className={summarizing === record.id ? 'animate-pulse' : ''} />
                       </button>
                       <button className={`p-2.5 text-text-dim hover:${themeClasses.text} hover:${themeClasses.lightBg} rounded-xl transition-all border border-transparent hover:${themeClasses.border}`}><Eye size={18} /></button>
                       <button 
                         onClick={(e) => {
                           e.stopPropagation();
                           downloadPDF(record);
                         }}
                         className="p-2.5 text-text-dim hover:text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-all border border-transparent hover:border-emerald-500/20"
                       >
                         <Download size={18} />
                       </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      ) : (
        <div className="space-y-6">
           {intakeForms.map((form) => (
             <div key={form.id} className="bg-card-bg border border-border-accent rounded-[32px] p-8 flex flex-col md:flex-row gap-8 hover:border-rose-300 transition-all group shadow-sm relative overflow-hidden">
                {form.status === 'pending_review' && <div className="absolute top-0 right-0 px-6 py-2 bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest rounded-bl-2xl">Needs Review</div>}
                <div className="flex-1 space-y-6">
                   <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-900 border border-border-accent font-black text-xl">
                         {form.fullName[0]}
                      </div>
                      <div>
                         <h4 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic font-serif">{form.fullName}</h4>
                         <div className="flex gap-4 mt-1 text-slate-500">
                            <span className="text-[10px] font-black uppercase tracking-widest">DOB: {form.dob}</span>
                            <span className="text-[10px] font-black uppercase tracking-widest">GENDER: {form.gender}</span>
                            <span className="text-[10px] font-black uppercase tracking-widest">BLOOD: {form.bloodType}</span>
                         </div>
                      </div>
                   </div>
                   <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="text-[10px] font-black uppercase text-rose-600 tracking-widest mb-2 flex items-center gap-2">
                         <AlertTriangle size={12} />
                         Primary Concern
                      </div>
                      <p className="text-slate-900 font-medium italic">"{form.primaryConcern}"</p>
                      <div className="mt-4 flex gap-6 text-[10px] font-black uppercase tracking-widest text-slate-400">
                         <span>Duration: {form.duration}</span>
                         <span>Pain: {form.painLevel}/10</span>
                      </div>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <DataBit label="Allergies" value={form.allergies || 'None recorded'} />
                      <DataBit label="Meds" value={form.medications || 'None recorded'} />
                   </div>

                   {form.images && form.images.length > 0 && (
                     <div className="space-y-3">
                        <div className="text-[10px] font-black uppercase text-blue-600 tracking-widest pl-1">Diagnostic Attachments</div>
                        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                           {form.images.map((img: string, i: number) => (
                             <img 
                               key={i} 
                               src={img} 
                               alt="Patient attachment" 
                               className="w-32 h-32 rounded-2xl object-cover border border-slate-200 hover:border-blue-400 transition-all cursor-zoom-in"
                               onClick={() => window.open(img, '_blank')}
                             />
                           ))}
                        </div>
                     </div>
                   )}
                </div>
                <div className="md:w-64 flex flex-col gap-3 justify-end">
                   {form.status === 'pending_review' ? (
                     <>
                        <button 
                          onClick={() => approveIntake(form.id)}
                          className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-emerald-700 transition-all shadow-md shadow-emerald-500/20"
                        >
                          Verify Intake
                        </button>
                        <button className="w-full py-4 bg-slate-100 text-slate-600 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-rose-50 hover:text-rose-600 border border-slate-200 transition-all">
                          Decline
                        </button>
                     </>
                   ) : (
                     <div className="py-4 bg-emerald-50 text-emerald-600 rounded-xl font-black uppercase tracking-widest text-[10px] text-center border border-emerald-100">
                        Status: Verified
                     </div>
                   )}
                </div>
             </div>
           ))}
           {intakeForms.length === 0 && (
             <div className="p-20 text-center text-text-dim italic">No biometric intake records found in registry.</div>
           )}
        </div>
      )}

      {filteredRecords.length === 0 && !loading && (
        <div className="p-20 text-center text-text-dim">
           <FileText className="mx-auto mb-4 opacity-10" size={64} />
           <p className="text-xl font-medium italic">No clinical assets found in vault.</p>
        </div>
      )}

      {/* Add Record Modal */}
      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col border border-border-accent"
            >
              <div className="p-8 border-b border-border-accent flex justify-between items-center bg-slate-50">
                <h3 className="text-2xl font-black tracking-tighter text-slate-900 italic font-serif">Add Medical Record</h3>
                <button onClick={() => setShowAdd(false)} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-all"><X /></button>
              </div>
              <form onSubmit={handleSubmit(onAddRecord)} className="p-10 space-y-8 overflow-y-auto">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Record Type</label>
                    <select 
                      {...register('type')}
                      className={`w-full p-5 rounded-2xl bg-white border ${errors.type ? 'border-rose-500' : 'border-slate-200'} font-bold outline-none text-slate-900 focus:ring-2 focus:ring-blue-500/20`}
                    >
                      <option value="note">Clinical Note</option>
                      <option value="lab">Lab Results</option>
                      <option value="imaging">Imaging Report</option>
                      <option value="prescription">Prescription</option>
                    </select>
                    {errors.type && <p className="text-[10px] text-rose-500 font-bold uppercase pl-1">{errors.type.message}</p>}
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Patient ID</label>
                    <input 
                      type="text" 
                      placeholder="e.g. USER_ID"
                      {...register('patientId')}
                      className={`w-full p-5 rounded-2xl bg-white border ${errors.patientId ? 'border-rose-500' : 'border-slate-200'} font-bold outline-none text-slate-900 focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-300`} 
                    />
                    {errors.patientId && <p className="text-[10px] text-rose-500 font-bold uppercase pl-1">{errors.patientId.message}</p>}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Record Title</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Monthly Checkup"
                    {...register('title')}
                    className={`w-full p-5 rounded-2xl bg-white border ${errors.title ? 'border-rose-500' : 'border-slate-200'} font-bold outline-none text-slate-900 focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-300`} 
                  />
                  {errors.title && <p className="text-[10px] text-rose-500 font-bold uppercase pl-1">{errors.title.message}</p>}
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Clinical Observations</label>
                  <textarea 
                    placeholder="Enter detailed clinical findings..."
                    {...register('content')}
                    className={`w-full p-5 rounded-2xl bg-white border ${errors.content ? 'border-rose-500' : 'border-slate-200'} font-medium outline-none text-slate-900 focus:ring-2 focus:ring-blue-500/20 h-48 placeholder:text-slate-300 placeholder:italic`} 
                  />
                  {errors.content && <p className="text-[10px] text-rose-500 font-bold uppercase pl-1">{errors.content.message}</p>}
                </div>

                <div className="pt-4 flex gap-4 sticky bottom-0 bg-white">
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="flex-1 bg-blue-600 text-white py-6 rounded-3xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Protocol Syncing...' : 'Save to History'}
                  </button>
                  <button type="button" onClick={() => setShowAdd(false)} className="px-10 bg-slate-100 text-slate-600 rounded-3xl font-bold hover:bg-slate-200 transition-all border border-slate-200">Cancel</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DataBit({ label, value }: any) {
  return (
    <div>
       <div className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">{label}</div>
       <div className="text-xs font-bold text-slate-700 italic">{value}</div>
    </div>
  );
}
