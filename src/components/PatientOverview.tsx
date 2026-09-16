import React from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import { Heart, Activity, Thermometer, Wind, Calendar, Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

interface PatientOverviewProps {
  appointments: any[];
}

const trendData = [
  { day: 'Mon', hr: 72, spo2: 98, bp: 120 },
  { day: 'Tue', hr: 75, spo2: 99, bp: 118 },
  { day: 'Wed', hr: 68, spo2: 97, bp: 122 },
  { day: 'Thu', hr: 80, spo2: 98, bp: 121 },
  { day: 'Fri', hr: 71, spo2: 99, bp: 119 },
  { day: 'Sat', hr: 73, spo2: 98, bp: 120 },
  { day: 'Sun', hr: 69, spo2: 99, bp: 117 },
];

export default function PatientOverview({ appointments }: PatientOverviewProps) {
  // Get upcoming appointments
  const upcomingApts = appointments.filter(
    (apt: any) => apt.status === 'scheduled' || apt.status === 'waiting'
  );

  const nextApt = upcomingApts[0];

  return (
    <div className="space-y-8" id="patient-overview">
      {/* Vitals Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Heart Rate */}
        <div className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden" id="vitals-hr-card">
          <div className="absolute top-0 right-0 p-4 text-rose-500/5 group-hover:scale-110 transition-transform">
            <Heart size={48} />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-rose-50 rounded-xl text-rose-500">
              <Heart size={18} className="animate-pulse" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pulse / Heart Rate</span>
          </div>
          <p className="text-3xl font-black text-slate-900 tracking-tight">
            72 <span className="text-xs font-mono font-medium text-slate-400">BPM</span>
          </p>
          <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest mt-2 flex items-center gap-1">
            ● Normal Nominal Range
          </p>
        </div>

        {/* SpO2 */}
        <div className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden" id="vitals-spo2-card">
          <div className="absolute top-0 right-0 p-4 text-blue-500/5 group-hover:scale-110 transition-transform">
            <Wind size={48} />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-blue-50 rounded-xl text-blue-500">
              <Wind size={18} />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Oxygen Saturation</span>
          </div>
          <p className="text-3xl font-black text-slate-900 tracking-tight">
            99% <span className="text-xs font-mono font-medium text-slate-400">SpO2</span>
          </p>
          <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest mt-2 flex items-center gap-1">
            ● Excellent Saturation
          </p>
        </div>

        {/* Blood Pressure */}
        <div className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden" id="vitals-bp-card">
          <div className="absolute top-0 right-0 p-4 text-purple-500/5 group-hover:scale-110 transition-transform">
            <Activity size={48} />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-purple-50 rounded-xl text-purple-500">
              <Activity size={18} />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Blood Pressure</span>
          </div>
          <p className="text-3xl font-black text-slate-900 tracking-tight">
            118/75 <span className="text-xs font-mono font-medium text-slate-400">mmHg</span>
          </p>
          <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest mt-2 flex items-center gap-1">
            ● Optimal pressure
          </p>
        </div>

        {/* Temperature */}
        <div className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden" id="vitals-temp-card">
          <div className="absolute top-0 right-0 p-4 text-amber-500/5 group-hover:scale-110 transition-transform">
            <Thermometer size={48} />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-amber-50 rounded-xl text-amber-500">
              <Thermometer size={18} />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Core Temp</span>
          </div>
          <p className="text-3xl font-black text-slate-900 tracking-tight">
            36.6 <span className="text-xs font-mono font-medium text-slate-400">°C</span>
          </p>
          <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest mt-2 flex items-center gap-1">
            ● Thermally Stable
          </p>
        </div>
      </div>

      {/* Main Trends & Next Appointment Split Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recharts Vitals Trends */}
        <div className="lg:col-span-2 bg-white border border-slate-100 p-8 rounded-[44px] shadow-sm hover:shadow-xl transition-all" id="vitals-trends-card">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 mb-2">Biometric Timeline</h4>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic font-serif">Health Metrics Trend</h3>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Heart Rate</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Oxygen (SpO2)</span>
              </div>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorSpo2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="day" 
                  stroke="#94a3b8" 
                  fontSize={10} 
                  fontWeight="bold" 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={10} 
                  fontWeight="bold" 
                  tickLine={false} 
                  axisLine={false} 
                  domain={[50, 110]}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0f172a', 
                    borderRadius: '16px', 
                    border: 'none',
                    color: '#fff',
                    fontFamily: 'monospace',
                    fontSize: '11px'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="hr" 
                  stroke="#ef4444" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorHr)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="spo2" 
                  stroke="#3b82f6" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorSpo2)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Upcoming Appointment Summary */}
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-[44px] text-white flex flex-col justify-between shadow-2xl relative overflow-hidden group" id="upcoming-appointment-card">
          <div className="absolute top-0 right-0 p-8 text-white/5 group-hover:scale-110 transition-transform">
            <Calendar size={120} />
          </div>

          <div className="relative z-10 space-y-6">
            <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-400">Next Scheduled Care Node</h4>
            {nextApt ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-3xl font-black italic font-serif leading-none uppercase tracking-tighter text-white">
                    {nextApt.doctorName || 'Clinical Lead Specialist'}
                  </h3>
                  <p className="text-xs text-blue-400 uppercase tracking-widest mt-2">
                    {nextApt.departmentId ? nextApt.departmentId.replace('-', ' ') : 'General Care'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-lg text-slate-300">
                      <Calendar size={14} />
                    </div>
                    <div>
                      <div className="text-[8px] font-black uppercase text-slate-500">Date</div>
                      <div className="text-xs font-bold text-white">
                        {format(new Date(nextApt.dateTime), 'MMM dd, yyyy')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-lg text-slate-300">
                      <Clock size={14} />
                    </div>
                    <div>
                      <div className="text-[8px] font-black uppercase text-slate-500">Time</div>
                      <div className="text-xs font-bold text-white">
                        {format(new Date(nextApt.dateTime), 'h:mm a')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-4 text-center">
                <Calendar className="mx-auto text-slate-600" size={40} />
                <p className="text-sm text-slate-400 italic">No scheduled appointments found.</p>
                <Link 
                  to="/appointments" 
                  className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300"
                >
                  Schedule Rotation Now <ArrowRight size={12} />
                </Link>
              </div>
            )}
          </div>

          {nextApt && (
            <div className="relative z-10 pt-6 mt-6 border-t border-white/10 flex items-center justify-between">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Registry Sync Nominal</span>
              <Link 
                to="/appointments" 
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-2"
              >
                Manage Link
                <ArrowRight size={12} />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
