import React from 'react';
import { Map, MapPin, Navigation, ArrowRight, Building2, Layers, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DEPARTMENTS } from '../constants';

export default function HospitalNavigation() {
  const LOCATIONS = [
    { floor: 'Ground Floor', depts: ['Emergency Medicine', 'Radiology', 'Pharmacy', 'Registration'] },
    { floor: '1st Floor', depts: ['Internal Medicine', 'Pediatrics', 'Cardiology', 'Lab Services'] },
    { floor: '2nd Floor', depts: ['Surgery', 'Obstetrics & Gynecology', 'Neurology', 'ICU'] },
    { floor: '3rd Floor', depts: ['Oncology', 'Orthopedics', 'Pathology', 'Research'] },
  ];

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-text-main uppercase tracking-[0.1em]">Locus Navigator</h1>
          <p className="text-text-muted mt-2 font-medium italic opacity-70">Decentralized spatial lookup across the clinical campus.</p>
        </div>
      </div>

      <Link to="/emergency" className="block bg-rose-600/10 border-2 border-rose-600 border-dashed rounded-[40px] p-10 mb-12 group hover:bg-rose-600 transition-all shadow-2xl shadow-rose-900/20 active:scale-[0.99] relative overflow-hidden">
        <ShieldAlert className="absolute -right-8 -bottom-8 w-48 h-48 opacity-10 text-rose-500 group-hover:text-white group-hover:opacity-20 transition-all" />
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-rose-600 rounded-full text-[9px] font-black uppercase text-white tracking-[0.2em] mb-2 animate-pulse">Critical Access</div>
            <h2 className="text-4xl font-black text-rose-500 group-hover:text-white italic font-serif leading-none transition-colors">Emergency SOS Link</h2>
            <p className="text-rose-950 group-hover:text-rose-100 font-bold uppercase text-[10px] tracking-widest opacity-60">Escalate immediately to high-surety physician node.</p>
          </div>
          <div className="w-16 h-16 rounded-full bg-rose-600 text-white flex items-center justify-center group-hover:bg-white group-hover:text-rose-600 shadow-xl transition-all">
            <ArrowRight size={32} />
          </div>
        </div>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Floor Directory */}
        <div className="lg:col-span-2 space-y-8">
          {LOCATIONS.map((loc, idx) => (
            <div key={idx} className="bg-card-bg rounded-[40px] border border-border-accent overflow-hidden shadow-2xl transition-all hover:border-blue-500/20">
              <div className="p-8 border-b border-border-accent bg-white/[0.02] flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-blue-500/10 rounded-lg"><Layers className="text-blue-400" size={20} /></div>
                  <h3 className="font-black text-xl text-text-main italic font-serif">{loc.floor}</h3>
                </div>
                <span className="text-[10px] font-black uppercase text-text-dim tracking-[0.2em]">{loc.depts.length} OPERATIONAL UNITS</span>
              </div>
              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                {loc.depts.map((dept, dIdx) => (
                  <div key={dIdx} className="flex items-center justify-between p-5 rounded-3xl bg-inner-bg border border-border-accent hover:border-blue-500/30 transition-all cursor-pointer group hover:bg-white/[0.01]">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-sidebar-bg border border-border-main flex items-center justify-center text-text-dim group-hover:text-blue-400 group-hover:border-blue-500/30 transition-all shadow-lg">
                        <MapPin size={16} />
                      </div>
                      <span className="font-bold text-text-main group-hover:text-blue-100 transition-colors">{dept}</span>
                    </div>
                    <ChevronRight size={18} className="text-text-dim group-hover:text-blue-400 transition-transform group-hover:translate-x-1" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Right: Quick Directions & Info */}
        <div className="space-y-8">
          <div className="bg-inner-bg text-text-main p-10 rounded-[40px] shadow-2xl relative overflow-hidden border border-border-accent">
            <Building2 className="absolute -right-8 -bottom-8 w-48 h-48 opacity-[0.03] text-blue-500" />
            <h3 className="text-3xl font-black mb-8 tracking-tighter italic font-serif">Spatial Guidance</h3>
            <div className="space-y-8 relative z-10">
              <DirectionStep 
                num="01"
                title="Vector Entry"
                desc="Proceed through the main North Lobby bio-gate."
              />
              <DirectionStep 
                num="02"
                title="Vertical Sync"
                desc="Utilize the central lift array for level transition."
              />
              <DirectionStep 
                num="03"
                title="Node Arrival"
                desc="Follow the illuminated floor markers to the unit node."
              />
            </div>
            <button className="w-full mt-10 bg-blue-600 py-5 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 hover:bg-blue-500 transition-all shadow-2xl shadow-blue-900/40 active:scale-95">
              <Navigation size={18} />
              Satellite Sync
            </button>
          </div>

          <div className="bg-card-bg p-8 rounded-[40px] border border-border-accent shadow-xl group">
            <h3 className="font-black text-xs uppercase tracking-[0.2em] text-text-dim mb-8 flex items-center gap-3">
              <div className="p-2 bg-inner-bg border border-border-accent rounded-lg group-hover:border-blue-500/30 transition-colors"><Map className="text-blue-400" size={16} /></div>
              FACILITY_INDEX
            </h3>
            <ul className="space-y-2">
              <FacilityItem label="Bio-Café" location="Ground Floor" />
              <FacilityItem label="Pharma-Core" location="Ground Floor" />
              <FacilityItem label="Sanctuary" location="4th Floor" />
              <FacilityItem label="Secure Parking" location="P1 & P2" />
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function DirectionStep({ num, title, desc }: any) {
  return (
    <div className="flex gap-6 group">
      <span className="text-blue-500 font-black text-2xl font-mono opacity-20 group-hover:opacity-100 transition-opacity">{num}</span>
      <div>
        <h4 className="font-black text-sm leading-tight uppercase tracking-widest text-blue-100">{title}</h4>
        <p className="text-sm text-text-muted mt-2 font-medium opacity-80 leading-relaxed italic">{desc}</p>
      </div>
    </div>
  );
}

function FacilityItem({ label, location }: { label: string; location: string }) {
  return (
    <li className="flex items-center justify-between py-4 border-b border-border-accent/30 group last:border-0 hover:px-2 transition-all">
      <span className="text-text-muted font-medium group-hover:text-text-main transition-colors uppercase text-[10px] tracking-widest">{label}</span>
      <span className="font-mono text-[10px] text-blue-400 tracking-tighter opacity-70 group-hover:opacity-100 transition-opacity">{location}</span>
    </li>
  );
}

function ChevronRight(props: any) {
  return (
    <svg 
      {...props} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="3" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
