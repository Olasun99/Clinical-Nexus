import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Appointment, MedicalRecord, Transaction, Invoice } from '../types';
import { 
  Calendar, 
  FileText, 
  CreditCard, 
  Clock, 
  ArrowUpRight, 
  ArrowDownLeft, 
  CheckCircle2, 
  FileSpreadsheet, 
  Filter, 
  TrendingUp, 
  Eye, 
  DollarSign, 
  Activity, 
  User, 
  ShieldCheck, 
  AlertCircle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PatientTimelineProps {
  patientId: string;
}

type TimelineItemType = 'visit' | 'payment' | 'appointment';

interface TimelineEvent {
  id: string;
  type: TimelineItemType;
  date: Date;
  title: string;
  subtitle: string;
  details: string;
  amount?: number;
  status?: string;
  extra?: any;
}

export default function PatientTimeline({ patientId }: PatientTimelineProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'visits' | 'payments' | 'appointments'>('all');

  useEffect(() => {
    if (!patientId) return;
    setLoading(true);

    // 1. Appointments Query
    const aptQuery = query(
      collection(db, 'appointments'),
      where('patientId', '==', patientId)
    );

    // 2. Medical Records Query
    const recordsQuery = query(
      collection(db, 'medicalRecords'),
      where('patientId', '==', patientId)
    );

    // 3. Transactions Query
    const txQuery = query(
      collection(db, 'transactions'),
      where('userId', '==', patientId)
    );

    // 4. Invoices Query
    const invQuery = query(
      collection(db, 'invoices'),
      where('userId', '==', patientId)
    );

    const unsubApt = onSnapshot(aptQuery, (snap) => {
      setAppointments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment)));
    }, () => {});

    const unsubRec = onSnapshot(recordsQuery, (snap) => {
      setMedicalRecords(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MedicalRecord)));
    }, () => {});

    const unsubTx = onSnapshot(txQuery, (snap) => {
      setTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
    }, () => {});

    const unsubInv = onSnapshot(invQuery, (snap) => {
      setInvoices(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice)));
      setLoading(false);
    }, () => {
      setLoading(false);
    });

    return () => {
      unsubApt();
      unsubRec();
      unsubTx();
      unsubInv();
    };
  }, [patientId]);

  // Combine and format events
  const timelineEvents = useMemo(() => {
    const events: TimelineEvent[] = [];

    // Map Appointments
    appointments.forEach(apt => {
      events.push({
        id: `apt-${apt.id}`,
        type: 'appointment',
        date: new Date(apt.dateTime || Date.now()),
        title: apt.status === 'completed' ? 'Clinical Consultation Completed' : `Upcoming Appointment`,
        subtitle: `Dept: ${apt.departmentId || 'General'} ${apt.doctorName ? `with Dr. ${apt.doctorName}` : ''}`,
        details: apt.symptoms ? `Presenting Complaint: ${apt.symptoms}` : 'Routine checkup or referral session.',
        status: apt.status,
        extra: { triageLevel: apt.triageLevel }
      });
    });

    // Map Medical Records
    medicalRecords.forEach(rec => {
      let recType = 'Clinical Note';
      if (rec.type === 'prescription') recType = 'Prescription Prescribed';
      if (rec.type === 'lab') recType = 'Laboratory Result Recorded';
      if (rec.type === 'imaging') recType = 'Imaging Record Loaded';

      events.push({
        id: `rec-${rec.id}`,
        type: 'visit',
        date: new Date(rec.date || Date.now()),
        title: rec.title || recType,
        subtitle: `Record type: ${rec.type.toUpperCase()}`,
        details: rec.content || '',
        extra: { fileUrl: rec.fileUrl, doctorId: rec.doctorId }
      });
    });

    // Map Transactions
    transactions.forEach(tx => {
      events.push({
        id: `tx-${tx.id}`,
        type: 'payment',
        date: new Date(tx.date || Date.now()),
        title: tx.title || 'Ledger Settlement',
        subtitle: tx.type === 'credit' ? 'Account Credit / Revenue' : 'Account Debit / Expense Claim',
        details: tx.desc || 'No descriptions provided for transaction.',
        amount: tx.amount,
        status: tx.status,
        extra: { txType: tx.type }
      });
    });

    // Map Invoices
    invoices.forEach(inv => {
      events.push({
        id: `inv-${inv.id}`,
        type: 'payment',
        date: new Date(inv.dueDate || Date.now()),
        title: `Invoice Issued: ${inv.label}`,
        subtitle: `Billing settlement request`,
        details: `Standard economic ledger invoice reference: ${inv.id.toUpperCase()}`,
        amount: inv.amount,
        status: inv.status,
        extra: { txType: 'invoice' }
      });
    });

    // Sort chronologically (newest first)
    return events.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [appointments, medicalRecords, transactions, invoices]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    return timelineEvents.filter(ev => {
      if (filter === 'all') return true;
      if (filter === 'visits') return ev.type === 'visit';
      if (filter === 'payments') return ev.type === 'payment';
      if (filter === 'appointments') return ev.type === 'appointment';
      return true;
    });
  }, [timelineEvents, filter]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-text-dim">
        <Activity className="animate-spin text-blue-500 mb-2" size={32} />
        <span className="text-[10px] uppercase tracking-widest font-mono">Synchronizing Patient Ledger...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Timeline Controls */}
      <div className="flex flex-wrap gap-2 items-center justify-between border-b border-border-accent/10 pb-4">
        <div>
          <h4 className="text-xs font-black uppercase tracking-[0.2em] text-text-muted flex items-center gap-2">
            <Filter size={12} className="text-blue-500" />
            CHRONO_LEDGER_FILTER
          </h4>
          <p className="text-[10px] text-text-dim mt-1">Staggered chronological event tracing</p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <FilterTab active={filter === 'all'} onClick={() => setFilter('all')}>All Log</FilterTab>
          <FilterTab active={filter === 'visits'} onClick={() => setFilter('visits')}>Visits & EHR</FilterTab>
          <FilterTab active={filter === 'payments'} onClick={() => setFilter('payments')}>Payments</FilterTab>
          <FilterTab active={filter === 'appointments'} onClick={() => setFilter('appointments')}>Appointments</FilterTab>
        </div>
      </div>

      {filteredEvents.length === 0 ? (
        <div className="p-12 text-center text-text-dim italic bg-white/5 rounded-2xl border border-white/5">
          <AlertCircle className="mx-auto text-text-dim/30 mb-2" size={24} />
          <p className="text-xs font-bold uppercase tracking-widest">No activities logged</p>
          <p className="text-[10px] text-text-dim mt-1">This node does not contain any records for the selected filters.</p>
        </div>
      ) : (
        <div className="relative pl-6 md:pl-8 border-l-2 border-border-accent/20 space-y-8 py-2">
          <AnimatePresence initial={false}>
            {filteredEvents.map((event, index) => (
              <motion.div 
                key={event.id}
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.25, delay: Math.min(index * 0.05, 0.4) }}
                className="relative group"
              >
                {/* Visual Connector Dot */}
                <span className={`absolute -left-[31px] md:-left-[39px] top-1.5 w-4 h-4 rounded-full border-2 bg-main-bg flex items-center justify-center transition-transform group-hover:scale-125 z-10 ${
                  event.type === 'visit' ? 'border-purple-500 text-purple-500' :
                  event.type === 'payment' ? 'border-emerald-500 text-emerald-500' :
                  'border-blue-500 text-blue-500'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    event.type === 'visit' ? 'bg-purple-500' :
                    event.type === 'payment' ? 'bg-emerald-500' :
                    'bg-blue-500'
                  }`} />
                </span>

                {/* Timeline Card */}
                <div className="bg-inner-bg hover:bg-white/[0.02] border border-border-accent/30 rounded-[28px] p-6 transition-all shadow-md hover:shadow-lg hover:border-blue-500/20">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl border ${
                        event.type === 'visit' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                        event.type === 'payment' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      }`}>
                        {event.type === 'visit' && <FileText size={16} />}
                        {event.type === 'payment' && <CreditCard size={16} />}
                        {event.type === 'appointment' && <Calendar size={16} />}
                      </div>
                      <div>
                        <h5 className="font-bold text-text-main text-sm">{event.title}</h5>
                        <p className="text-[10px] text-text-dim uppercase tracking-wider font-mono mt-0.5">{event.subtitle}</p>
                      </div>
                    </div>
                    
                    <div className="text-left md:text-right font-mono">
                      <div className="text-[10px] text-text-dim flex items-center gap-1.5 md:justify-end">
                        <Clock size={12} />
                        {event.date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()} // {event.date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="mt-1 flex items-center gap-2 md:justify-end">
                        {event.amount !== undefined && (
                          <span className={`text-xs font-black ${event.extra?.txType === 'credit' ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {event.extra?.txType === 'credit' ? '+' : '-'} ${event.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        )}
                        {event.status && (
                          <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                            event.status === 'completed' || event.status === 'COMPLETED' || event.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            event.status === 'waiting' || event.status === 'pending' || event.status === 'PROCESSING' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                            'bg-slate-500/10 text-text-dim border-white/10'
                          }`}>
                            {event.status}
                          </span>
                        )}
                        {event.extra?.triageLevel && (
                          <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                            event.extra.triageLevel === 'critical' || event.extra.triageLevel === 'high' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse' :
                            'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          }`}>
                            {event.extra.triageLevel}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-text-muted leading-relaxed font-medium mt-1">{event.details}</p>

                  {/* Visit specific extras */}
                  {event.type === 'visit' && event.extra?.fileUrl && (
                    <div className="mt-4 pt-4 border-t border-border-accent/10 flex justify-between items-center">
                      <span className="text-[9px] text-text-dim font-mono">Attachment: {event.extra.fileUrl.split('/').pop() || 'EHR File'}</span>
                      <a 
                        href={event.extra.fileUrl} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-[9px] font-black text-blue-400 hover:text-blue-300 uppercase tracking-widest flex items-center gap-1"
                      >
                        <Eye size={12} />
                        View Document
                      </a>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function FilterTab({ children, active, onClick }: { children: React.ReactNode, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-lg font-black uppercase tracking-widest text-[9px] border transition-all ${
        active 
          ? 'bg-blue-600 border-blue-500 text-white shadow-md' 
          : 'bg-white/5 border-white/10 text-text-dim hover:text-text-main'
      }`}
    >
      {children}
    </button>
  );
}
