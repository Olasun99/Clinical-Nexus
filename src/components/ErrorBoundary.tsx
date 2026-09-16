import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, Home, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught clinical error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8 text-white font-sans">
          <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-[50px] p-12 space-y-8 shadow-2xl relative overflow-hidden">
            {/* Background Accent */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            
            <div className="flex flex-col items-center text-center space-y-6 relative z-10">
              <div className="w-24 h-24 bg-rose-500/20 rounded-full flex items-center justify-center text-rose-500 animate-pulse">
                <AlertTriangle size={48} />
              </div>
              
              <div className="space-y-2">
                <h1 className="text-4xl font-black italic font-serif uppercase tracking-tighter">Clinical Exception</h1>
                <p className="text-slate-500 font-mono text-[10px] uppercase tracking-widest">Protocol Interrupted // Nexus Error</p>
              </div>

              <div className="w-full p-6 bg-slate-950/50 border border-slate-800 rounded-3xl text-left">
                <p className="text-rose-400 font-mono text-[10px] uppercase mb-2">Error Diagnostic Trace:</p>
                <code className="text-slate-400 text-xs block break-all font-mono opacity-80">
                  {this.state.error?.message || 'Unknown clinical fault detected in the execution layer.'}
                </code>
              </div>

              <div className="grid grid-cols-2 gap-4 w-full pt-4">
                <button 
                  onClick={() => window.location.reload()}
                  className="p-5 bg-white text-slate-950 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-slate-200 transition-all active:scale-95"
                >
                  <RefreshCcw size={14} />
                  Retry Sync
                </button>
                <a 
                  href="/"
                  className="p-5 bg-slate-800 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-slate-700 transition-all active:scale-95"
                >
                  <Home size={14} />
                  Home Base
                </a>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
