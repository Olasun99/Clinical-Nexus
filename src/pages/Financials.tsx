import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  CreditCard, 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ShieldCheck, 
  Zap, 
  FileText,
  Clock,
  Terminal,
  Cpu,
  Download,
  FileSpreadsheet
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { collection, query, where, orderBy, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Transaction, Invoice } from '../types';

export default function Financials() {
  const { profile, isPatient, isAdmin, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<'wallet' | 'invoices'>('wallet');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    const txRef = collection(db, 'transactions');
    const invRef = collection(db, 'invoices');

    let txQuery, invQuery;

    if (hasPermission('view_all_financials')) {
      txQuery = query(txRef, orderBy('date', 'desc'));
      invQuery = query(invRef, orderBy('dueDate', 'desc'));
    } else {
      txQuery = query(txRef, where('userId', '==', profile.userId), orderBy('date', 'desc'));
      invQuery = query(invRef, where('userId', '==', profile.userId), orderBy('dueDate', 'desc'));
    }

    const unsubscribeTx = onSnapshot(txQuery, (snapshot) => {
      setTransactions(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
    });

    const unsubscribeInv = onSnapshot(invQuery, (snapshot) => {
      setInvoices(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Invoice)));
      setLoading(false);
    });

    return () => {
      unsubscribeTx();
      unsubscribeInv();
    };
  }, [profile, hasPermission]);

  const totalBalance = transactions.reduce((acc, tx) => {
    return tx.type === 'credit' ? acc + tx.amount : acc - tx.amount;
  }, 0);

  const handleDownloadCSV = () => {
    if (transactions.length === 0 && invoices.length === 0) {
      alert('No financial transaction or invoice data available for export.');
      return;
    }

    const headers = ['ID', 'Date', 'Type', 'Category/Service', 'Description/Label', 'Amount ($)', 'Status'];
    const csvRows = [headers.join(',')];

    // Add transactions representing revenues and expenses
    transactions.forEach(tx => {
      const values = [
        tx.id,
        tx.date ? new Date(tx.date).toISOString().split('T')[0] : '',
        tx.type === 'credit' ? 'REVENUE (Credit)' : 'EXPENSE (Debit)',
        `"${(tx.title || '').replace(/"/g, '""')}"`,
        `"${(tx.desc || '').replace(/"/g, '""')}"`,
        tx.amount,
        tx.status
      ];
      csvRows.push(values.join(','));
    });

    // Add invoices
    invoices.forEach(inv => {
      const values = [
        inv.id,
        inv.dueDate ? new Date(inv.dueDate).toISOString().split('T')[0] : '',
        'INVOICE',
        `"${(inv.label || '').replace(/"/g, '""')}"`,
        'N/A',
        inv.amount,
        inv.status
      ];
      csvRows.push(values.join(','));
    });

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `clinical_financial_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.4em] font-black text-blue-500 mb-3">Economic Layer // v1.2</div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-text-main uppercase">Clinical Financials</h1>
          <p className="text-text-muted mt-3 font-medium italic text-lg opacity-70">
            {isPatient ? 'Secure gateway for clinical fee settlement and insurance sync.' : 'Hospital revenue tracking and automated billing infrastructure.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <button 
            onClick={handleDownloadCSV}
            id="download-financial-report-btn"
            className="px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 shadow-lg hover:shadow-emerald-900/20"
          >
            <Download size={12} />
            Download Report
          </button>
          <div className="flex gap-2">
            <TabButton active={activeTab === 'wallet'} onClick={() => setActiveTab('wallet')}>Ledger</TabButton>
            <TabButton active={activeTab === 'invoices'} onClick={() => setActiveTab('invoices')}>Invoices</TabButton>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Wallet Visualizer */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-inner-bg rounded-[40px] border border-blue-500/30 p-10 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-[100px] -mr-48 -mt-48 transition-all group-hover:bg-blue-500/10"></div>
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-12">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-400 border border-blue-500/20"><CreditCard size={28} /></div>
                  <div>
                    <h3 className="font-black text-xs uppercase tracking-[0.2em] text-blue-400">Net Exposure</h3>
                    <p className="text-[10px] font-mono text-text-dim mt-1">WALLET_ID: {profile?.userId.slice(0, 12)}...HEX</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1 flex items-center justify-end gap-2">
                    <ShieldCheck size={12} />
                    Verified Balance
                  </div>
                  <div className="text-4xl font-black text-text-main">${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-10 border-t border-border-accent/30">
                <QuickStat label="Debits" val={`-$${transactions.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0).toLocaleString()}`} neg />
                <InputStat label="Credits" val={`+$${transactions.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0).toLocaleString()}`} />
                <InputStat label="Sync Status" val="100%" />
                <InputStat label="Pending Ops" val="$0.00" />
              </div>
            </div>
          </div>

          {/* Transactions List */}
          <div className="bg-card-bg rounded-[40px] border border-border-accent shadow-2xl overflow-hidden">
            <div className="p-8 border-b border-border-accent flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-4">
                <Terminal size={18} className="text-text-dim" />
                <h3 className="font-black text-sm uppercase tracking-widest text-text-main italic font-serif">Recent Transaction Log</h3>
              </div>
              <button 
                id="export-csv-log-btn"
                onClick={handleDownloadCSV}
                className="text-[10px] font-black text-blue-400 uppercase tracking-widest hover:text-blue-300 flex items-center gap-1.5"
              >
                <FileSpreadsheet size={12} />
                Export CSV
              </button>
            </div>
            <div className="divide-y divide-border-accent/30">
              {transactions.map(tx => (
                <TransactionRow 
                  key={tx.id}
                  icon={tx.type === 'debit' ? <ArrowDownLeft className="text-rose-500" /> : <ArrowUpRight className="text-emerald-500" />}
                  title={tx.title}
                  desc={tx.desc}
                  amount={`${tx.type === 'debit' ? '-' : '+'} $${tx.amount.toLocaleString()}`}
                  date={new Date(tx.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}
                  status={tx.status}
                />
              ))}
              {transactions.length === 0 && (
                <div className="p-12 text-center text-text-dim italic">No transactions recorded.</div>
              )}
            </div>
          </div>
        </div>

        {/* Payment Methods & Actions */}
        <div className="space-y-8">
          <div className="bg-inner-bg text-white rounded-[40px] p-10 shadow-2xl border border-border-accent relative overflow-hidden group">
            <Cpu className="absolute -right-8 -bottom-8 w-48 h-48 opacity-[0.03] text-blue-500" />
            <h3 className="text-2xl font-black mb-8 tracking-tighter italic font-serif">Payment Gateway</h3>
            <div className="space-y-6 relative z-10">
              <div className="p-5 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-4 group cursor-pointer hover:bg-white/10 transition-all">
                <div className="w-12 h-12 bg-blue-600/20 rounded-xl flex items-center justify-center text-blue-400 border border-blue-500/20">
                  <CreditCard size={24} />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-black uppercase tracking-widest text-blue-100">Primary Node Card</div>
                  <div className="text-sm font-mono text-text-dim mt-1">**** **** **** 4022</div>
                </div>
              </div>
              <button className="w-full bg-blue-600 py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 hover:bg-blue-500 transition-all shadow-2xl shadow-blue-900/40 active:scale-95">
                <Zap size={16} />
                Authorize New Method
              </button>
            </div>
          </div>

          <div className="bg-card-bg p-8 rounded-[40px] border border-border-accent shadow-xl group">
            <h3 className="font-black text-xs uppercase tracking-[0.2em] text-text-dim mb-8 flex items-center gap-3">
              <div className="p-2 bg-inner-bg border border-border-accent rounded-lg group-hover:border-blue-500/30 transition-colors"><FileText className="text-blue-400" size={16} /></div>
              PENDING_INVOICES
            </h3>
            <div className="space-y-4">
              {invoices.filter(i => i.status === 'pending').map(inv => (
                <InvoiceItem key={inv.id} id={inv.id.slice(0, 8)} amount={`$${inv.amount.toLocaleString()}`} label={inv.label} />
              ))}
              {invoices.filter(i => i.status === 'pending').length === 0 && (
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest text-center py-4">All accounts settled</p>
              )}
              <button className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-colors">Load Archive</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabButton({ children, active, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all ${
        active 
          ? 'bg-blue-600 text-white shadow-lg' 
          : 'bg-white/5 text-text-dim hover:text-text-main border border-white/10'
      }`}
    >
      {children}
    </button>
  );
}

function QuickStat({ label, val, neg }: any) {
  return (
    <div>
      <div className="text-[10px] font-black text-text-dim uppercase tracking-widest mb-1">{label}</div>
      <div className={`font-mono text-lg font-bold ${neg ? 'text-rose-500' : 'text-emerald-500'}`}>{val}</div>
    </div>
  );
}

function InputStat({ label, val, neg }: any) {
  return (
    <div className="hidden md:block">
      <div className="text-[10px] font-black text-text-dim uppercase tracking-widest mb-1">{label}</div>
      <div className={`font-mono text-lg font-bold ${neg ? 'text-rose-500' : 'text-emerald-500'}`}>{val}</div>
    </div>
  );
}

function TransactionRow({ icon, title, desc, amount, date, status }: any) {
  return (
    <div className="p-8 hover:bg-white/[0.01] transition-colors flex flex-col md:flex-row md:items-center gap-6 group">
      <div className="w-12 h-12 rounded-xl bg-inner-bg border border-border-accent flex items-center justify-center shadow-lg group-hover:border-blue-500/20 transition-all">
        {icon}
      </div>
      <div className="flex-1">
        <h4 className="font-bold text-text-main group-hover:text-blue-100 transition-colors">{title}</h4>
        <p className="text-[10px] text-text-dim font-black uppercase tracking-[0.2em] mt-1">{desc}</p>
      </div>
      <div className="flex items-center gap-8 text-right">
        <div>
          <div className="font-mono font-bold text-text-main">{amount}</div>
          <div className="text-[10px] text-text-dim font-mono mt-1">{date}</div>
        </div>
        <div className="hidden md:block">
          <span className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full text-[9px] font-black uppercase tracking-widest text-text-dim border border-white/10">
            <div className="w-1 h-1 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></div>
            {status}
          </span>
        </div>
      </div>
    </div>
  );
}

function InvoiceItem({ id, amount, label }: any) {
  return (
    <div className="flex items-center justify-between p-4 rounded-2xl bg-inner-bg border border-border-accent group hover:border-blue-500/20 transition-all cursor-pointer">
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 rounded-lg bg-sidebar-bg flex items-center justify-center text-text-dim group-hover:text-blue-400 mt-0.5">
          <Clock size={14} />
        </div>
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-text-main">{id}</div>
          <div className="text-[9px] text-text-dim uppercase tracking-tighter">{label}</div>
        </div>
      </div>
      <div className="text-sm font-black text-emerald-500">{amount}</div>
    </div>
  );
}
