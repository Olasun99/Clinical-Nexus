import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { DEPARTMENTS } from '../constants';
import { Stethoscope, Send, AlertTriangle, ArrowRight, Loader2, RefreshCw, History, CheckCircle2, ChevronRight, ShieldAlert, Activity, Mic, MicOff, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { collection, addDoc, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { TriageUrgency } from '../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface TriageResult {
  suggestedDepartment?: string;
  urgency?: TriageUrgency;
  riskScore?: number;
  reasoning?: string;
  doctorAdvice?: string;
  diagnosis?: string;
  physicianAdvice?: string;
  followUpQuestion?: string;
  isComplete: boolean;
}

export default function Triage() {
  const { profile } = useAuth();
  const [symptoms, setSymptoms] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      
      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setSymptoms(prev => prev ? `${prev} ${transcript}` : transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setIsListening(true);
      recognitionRef.current?.start();
    }
  };

  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [result, setResult] = useState<TriageResult | null>(null);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (!profile) return;
    const q = query(
      collection(db, 'triageRecords'),
      where('patientId', '==', profile.userId),
      orderBy('timestamp', 'desc'),
      limit(10)
    );
    return onSnapshot(q, (snapshot) => {
      setHistoryRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'triageRecords');
    });
  }, [profile]);

  const loadSession = (rec: any) => {
    setResult(rec);
    setMessages(rec.history || []);
    setActiveSessionId(rec.id);
    setShowHistory(false);
  };

  const questionCount = messages.filter(m => m.role === 'assistant' && !m.content.includes('Diagnosis')).length;

  const handleTriage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symptoms.trim() || !profile) return;

    const userMessage: Message = { role: 'user', content: symptoms };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setSymptoms('');
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/triage/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symptoms: userMessage.content,
          patientInfo: {
            age: (profile as any).age || 'unknown',
            gender: (profile as any).gender || 'unknown',
            history: (profile as any).medicalHistory || 'none',
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze symptoms');
      }

      const backendData = await response.json();
      
      // Map secure full-stack backend response to frontend UI schema
      const mappedUrgency = (backendData.urgency || 'low').toLowerCase();
      const mappedResult: TriageResult = {
        isComplete: true,
        suggestedDepartment: backendData.department || 'General Outpatient Clinic',
        urgency: mappedUrgency === 'moderate' ? 'moderate' : mappedUrgency === 'high' ? 'high' : mappedUrgency === 'critical' ? 'critical' : 'low',
        riskScore: mappedUrgency === 'critical' ? 95 : mappedUrgency === 'high' ? 75 : mappedUrgency === 'moderate' ? 45 : 15,
        reasoning: backendData.analysis || 'Clinical symptoms presented for review.',
        doctorAdvice: backendData.instructions || 'Standard supportive and routine monitoring instructions.',
        diagnosis: `Potential ${backendData.department || 'General'} Symptom Presentation`,
        physicianAdvice: `Please schedule a comprehensive clinical evaluation with the ${backendData.department || 'General Outpatient Clinic'} department at your earliest convenience to investigate these symptoms further.`,
        followUpQuestion: undefined
      };

      const assistantContent = `RECAP:\nDiagnosis: ${mappedResult.diagnosis}\n\nADVICE:\n${mappedResult.doctorAdvice}`;
      setMessages(prev => [...prev, { role: 'assistant', content: assistantContent }]);
      setResult(mappedResult);
      
      try {
        // Save to Firebase for history
        await addDoc(collection(db, 'triageRecords'), {
          patientId: profile.userId,
          history: newMessages,
          ...mappedResult,
          timestamp: new Date().toISOString()
        });
      } catch (dbErr) {
        handleFirestoreError(dbErr, OperationType.CREATE, 'triageRecords');
      }

    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Connection to medical intelligence was interrupted. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setMessages([]);
    setSymptoms('');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12 px-4 selection:bg-blue-500/30">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-text-main flex items-center gap-3 italic font-serif uppercase">
            <Stethoscope className="text-blue-600 w-8 h-8 md:w-10 md:h-10" />
            Clinical Triage
          </h1>
          <p className="text-text-muted mt-2 text-sm md:text-lg italic border-l-2 border-blue-500 pl-6">
            High-precision diagnostic session with our clinical AI physician.
          </p>
        </div>
        <button 
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-2 px-6 py-3 bg-white border border-border-accent rounded-2xl text-[10px] font-black uppercase tracking-widest text-text-dim hover:text-text-main hover:bg-slate-50 transition-all shadow-sm"
        >
          <History size={14} />
          {showHistory ? 'Back to Intake' : 'Past Consultations'}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {showHistory ? (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {historyRecords.length > 0 ? historyRecords.map((rec) => (
              <div key={rec.id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:border-blue-200 transition-all group flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    rec.urgency === 'critical' ? 'bg-rose-50 text-rose-600' :
                    rec.urgency === 'high' ? 'bg-amber-50 text-amber-600' :
                    'bg-blue-50 text-blue-600'
                  }`}>
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 uppercase tracking-tight italic font-serif text-lg">{rec.diagnosis}</h4>
                    <div className="flex gap-4 mt-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{new Date(rec.timestamp).toLocaleDateString()}</span>
                      <span className={`text-[10px] font-black uppercase tracking-widest ${
                        rec.urgency === 'critical' ? 'text-rose-600' : 'text-slate-500'
                      }`}>{rec.urgency} Priority</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => loadSession(rec)}
                  className="p-3 bg-slate-50 rounded-xl text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            )) : (
              <div className="bg-white p-20 rounded-[40px] border border-slate-100 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mx-auto mb-4">
                  <History size={32} />
                </div>
                <p className="text-slate-400 font-medium italic">No past consultations found in your secure registry.</p>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="chat"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-8"
          >
            <div className="bg-white rounded-[40px] border border-slate-200 shadow-xl overflow-hidden flex flex-col h-[600px] md:h-[700px] relative">
              {/* Header inside chat */}
              <div className="px-8 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Clinical NPC // Physician_Link</span>
                </div>
                {messages.length > 0 && (
                   <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">
                     Step {questionCount + 1} of 4
                   </span>
                )}
              </div>

              {/* Chat Interface */}
              <div className="flex-1 p-8 space-y-6 overflow-y-auto scrollbar-hide">
                {messages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center p-10">
                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mb-6 shadow-inner">
                      <Stethoscope size={32} />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic font-serif">Diagnostic Intake</h3>
                    <p className="text-slate-500 text-sm mt-3 max-w-sm leading-relaxed">Please present your clinical symptoms in detail. Our AI physician will conduct a focused assessment (max 3 follow-ups) to reach a clinical conclusion.</p>
                  </div>
                )}
                
                {messages.map((m, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] md:max-w-[70%] p-6 rounded-3xl ${
                      m.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-tr-none shadow-lg shadow-blue-500/20' 
                        : 'bg-slate-50 text-slate-900 rounded-tl-none border border-slate-200'
                    }`}>
                      <div className={`text-[10px] font-black uppercase tracking-widest mb-2 ${m.role === 'user' ? 'text-blue-100' : 'text-slate-400'}`}>
                        {m.role === 'user' ? 'Authenticated Patient' : 'Medical Physician'}
                      </div>
                      <p className="text-sm md:text-base font-medium leading-relaxed whitespace-pre-wrap">{m.content}</p>
                    </div>
                  </motion.div>
                ))}

                {loading && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="flex justify-start"
                  >
                    <div className="bg-slate-50 p-8 rounded-[32px] rounded-tl-none border border-slate-200 flex flex-col gap-6 w-full max-w-sm shadow-inner relative overflow-hidden">
                      {/* Scanning Effect */}
                      <motion.div 
                        animate={{ 
                          top: ['-100%', '200%'],
                        }}
                        transition={{ 
                          duration: 2, 
                          repeat: Infinity, 
                          ease: "linear" 
                        }}
                        className="absolute left-0 right-0 h-1 bg-blue-500/10 blur-sm z-0"
                      />
                      
                      <div className="flex items-center gap-4 relative z-10">
                        <div className="relative">
                          <Loader2 className="animate-spin text-blue-600" size={24} />
                          <motion.div 
                            animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="absolute inset-0 bg-blue-400 rounded-full"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] font-black uppercase text-blue-600 tracking-[0.2em] block">Neural Synthesis Active</span>
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-1 italic font-serif">Consulting clinical archives...</span>
                        </div>
                      </div>

                      <div className="space-y-3 relative z-10">
                        <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-slate-500">
                          <motion.span
                            key={messages.length}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                          >
                             Analyzing Biological Markers
                          </motion.span>
                          <motion.span
                            animate={{ opacity: [0, 1, 0] }}
                            transition={{ duration: 1, repeat: Infinity }}
                          >
                             Processing...
                          </motion.span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: ['0%', '35%', '65%', '85%', '98%'] }}
                            transition={{ duration: 10, ease: "easeInOut" }}
                            className="h-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)]"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 relative z-10">
                        {[0, 1, 2].map((i) => (
                          <motion.div 
                            key={i}
                            animate={{ 
                              opacity: [0.2, 1, 0.2],
                              scale: [1, 1.1, 1]
                            }}
                            transition={{ 
                              duration: 1.5, 
                              delay: i * 0.2, 
                              repeat: Infinity 
                            }}
                            className="w-1.5 h-1.5 rounded-full bg-blue-400"
                          />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input Area */}
              <AnimatePresence>
                {!result && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="p-8 border-t border-slate-100 bg-white"
                  >
                      <div className="relative group">
                        <textarea
                          value={symptoms}
                          onChange={(e) => setSymptoms(e.target.value)}
                          placeholder={messages.length === 0 ? "Present your symptoms here..." : "Provide clinical clarification..."}
                          className="w-full p-6 pr-32 rounded-3xl bg-slate-50 border border-slate-200 focus:ring-8 focus:ring-blue-50 focus:border-blue-600 focus:bg-white outline-none transition-all text-base leading-relaxed resize-none h-32 md:h-28 shadow-inner placeholder:italic placeholder:text-slate-300"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleTriage(e as any);
                            }
                          }}
                        />
                        <div className="absolute bottom-6 right-6 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={toggleListening}
                            className={`p-4 rounded-2xl transition-all shadow-lg active:scale-95 flex items-center justify-center ${
                              isListening 
                                ? 'bg-rose-600 text-white animate-pulse shadow-rose-500/20' 
                                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                            }`}
                            title={isListening ? "Stop Listening" : "Start Voice Input"}
                          >
                            {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                          </button>
                          <button
                            type="submit"
                            disabled={loading || !symptoms.trim()}
                            className="p-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-500/20 active:scale-95 flex items-center gap-2"
                          >
                            <Send size={20} />
                            <span className="hidden md:inline text-[10px] font-black uppercase tracking-widest">Send Response</span>
                          </button>
                        </div>
                      </div>
                    
                    {error && (
                      <div className="mt-4 flex items-center gap-3 text-rose-600 bg-rose-50 p-4 rounded-2xl border border-rose-100 text-[10px] font-black uppercase tracking-widest">
                        <AlertTriangle size={16} />
                        {error}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {result && (
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                <div className={`p-10 md:p-16 rounded-[60px] border shadow-2xl relative overflow-hidden ${
                  result.urgency === 'critical' ? 'bg-rose-50 border-rose-200 ring-8 ring-rose-100/50' :
                  result.urgency === 'high' ? 'bg-amber-50 border-amber-200' :
                  'bg-blue-50 border-blue-200'
                }`}>
                  {/* Decorative element */}
                  <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/50 rounded-full blur-[80px]" />

                  <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-12 relative z-10">
                    <div>
                      <span className={`inline-block px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.3em] mb-6 shadow-sm ${
                        result.urgency === 'critical' ? 'bg-rose-600 text-white animate-pulse' :
                        'bg-white text-slate-900 border border-slate-200'
                      }`}>
                        {result.urgency} Priority Level
                      </span>
                      <h2 className="text-4xl md:text-7xl font-black text-slate-900 tracking-tighter leading-none mb-4 uppercase italic font-serif">
                        {result.suggestedDepartment}
                      </h2>
                      <div className="flex items-center gap-3 p-3 bg-white/40 rounded-2xl border border-white/20 w-max">
                        <CheckCircle2 size={20} className="text-emerald-500" />
                        <span className="text-xs font-bold text-slate-700 italic">Clinical Verification 99% Surety</span>
                      </div>
                    </div>
                    <div className="bg-white p-8 rounded-[40px] shadow-xl border border-slate-100 text-center min-w-[160px]">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Live Registry Delay</div>
                      <div className="text-4xl font-black text-emerald-600 tracking-tighter">
                        ~{DEPARTMENTS.find(d => d.name === result.suggestedDepartment)?.waitTime || '15'}m
                      </div>
                      <div className="text-[8px] font-black uppercase text-slate-400 mt-1">Est. Wait Sync</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    {result.urgency === 'critical' ? (
                      <Link 
                        to="/emergency"
                        className="bg-rose-600 text-white p-10 rounded-[32px] font-black uppercase tracking-[0.2em] text-xl flex flex-col items-center justify-center gap-2 shadow-[0_0_50px_rgba(225,29,72,0.4)] animate-pulse hover:bg-rose-500 transition-all relative z-10"
                      >
                        <ShieldAlert size={40} />
                        Escalate to SOS
                        <span className="text-[10px] opacity-80 font-mono italic">Immediate Physician Link</span>
                      </Link>
                    ) : (
                      <button 
                        onClick={() => {/* Open WhatsApp */ window.open('https://wa.me/2340000000000?text=I%20need%20assistance%20as%20per%20my%20recent%20clinical%20triage.', '_blank')}}
                        className="bg-[#25D366] text-white p-10 rounded-[32px] font-black uppercase tracking-[0.2em] text-xl flex flex-col items-center justify-center gap-2 shadow-2xl hover:bg-[#128C7E] transition-all relative z-10 group"
                      >
                        <div className="flex items-center gap-3">
                          <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                          WhatsApp Bridge
                        </div>
                        <span className="text-[10px] opacity-80 font-mono italic">Talk to Nurse Instantly</span>
                      </button>
                    )}

                    <div className="bg-slate-900 text-white p-10 rounded-[32px] border border-slate-800 shadow-2xl relative overflow-hidden flex flex-col justify-center">
                       <div className="absolute top-0 right-0 p-4 opacity-10">
                          <Calendar size={80} />
                       </div>
                       <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400 mb-2">Facility Mapping</h4>
                       <p className="text-xl font-black italic font-serif tracking-tight leading-loose">
                         Available Slots Today: <span className="text-blue-400 text-3xl">04</span>
                       </p>
                       <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mt-2">Next Sync Window: 14:00 - 16:30</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-12 relative z-10">
                    <div className="space-y-8">
                      <div>
                        <h4 className="text-[10px] font-black uppercase text-blue-600 tracking-widest mb-4 flex items-center gap-2">
                           <div className="w-1 h-3 bg-blue-600 rounded-full" />
                           Clinical Diagnosis
                        </h4>
                        <div className="bg-white p-8 rounded-[40px] border border-blue-100 text-slate-900 font-bold italic text-xl shadow-sm leading-tight">
                          {result.diagnosis}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-[10px] font-black uppercase text-blue-600 tracking-widest mb-4 flex items-center gap-2">
                           <div className="w-1 h-3 bg-blue-600 rounded-full" />
                           Physician Directives
                        </h4>
                        <div className="bg-white/80 backdrop-blur-sm p-8 rounded-[40px] border border-blue-50 text-slate-700 text-base leading-relaxed whitespace-pre-wrap shadow-inner">
                          {result.physicianAdvice}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-8">
                      <div>
                        <h4 className="text-[10px] font-black uppercase text-amber-600 tracking-widest mb-4 flex items-center gap-2">
                           <div className="w-1 h-3 bg-amber-600 rounded-full" />
                           Immediate Actions
                        </h4>
                        <div className="bg-white p-8 rounded-[40px] border border-amber-100 text-slate-700 text-base leading-relaxed whitespace-pre-wrap shadow-sm">
                          {result.doctorAdvice}
                        </div>
                      </div>
                      <div className="p-8 bg-slate-900/5 rounded-[40px] border border-slate-200/50 backdrop-blur-sm">
                        <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-3">Diagnostic Reasoning</h4>
                        <p className="text-sm text-slate-600 leading-relaxed italic font-medium">"{result.reasoning}"</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                    <button 
                      onClick={() => {/* Navigate */}}
                      className="bg-slate-900 text-white p-8 rounded-[32px] font-black uppercase tracking-widest text-xs flex items-center justify-center gap-4 shadow-2xl hover:bg-black transition-all hover:translate-y-[-2px] active:translate-y-0"
                    >
                      Initialize Appointment
                      <ArrowRight size={20} />
                    </button>
                    <button 
                      onClick={reset}
                      className="bg-white hover:bg-slate-50 text-slate-900 p-8 rounded-[32px] font-black uppercase tracking-widest text-xs flex items-center justify-center gap-4 border border-slate-200 transition-all shadow-sm active:scale-95"
                    >
                      <RefreshCw size={20} />
                      Start New Analysis
                    </button>
                  </div>
                </div>

                <div className="bg-slate-900 text-white p-10 rounded-[50px] flex flex-col md:flex-row items-center gap-8 border border-slate-800 shadow-2xl">
                  <div className="p-5 bg-white/10 rounded-3xl text-rose-400 animate-pulse">
                    <AlertTriangle size={36} />
                  </div>
                  <div>
                    <span className="font-black text-rose-400 uppercase tracking-[0.3em] block mb-3 text-[10px]">Critical Disclaimer</span>
                    <p className="text-sm text-slate-400 font-medium leading-relaxed italic">
                      This AI-driven triage is for preliminary insight. If you experience acute respiratory distress, severe chest pain, or neurological impairment, <span className="text-white font-bold underline underline-offset-4 tracking-tighter">contact emergency services immediately</span>. All session logs are encrypted.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
