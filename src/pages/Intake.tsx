import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Camera,
  ImagePlus,
  Trash2,
  Plus,
  X,
  ClipboardCheck, 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  Activity, 
  AlertTriangle, 
  Send,
  Database,
  FileText,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { intakeFormSchema, IntakeFormValues } from '../lib/validation';

export default function Intake() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [images, setImages] = useState<string[]>([]);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<IntakeFormValues>({
    resolver: zodResolver(intakeFormSchema),
    defaultValues: {
      fullName: profile?.name || '',
      email: profile?.email || '',
      gender: 'other',
      bloodType: 'unknown',
      painLevel: '0'
    }
  });

  const painLevelValue = watch('painLevel');

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        alert("Image too large. Max 1MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImages(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: IntakeFormValues) => {
    if (!profile) return;
    setLoading(true);

    try {
      await addDoc(collection(db, 'intakeForms'), {
        ...data,
        userId: profile.userId,
        status: 'pending_review',
        images,
        timestamp: serverTimestamp()
      });
      setSubmitted(true);
      setTimeout(() => navigate('/'), 3000);
    } catch (error) {
      console.error('Intake submission error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center text-center space-y-6">
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 border border-emerald-500/20"
        >
          <ClipboardCheck size={48} />
        </motion.div>
        <div className="space-y-2">
          <h2 className="text-3xl font-black text-text-main uppercase tracking-tighter">Transmission Secured</h2>
          <p className="text-text-muted italic">Bio-data ingested and synced with Clinical Ops. Redirecting to console...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20 max-w-5xl mx-auto px-4">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.4em] font-black text-blue-500 mb-3">Modular Form // ID: BIO_INTAKE_01</div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-text-main uppercase">Clinical Intake Protocol</h1>
          <p className="text-text-muted mt-3 font-medium italic text-lg opacity-70">Synthesize your health data to accelerate diagnostic matching.</p>
        </div>
        <div className="flex items-center gap-4 bg-white/5 border border-white/10 px-6 py-4 rounded-2xl">
          <ShieldCheck className="text-emerald-500" size={24} />
          <div className="text-left">
            <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">E2E Encrypted</div>
            <div className="text-xs text-text-muted font-mono">ENCRYPTION: AES-256-GCM</div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Phase 1: Identity & Bio-Metrics */}
        <section className="bg-card-bg border border-border-accent rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-blue-500">
            <User size={120} />
          </div>
          <div className="flex items-center gap-4 mb-10 border-b border-border-accent pb-6">
            <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-400 border border-blue-500/20"><Database size={24} /></div>
            <div>
              <h3 className="text-xl font-black text-blue-100 italic font-serif">Phase 01: Core Bio-Metrics</h3>
              <p className="text-xs text-text-dim uppercase tracking-widest mt-1">Identity validation and physical baselines</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <InputGroup label="Full Node Name" icon={<User size={16} />} error={errors.fullName?.message}>
              <input 
                {...register('fullName')}
                className={`w-full bg-inner-bg border rounded-xl p-4 text-text-main outline-none focus:ring-2 focus:ring-blue-600/50 ${errors.fullName ? 'border-rose-500' : 'border-border-accent'}`} 
              />
            </InputGroup>
            <InputGroup label="Comms Vector (Email)" icon={<Mail size={16} />} error={errors.email?.message}>
              <input 
                {...register('email')}
                className={`w-full bg-inner-bg border rounded-xl p-4 text-text-main outline-none focus:ring-2 focus:ring-blue-600/50 ${errors.email ? 'border-rose-500' : 'border-border-accent'}`} 
              />
            </InputGroup>
            <InputGroup label="Voice Link (Phone)" icon={<Phone size={16} />} error={errors.phone?.message}>
              <input 
                placeholder="+1"
                {...register('phone')}
                className={`w-full bg-inner-bg border rounded-xl p-4 text-text-main outline-none focus:ring-2 focus:ring-blue-600/50 ${errors.phone ? 'border-rose-500' : 'border-border-accent'}`} 
              />
            </InputGroup>
            <InputGroup label="Origin Date (D.O.B)" icon={<Calendar size={16} />} error={errors.dob?.message}>
              <input 
                type="date" 
                {...register('dob')}
                className={`w-full bg-inner-bg border ${errors.dob ? 'border-rose-500' : 'border-border-accent'} rounded-xl p-4 text-text-main outline-none focus:ring-2 focus:ring-blue-600/50`} 
              />
            </InputGroup>
            <InputGroup label="Gender Schema" icon={<Activity size={16} />} error={errors.gender?.message}>
              <select 
                {...register('gender')}
                className="w-full bg-inner-bg border border-border-accent rounded-xl p-4 text-text-main outline-none focus:ring-2 focus:ring-blue-600/50"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Non-Binary / Private</option>
              </select>
            </InputGroup>
            <InputGroup label="Hematology (Blood Group)" icon={<AlertTriangle size={16} />} error={errors.bloodType?.message}>
              <select 
                {...register('bloodType')}
                className="w-full bg-inner-bg border border-border-accent rounded-xl p-4 text-text-main outline-none focus:ring-2 focus:ring-blue-600/50"
              >
                <option value="unknown">Aquire on entry</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
              </select>
            </InputGroup>
          </div>
        </section>

        {/* Phase 2: Symptom Synthesis */}
        <section className="bg-card-bg border border-border-accent rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-rose-500">
            <Activity size={120} />
          </div>
          <div className="flex items-center gap-4 mb-10 border-b border-border-accent pb-6">
            <div className="p-3 bg-rose-500/10 rounded-2xl text-rose-400 border border-rose-500/20"><FileText size={24} /></div>
            <div>
              <h3 className="text-xl font-black text-rose-100 italic font-serif">Phase 02: Clinical Findings</h3>
              <p className="text-xs text-text-dim uppercase tracking-widest mt-1">Describe symptomatic vectors and pain magnitude</p>
            </div>
          </div>

          <div className="space-y-8">
            <InputGroup label="Primary Clinical Concern" icon={<AlertTriangle size={16} />} error={errors.primaryConcern?.message}>
              <textarea 
                placeholder="Describe current symptoms or reason for visit..."
                {...register('primaryConcern')}
                className={`w-full bg-inner-bg border rounded-xl p-4 text-text-main outline-none focus:ring-2 focus:ring-blue-600/50 min-h-[120px] ${errors.primaryConcern ? 'border-rose-500' : 'border-border-accent'}`} 
              />
            </InputGroup>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <InputGroup label="Duration of State" icon={<Calendar size={16} />} error={errors.duration?.message}>
                <input 
                  placeholder="e.g., 3 days, 2 weeks"
                  {...register('duration')}
                  className={`w-full bg-inner-bg border ${errors.duration ? 'border-rose-500' : 'border-border-accent'} rounded-xl p-4 text-text-main outline-none focus:ring-2 focus:ring-blue-600/50`} 
                />
              </InputGroup>
              <InputGroup label={`Pain Magnitude Matrix [ ${painLevelValue}/10 ]`} icon={<Activity size={16} />}>
                <input 
                  type="range" 
                  min="0" 
                  max="10" 
                  {...register('painLevel')}
                  className="w-full mt-4 h-2 bg-inner-bg rounded-lg appearance-none cursor-pointer accent-rose-500 border border-border-accent" 
                />
              </InputGroup>
            </div>
          </div>
        </section>

        {/* Phase 4: Visual Evidence */}
        <section className="bg-card-bg border border-border-accent rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-purple-500">
            <Camera size={120} />
          </div>
          <div className="flex items-center gap-4 mb-10 border-b border-border-accent pb-6">
            <div className="p-3 bg-purple-500/10 rounded-2xl text-purple-400 border border-purple-500/20"><Camera size={24} /></div>
            <div>
              <h3 className="text-xl font-black text-purple-100 italic font-serif">Phase 04: Visual Evidence</h3>
              <p className="text-xs text-text-dim uppercase tracking-widest mt-1">Attach images of physical symptoms or external reports</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {images.map((img, idx) => (
              <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border border-border-accent group">
                <img src={img} alt="Symptom" className="w-full h-full object-cover" />
                <button 
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute top-2 right-2 p-1.5 bg-rose-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            <label className="aspect-square rounded-2xl border-2 border-dashed border-border-accent flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-purple-500/50 hover:bg-purple-500/5 transition-all group">
              <input 
                type="file" 
                accept="image/*" 
                capture="environment"
                className="hidden" 
                onChange={handleImageUpload}
              />
              <ImagePlus className="text-text-dim group-hover:text-purple-400 transition-colors" size={24} />
              <span className="text-[10px] font-black uppercase text-text-dim tracking-widest group-hover:text-text-muted">Add Capture</span>
            </label>
          </div>
        </section>

        {/* Phase 3: Historical Records */}
        <section className="bg-card-bg border border-border-accent rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-emerald-500">
            <ClipboardCheck size={120} />
          </div>
          <div className="flex items-center gap-4 mb-10 border-b border-border-accent pb-6">
            <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400 border border-emerald-500/20"><Zap size={24} /></div>
            <div>
              <h3 className="text-xl font-black text-emerald-100 italic font-serif">Phase 03: Historical Records</h3>
              <p className="text-xs text-text-dim uppercase tracking-widest mt-1">Fill systemic voids with medical background</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <InputGroup label="Allergenic Triggers" icon={<AlertTriangle size={16} />}>
              <textarea 
                placeholder="Drugs, Food, Environmental..."
                {...register('allergies')}
                className="w-full bg-inner-bg border border-border-accent rounded-xl p-4 text-text-main outline-none focus:ring-2 focus:ring-blue-600/50 min-h-[100px]" 
              />
            </InputGroup>
            <InputGroup label="Current Pharma Intake" icon={<Activity size={16} />}>
              <textarea 
                placeholder="List current medications and dosage..."
                {...register('medications')}
                className="w-full bg-inner-bg border border-border-accent rounded-xl p-4 text-text-main outline-none focus:ring-2 focus:ring-blue-600/50 min-h-[100px]" 
              />
            </InputGroup>
            <InputGroup label="Genetic Lineage (Family History)" icon={<Activity size={16} />}>
              <textarea 
                placeholder="Cardiac, Diabetic, Oncological history..."
                {...register('familyHistory')}
                className="w-full bg-inner-bg border border-border-accent rounded-xl p-4 text-text-main outline-none focus:ring-2 focus:ring-blue-600/50 min-h-[100px]" 
              />
            </InputGroup>
            <InputGroup label="Secondary Comm Link (Emergency Contact)" icon={<Phone size={16} />}>
              <input 
                placeholder="Name and Phone Number"
                {...register('emergencyContact')}
                className="w-full bg-inner-bg border border-border-accent rounded-xl p-4 text-text-main outline-none focus:ring-2 focus:ring-blue-600/50" 
              />
            </InputGroup>
          </div>
        </section>

        <div className="flex justify-end gap-6 pt-8">
          <button 
            type="button" 
            onClick={() => navigate('/')}
            className="px-10 py-5 bg-white/5 text-text-muted hover:text-text-main rounded-2xl font-black uppercase tracking-[0.2em] text-xs border border-white/10 transition-all"
          >
            Abort Protocol
          </button>
          <button 
            type="submit" 
            disabled={loading}
            className="px-12 py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:bg-blue-500 transition-all shadow-2xl shadow-blue-900/40 disabled:opacity-50 flex items-center gap-3"
          >
            {loading ? <Zap className="animate-spin" /> : <Send size={18} />}
            Transmit Bio-Data
          </button>
        </div>
      </form>
    </div>
  );
}

function InputGroup({ label, icon, error, children }: any) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center px-1">
        <label className="text-[10px] font-black uppercase text-text-dim tracking-[0.2em] flex items-center gap-2">
          {icon}
          {label}
        </label>
        {error && <span className="text-[9px] font-black uppercase text-rose-500">{error}</span>}
      </div>
      {children}
    </div>
  );
}
