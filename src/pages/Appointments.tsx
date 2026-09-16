import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Appointment, AppointmentStatus } from '../types';
import { DEPARTMENTS } from '../constants';
import { format } from 'date-fns';
import { Calendar, Clock, User, Filter, CheckCircle2, XCircle, AlertCircle, Plus, Activity, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { appointmentSchema, AppointmentFormValues } from '../lib/validation';

import { createNotification } from '../hooks/useNotifications';

export default function Appointments() {
  const { profile, isDoctor, isAdmin } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [showBooking, setShowBooking] = useState(false);
  const [loading, setLoading] = useState(true);

  const [bookingStep, setBookingStep] = useState(1);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      departmentId: DEPARTMENTS[0].id,
      dateTime: '',
      symptoms: ''
    }
  });

  const selectedDeptId = watch('departmentId');
  const selectedDept = DEPARTMENTS.find(d => d.id === selectedDeptId);

  useEffect(() => {
    if (!profile) return;

    const appointmentsRef = collection(db, 'appointments');
    let q;
    
    if (isAdmin) {
      q = query(appointmentsRef, orderBy('dateTime', 'desc'));
    } else if (isDoctor) {
      q = query(appointmentsRef, where('doctorId', '==', profile.userId), orderBy('dateTime', 'desc'));
    } else {
      q = query(appointmentsRef, where('patientId', '==', profile.userId), orderBy('dateTime', 'desc'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
      setAppointments(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'appointments');
    });

    return () => unsubscribe();
  }, [profile, isDoctor, isAdmin]);

  const onBooking = async (data: AppointmentFormValues) => {
    if (!profile) return;

    try {
      const docRef = await addDoc(collection(db, 'appointments'), {
        patientId: profile.userId,
        patientName: profile.name,
        departmentId: data.departmentId,
        dateTime: new Date(data.dateTime).toISOString(),
        status: 'scheduled',
        symptoms: data.symptoms,
        createdAt: new Date().toISOString()
      });

      // Notify doctors/admins
      await createNotification(profile.userId, {
        title: 'Appointment Scheduled',
        message: `Your appointment for ${data.departmentId} is confirmed for ${format(new Date(data.dateTime), 'PPp')}.`,
        type: 'success'
      });

      setShowBooking(false);
      reset();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'appointments');
    }
  };

  const updateStatus = async (id: string, newStatus: AppointmentStatus) => {
    try {
      const apt = appointments.find(a => a.id === id);
      await updateDoc(doc(db, 'appointments', id), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });

      if (apt) {
        await createNotification(apt.patientId, {
          title: 'Appointment Status Updated',
          message: `Your appointment status has been changed to ${newStatus.replace('-', ' ')}.`,
          type: newStatus === 'cancelled' ? 'warning' : 'info'
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `appointments/${id}`);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-text-main uppercase tracking-[0.1em]">Appointments</h1>
          <p className="text-text-muted mt-2 font-medium italic opacity-70">Manage your clinical sessions and live queue status.</p>
        </div>
        {!isDoctor && !isAdmin && (
          <button
            onClick={() => setShowBooking(true)}
            className="bg-blue-600 text-white px-8 py-4 rounded-xl font-black flex items-center justify-center gap-3 shadow-2xl shadow-blue-900/30 hover:bg-blue-500 transition-all active:scale-95 uppercase tracking-widest text-xs"
          >
            <Plus size={20} />
            Secure Booking
          </button>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card-bg p-8 rounded-[32px] border border-border-accent shadow-xl">
          <div className="flex items-center gap-4 mb-4">
            <Calendar className="text-blue-400" size={20} />
            <h4 className="text-[10px] font-black text-text-dim uppercase tracking-[0.2em]">Total Payload</h4>
          </div>
          <p className="text-4xl font-black text-text-main">{appointments.length}</p>
        </div>
        <div className="bg-card-bg p-8 rounded-[32px] border border-border-accent shadow-xl">
          <div className="flex items-center gap-4 mb-4">
            <Clock className="text-yellow-500" size={20} />
            <h4 className="text-[10px] font-black text-text-dim uppercase tracking-[0.2em]">Live Processing</h4>
          </div>
          <p className="text-4xl font-black text-text-main">{appointments.filter(a => a.status === 'in-consultation' || a.status === 'waiting').length}</p>
        </div>
        <div className="bg-card-bg p-8 rounded-[32px] border border-border-accent shadow-xl">
          <div className="flex items-center gap-4 mb-4">
            <CheckCircle2 className="text-emerald-500" size={20} />
            <h4 className="text-[10px] font-black text-text-dim uppercase tracking-[0.2em]">Closed Nodes</h4>
          </div>
          <p className="text-4xl font-black text-text-main">{appointments.filter(a => a.status === 'completed').length}</p>
        </div>
      </div>

      {/* Main List */}
      <div className="bg-card-bg rounded-[40px] border border-border-accent shadow-2xl overflow-hidden">
        <div className="p-8 border-b border-border-accent flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-4">
            <Filter size={18} className="text-text-dim" />
            <span className="font-black text-text-main uppercase tracking-widest text-sm italic font-serif">Clinical Registry</span>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border-accent bg-white/[0.02]">
                <th className="px-8 py-4 text-[10px] font-black uppercase text-text-dim tracking-widest">Node ID</th>
                <th className="px-8 py-4 text-[10px] font-black uppercase text-text-dim tracking-widest">Medical Entity</th>
                <th className="px-8 py-4 text-[10px] font-black uppercase text-text-dim tracking-widest">Dept & Timestamp</th>
                <th className="px-8 py-4 text-[10px] font-black uppercase text-text-dim tracking-widest">Status</th>
                <th className="px-8 py-4 text-[10px] font-black uppercase text-text-dim tracking-widest text-right">Ops</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-accent/30">
              {appointments.map((apt) => (
                <tr key={apt.id} className="hover:bg-white/[0.01] transition-colors group">
                  <td className="px-8 py-6">
                    <span className="font-mono text-[10px] font-medium text-text-dim">#{apt.id.slice(0, 8)}</span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-inner-bg border border-border-accent flex items-center justify-center text-blue-400 font-bold group-hover:border-blue-500/30 transition-all">
                        {(isDoctor ? apt.patientName : apt.doctorName)?.[0] || <User size={18} />}
                      </div>
                      <div>
                        <p className="font-bold text-text-main">{isDoctor ? apt.patientName : apt.doctorName || 'Awaiting Consult'}</p>
                        <p className="text-[10px] text-text-dim uppercase tracking-widest">UID: {isDoctor ? apt.patientId.slice(0, 6) : apt.doctorId?.slice(0, 6) || 'N/A'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <p className="text-sm font-bold text-text-main capitalize">{apt.departmentId.replace('-', ' ')}</p>
                    <p className="text-xs text-text-muted font-medium font-mono">{format(new Date(apt.dateTime), 'MMM d • h:mm a')}</p>
                  </td>
                  <td className="px-8 py-6">
                    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      apt.status === 'scheduled' ? 'bg-blue-500/10 text-blue-400' :
                      apt.status === 'waiting' ? 'bg-yellow-500/10 text-yellow-500 animate-pulse' :
                      apt.status === 'in-consultation' ? 'bg-emerald-500/10 text-emerald-500' :
                      apt.status === 'completed' ? 'bg-white/5 text-text-dim' :
                      'bg-rose-500/10 text-rose-500'
                    }`}>
                      <div className="w-1.5 h-1.5 rounded-full bg-current" />
                      {apt.status.replace('-', ' ')}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    {(isDoctor || isAdmin) && (
                      <div className="flex justify-end gap-2">
                        {apt.status === 'scheduled' && (
                          <button onClick={() => updateStatus(apt.id, 'waiting')} className="p-2 hover:bg-yellow-500/10 text-yellow-500 rounded-lg transition-colors">
                            <Clock size={16} />
                          </button>
                        )}
                        {apt.status === 'waiting' && (
                          <button onClick={() => updateStatus(apt.id, 'in-consultation')} className="p-2 hover:bg-emerald-500/10 text-emerald-500 rounded-lg transition-colors">
                            <Activity size={16} />
                          </button>
                        )}
                        {apt.status === 'in-consultation' && (
                          <button onClick={() => updateStatus(apt.id, 'completed')} className="p-2 hover:bg-blue-500/10 text-blue-400 rounded-lg transition-colors">
                            <CheckCircle2 size={16} />
                          </button>
                        )}
                      </div>
                    )}
                    {!isDoctor && !isAdmin && apt.status === 'scheduled' && (
                      <button onClick={() => updateStatus(apt.id, 'cancelled')} className="p-2 hover:bg-rose-500/10 text-rose-500 rounded-lg transition-colors">
                        <XCircle size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {appointments.length === 0 && !loading && (
            <div className="p-20 text-center text-text-dim">
               <Calendar className="mx-auto mb-4 opacity-10" size={48} />
               <p className="text-lg font-medium italic">No terminal records found in registry.</p>
            </div>
          )}
        </div>
      </div>      {/* Booking Modal */}
      <AnimatePresence>
        {showBooking && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[44px] shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]"
            >
              <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h3 className="text-3xl font-black tracking-tighter text-slate-900 italic font-serif uppercase">Clinical Pipeline Init</h3>
                  <div className="flex gap-2 mt-2">
                    <div className={`h-1 w-12 rounded-full transition-all ${bookingStep >= 1 ? 'bg-blue-600' : 'bg-slate-200'}`} />
                    <div className={`h-1 w-12 rounded-full transition-all ${bookingStep >= 2 ? 'bg-blue-600' : 'bg-slate-200'}`} />
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setShowBooking(false);
                    setBookingStep(1);
                  }} 
                  className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-all"
                >
                  <XCircle size={28} />
                </button>
              </div>

              <form onSubmit={handleSubmit(onBooking)} className="p-10 space-y-8 overflow-y-auto">
                <AnimatePresence mode="wait">
                  {bookingStep === 1 ? (
                    <motion.div
                      key="step1"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-8"
                    >
                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">
                          <span>Clinical Dept</span>
                          <span className="text-blue-500 italic">Wait: ~{selectedDept?.waitTime}m</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {DEPARTMENTS.slice(0, 6).map(d => (
                            <button
                              key={d.id}
                              type="button"
                              onClick={() => setValue('departmentId', d.id)}
                              className={`p-4 rounded-2xl border-2 transition-all text-left ${
                                selectedDeptId === d.id 
                                  ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-lg' 
                                  : 'border-slate-100 bg-white hover:border-blue-200'
                              }`}
                            >
                              <div className="text-[10px] font-black uppercase leading-none mb-1">{d.name}</div>
                              <div className="text-[8px] font-medium opacity-60 uppercase tracking-widest leading-none line-clamp-1">{d.subSpecialties[0] || 'General'}</div>
                            </button>
                          ))}
                        </div>
                        {errors.departmentId && <p className="text-[10px] font-black text-rose-500 uppercase px-1 mt-2">{errors.departmentId.message}</p>}
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Symptomatic Description</label>
                        <textarea 
                          {...register('symptoms')}
                          placeholder="Briefly describe the primary clinical concern..."
                          className={`w-full p-6 rounded-3xl bg-slate-50 border font-medium outline-none text-slate-900 focus:ring-4 focus:ring-blue-600/5 h-32 placeholder:text-slate-300 placeholder:italic transition-all ${errors.symptoms ? 'border-rose-500' : 'border-slate-100'}`} 
                        />
                        {errors.symptoms && <p className="text-[10px] font-black text-rose-500 uppercase px-1">{errors.symptoms.message}</p>}
                      </div>

                      <button 
                        type="button"
                        onClick={() => setBookingStep(2)}
                        className="w-full py-6 bg-slate-900 text-white rounded-[28px] font-black uppercase tracking-[0.2em] text-xs hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-xl"
                      >
                        Next: Rotation Window <ArrowRight size={16} />
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="step2"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-8"
                    >
                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1 text-center block">Select Rotation Window</label>
                        <div className="flex justify-center flex-col items-center gap-4 bg-blue-50 p-10 rounded-[40px] border border-blue-100">
                          <Calendar size={48} className="text-blue-600 opacity-20" />
                          <input 
                            type="datetime-local" 
                            {...register('dateTime')}
                            className={`w-full max-w-sm p-6 rounded-3xl bg-white border-2 font-black outline-none text-slate-900 focus:ring-4 focus:ring-blue-600/5 text-center ${errors.dateTime ? 'border-rose-500' : 'border-blue-100 shadow-xl'}`} 
                          />
                          {errors.dateTime && <p className="text-[10px] font-black text-rose-500 uppercase">{errors.dateTime.message}</p>}
                          <div className="text-[10px] font-black uppercase text-blue-400 tracking-widest mt-2">{selectedDept?.name} Registry Hub</div>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <button 
                          type="button"
                          onClick={() => setBookingStep(1)}
                          className="px-8 py-6 bg-slate-100 text-slate-900 rounded-[28px] font-black uppercase tracking-widest text-[10px]"
                        >
                          Back
                        </button>
                        <button 
                          type="submit" 
                          disabled={isSubmitting}
                          className="flex-1 bg-blue-600 text-white py-6 rounded-[28px] font-black uppercase tracking-[0.2em] text-xs hover:bg-blue-700 transition-all shadow-2xl shadow-blue-900/20 disabled:opacity-50"
                        >
                          {isSubmitting ? 'Synchronizing Cluster...' : 'Finalise Booking'}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
