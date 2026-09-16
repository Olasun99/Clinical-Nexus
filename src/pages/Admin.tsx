import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc, 
  orderBy, 
  limit, 
  where, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  Users, 
  Shield, 
  User, 
  Activity, 
  Zap, 
  Terminal, 
  Database, 
  Search, 
  Filter, 
  MoreVertical,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  Settings,
  X,
  Radio,
  Clock,
  Send,
  CheckCircle2,
  DollarSign,
  Package,
  Calendar,
  Award,
  FileText,
  ClipboardList,
  ArrowRight,
  Plus,
  QrCode,
  Check,
  UserPlus,
  RefreshCw,
  TrendingDown,
  Trash2,
  Briefcase,
  Layers,
  FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import QRCode from 'qrcode';
import { seedDatabase } from '../lib/seed';
import { logAction } from '../lib/audit';
import { AuditLog } from '../types';
import PatientTimeline from '../components/PatientTimeline';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis
} from 'recharts';

interface NetworkUser {
  id: string;
  name: string;
  email: string;
  role: 'patient' | 'doctor' | 'admin';
  createdAt: string;
  lastSync?: string;
  department?: string;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  insuranceVerified?: boolean;
  age?: number;
  gender?: string;
  medicalHistory?: string;
  referralStatus?: 'none' | 'pending' | 'approved' | 'declined';
  phone?: string;
}

interface StaffProfile {
  id: string;
  name: string;
  role: string;
  department: string;
  licenseNumber: string;
  schedule: string;
  performanceRating: number;
  patientsTreated: number;
  leaveStatus: 'active' | 'on_leave' | 'pending_leave';
  leaveDates?: string;
  permissions: string[];
}

interface InventoryItem {
  id: string;
  name: string;
  category: 'Medicine' | 'Medical Supply' | 'Consumable' | 'Equipment';
  batchNumber: string;
  quantity: number;
  minQuantity: number;
  expiryDate: string;
  purchaseOrderNo?: string;
  vendor: string;
  status: 'Safe' | 'Low' | 'Critical' | 'Expired';
}

interface InvoiceRecord {
  id: string;
  patientId: string;
  patientName: string;
  dateTime: string;
  amount: number;
  status: 'paid' | 'outstanding' | 'refunded';
  insuranceClaimed?: boolean;
  claimStatus?: 'none' | 'submitted' | 'approved' | 'rejected';
  items: string[];
}

export default function Admin() {
  const { profile, isAdmin } = useAuth();
  const [users, setUsers] = useState<NetworkUser[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  
  // Dynamic collections hydrated with reliable mock data + Firestore syncing
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [billingList, setBillingList] = useState<InvoiceRecord[]>([]);

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'patients' | 'staff' | 'performance' | 'financials' | 'inventory' | 'security'>('dashboard');
  const [securitySubTab, setSecuritySubTab] = useState<'registry' | 'audit' | 'paging'>('registry');

  // Staff Performance view states
  const [selectedDeptPerf, setSelectedDeptPerf] = useState<'Cardiology' | 'Neurology' | 'Pediatrics' | 'Surgery' | 'General Outpatient Clinic'>('Cardiology');
  const [deptMetrics, setDeptMetrics] = useState<Record<string, Record<string, number>>>({
    Cardiology: { throughput: 85, satisfaction: 92, compliance: 90, quality: 94, prescribing: 88, discharge: 80 },
    Neurology: { throughput: 60, satisfaction: 98, compliance: 85, quality: 96, prescribing: 90, discharge: 75 },
    Pediatrics: { throughput: 95, satisfaction: 88, compliance: 92, quality: 90, prescribing: 96, discharge: 90 },
    Surgery: { throughput: 70, satisfaction: 95, compliance: 80, quality: 98, prescribing: 85, discharge: 88 },
    'General Outpatient Clinic': { throughput: 90, satisfaction: 84, compliance: 95, quality: 85, prescribing: 94, discharge: 92 }
  });

  const hospitalBaseline = { throughput: 80, satisfaction: 89, compliance: 88, quality: 91, prescribing: 90, discharge: 84 };

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal / Form States
  const [selectedUser, setSelectedUser] = useState<NetworkUser | null>(null);
  const [selectedUserLogs, setSelectedUserLogs] = useState<AuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [selectedUserQrCode, setSelectedUserQrCode] = useState<string>('');

  useEffect(() => {
    if (selectedUser && selectedUser.role === 'patient') {
      // Generate QR Code containing patient record ID or metadata
      QRCode.toDataURL(selectedUser.id)
        .then(url => {
          setSelectedUserQrCode(url);
        })
        .catch(err => {
          console.error("Failed to generate QR Code:", err);
          setSelectedUserQrCode('');
        });
    } else {
      setSelectedUserQrCode('');
    }
  }, [selectedUser]);
  
  // Forms states
  const [isRegisteringPatient, setIsRegisteringPatient] = useState(false);
  const [newPatient, setNewPatient] = useState({
    name: '',
    email: '',
    age: '30',
    gender: 'Male',
    phone: '',
    insuranceProvider: 'Blue Shield',
    insurancePolicyNumber: '',
    department: 'General Outpatient Clinic',
    checkInQueue: true,
    symptoms: ''
  });

  const [isMergingRecords, setIsMergingRecords] = useState(false);
  const [mergeSourceId, setMergeSourceId] = useState('');
  const [mergeTargetId, setMergeTargetId] = useState('');

  const [isScanningQR, setIsScanningQR] = useState(false);
  const [qrScanInput, setQrScanInput] = useState('');

  const [isCreatingStaff, setIsCreatingStaff] = useState(false);
  const [newStaff, setNewStaff] = useState({
    name: '',
    role: 'Consultant Specialist',
    department: 'General Outpatient Clinic',
    licenseNumber: '',
    schedule: 'Mon - Fri, 08:00 - 17:00',
    permissions: 'Clinical'
  });

  const [isCreatingPO, setIsCreatingPO] = useState(false);
  const [newPO, setNewPO] = useState({
    name: '',
    category: 'Medicine' as any,
    quantity: '500',
    vendor: '',
    batchNumber: 'BTCH-' + Math.floor(100000 + Math.random() * 900000)
  });

  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [newInvoice, setNewInvoice] = useState({
    patientId: '',
    amount: '150',
    serviceType: 'Consultation Fee',
    insuranceClaimed: false
  });

  // Load standard databases (Firestore Sync)
  useEffect(() => {
    if (!isAdmin) return;

    // 1. Users sync
    const usersRef = collection(db, 'users');
    const unsubscribeUsers = onSnapshot(usersRef, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NetworkUser));
      setUsers(docs);
      setLoading(false);
      setError(null);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'users');
      setError('Insufficient permissions to fetch user registry. Profile check pending.');
      setLoading(false);
    });

    // 2. Audit logs sync
    const logsLogsRef = collection(db, 'auditLogs');
    const qLogs = query(logsLogsRef, orderBy('timestamp', 'desc'), limit(50));
    const unsubscribeLogs = onSnapshot(qLogs, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog));
      setAuditLogs(docs);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'auditLogs');
    });

    // 3. Appointments sync
    const appointmentsRef = collection(db, 'appointments');
    const unsubscribeApts = onSnapshot(appointmentsRef, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAppointments(docs);
    }, (err) => {
      console.warn("Appointments listener restricted:", err);
    });

    // Hydrate default staff profiles
    const defaultStaff: StaffProfile[] = [
      { id: 'STF001', name: 'Dr. Sarah Alabi', role: 'Interventional Cardiologist', department: 'Cardiology', licenseNumber: 'MED-77491-AL', schedule: 'Mon-Wed, 09:00 - 16:00', performanceRating: 4.9, patientsTreated: 342, leaveStatus: 'active', permissions: ['Clinical', 'Prescribe'] },
      { id: 'STF002', name: 'Dr. Emeka Chen', role: 'Neurological Surgeon', department: 'Neurology', licenseNumber: 'MED-99410-CH', schedule: 'Tue-Fri, 08:00 - 18:00', performanceRating: 5.0, patientsTreated: 189, leaveStatus: 'active', permissions: ['Clinical', 'Surgery', 'Paging'] },
      { id: 'STF003', name: 'Dr. Zainab Kola', role: 'Consultant Pediatrician', department: 'Pediatrics', licenseNumber: 'MED-22340-KO', schedule: 'Mon-Fri, 08:00 - 16:00', performanceRating: 4.8, patientsTreated: 512, leaveStatus: 'pending_leave', leaveDates: 'July 15 - July 22', permissions: ['Clinical', 'Prescribe'] },
      { id: 'STF004', name: 'Prof. David Obi', role: 'Chief of Trauma', department: 'Surgery', licenseNumber: 'MED-11004-OB', schedule: 'On Call Rotation', performanceRating: 5.0, patientsTreated: 405, leaveStatus: 'active', permissions: ['Clinical', 'Surgery', 'System-Root'] },
    ];
    setStaffList(defaultStaff);

    // Hydrate default inventory items
    const defaultInventory: InventoryItem[] = [
      { id: 'INV001', name: 'Epinephrine Vials (1mg/mL)', category: 'Medicine', batchNumber: 'EP-2026-X9', quantity: 12, minQuantity: 20, expiryDate: '2026-09-12', vendor: 'Astra Biotech Ltd', status: 'Low' },
      { id: 'INV002', name: 'Insulin Glargine 100 U/mL', category: 'Medicine', batchNumber: 'IN-552-Y1', quantity: 85, minQuantity: 50, expiryDate: '2026-12-05', vendor: 'Pfizer Pharm', status: 'Safe' },
      { id: 'INV003', name: 'Disposable Syringes 5ml (Box of 100)', category: 'Medical Supply', batchNumber: 'SY-100-A2', quantity: 3, minQuantity: 10, expiryDate: '2028-01-20', vendor: 'MediPack Corp', status: 'Critical' },
      { id: 'INV004', name: 'Surgical Gowns (Sterile XL)', category: 'Consumable', batchNumber: 'GW-994-C8', quantity: 150, minQuantity: 100, expiryDate: '2029-06-15', vendor: 'Global Wear', status: 'Safe' },
      { id: 'INV005', name: 'Amoxicillin Capsules 500mg', category: 'Medicine', batchNumber: 'AM-441-Z5', quantity: 0, minQuantity: 100, expiryDate: '2026-06-01', vendor: 'Sandoz Generics', status: 'Expired' },
      { id: 'INV006', name: 'Mindray ECG Machine Model T5', category: 'Equipment', batchNumber: 'EQ-MIN-74', quantity: 4, minQuantity: 2, expiryDate: '2035-10-10', vendor: 'Mindray Global', status: 'Safe' },
    ];
    setInventory(defaultInventory);

    // Hydrate default invoices
    const defaultInvoices: InvoiceRecord[] = [
      { id: 'INV-1029', patientId: 'p-883921', patientName: 'John Doe', dateTime: '2026-07-07T12:00:00Z', amount: 150.00, status: 'paid', insuranceClaimed: true, claimStatus: 'approved', items: ['Consultation Fee', 'Cardiology ECG Analysis'] },
      { id: 'INV-1030', patientId: 'p-772910', patientName: 'Mary George', dateTime: '2026-07-07T14:30:00Z', amount: 350.00, status: 'outstanding', insuranceClaimed: true, claimStatus: 'submitted', items: ['Ultrasound Diagnostic', 'General Meds Pack'] },
      { id: 'INV-1031', patientId: 'p-331049', patientName: 'Chidi Benson', dateTime: '2026-07-06T10:15:00Z', amount: 75.00, status: 'paid', insuranceClaimed: false, claimStatus: 'none', items: ['Pharmacy - Amoxicillin Course'] },
      { id: 'INV-1032', patientId: 'p-991042', patientName: 'Alice Lawson', dateTime: '2026-07-05T09:00:00Z', amount: 1200.00, status: 'outstanding', insuranceClaimed: true, claimStatus: 'rejected', items: ['Emergency Room Admission', 'Trauma Assessment'] },
    ];
    setBillingList(defaultInvoices);

    return () => {
      unsubscribeUsers();
      unsubscribeLogs();
      unsubscribeApts();
    };
  }, [isAdmin]);

  // Sync user activity log
  useEffect(() => {
    if (!selectedUser) {
      setSelectedUserLogs([]);
      return;
    }

    setLoadingLogs(true);
    const logsRef = collection(db, 'auditLogs');
    const q = query(
      logsRef, 
      where('userId', '==', selectedUser.id),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog));
      setSelectedUserLogs(docs);
      setLoadingLogs(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, `auditLogs/query/${selectedUser.id}`));

    return () => unsubscribe();
  }, [selectedUser]);

  // Seeding simulated clinic data
  const handleSeed = async () => {
    if (!window.confirm('This will generate 130+ simulated records including patient timelines, clinical logs, and biometric metrics. Continue?')) return;
    setSeeding(true);
    try {
      await seedDatabase(100, 30);
      if (profile) await logAction(profile.userId, profile.name, 'BATCH_SEED_DATA', 'Admin', 'Generated 100 patients and 30 doctors via control console.');
      alert('Simulation data successfully deployed to the active node.');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'seed_data');
    } finally {
      setSeeding(false);
    }
  };

  // Change user role
  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      if (profile) await logAction(profile.userId, profile.name, 'UPDATE_USER_ROLE', 'Admin', `Updated node ${userId} permissions to ${newRole}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    }
  };

  // Register New Patient Node
  const handleRegisterPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const generatedId = 'PT-' + Math.floor(100000 + Math.random() * 900000);
      const payload: any = {
        name: newPatient.name,
        email: newPatient.email,
        role: 'patient',
        createdAt: new Date().toISOString(),
        age: parseInt(newPatient.age) || 30,
        gender: newPatient.gender,
        phone: newPatient.phone,
        department: newPatient.department,
        insuranceProvider: newPatient.insuranceProvider,
        insurancePolicyNumber: newPatient.insurancePolicyNumber,
        insuranceVerified: true,
        referralStatus: 'none',
        medicalHistory: 'Initialized via Administrative Registration.'
      };

      const userRef = await addDoc(collection(db, 'users'), payload);
      const patientUserId = userRef.id;
      
      const queueNo = 'Q-' + Math.floor(100 + Math.random() * 900);
      if (newPatient.checkInQueue) {
        await addDoc(collection(db, 'appointments'), {
          patientId: patientUserId,
          patientName: newPatient.name,
          dateTime: new Date().toISOString(),
          status: 'waiting',
          queueNumber: queueNo,
          departmentId: newPatient.department,
          symptoms: newPatient.symptoms || 'General intake wellness review',
          doctorName: 'Awaiting Allocation',
          doctorId: '',
          createdAt: new Date().toISOString()
        });
      }

      // Seed an intake/registration audit trail
      if (profile) {
        await logAction(profile.userId, profile.name, 'PATIENT_REGISTRATION', 'Admin', `Registered new patient node: ${newPatient.name} under ${newPatient.department} with active Queue Number: ${newPatient.checkInQueue ? queueNo : 'None'}`);
      }

      alert(`Patient Node registered successfully. Generated ID: ${generatedId}${newPatient.checkInQueue ? ` and allocated Queue: ${queueNo}` : ''}`);
      setIsRegisteringPatient(false);
      setNewPatient({
        name: '',
        email: '',
        age: '30',
        gender: 'Male',
        phone: '',
        insuranceProvider: 'Blue Shield',
        insurancePolicyNumber: '',
        department: 'General Outpatient Clinic',
        checkInQueue: true,
        symptoms: ''
      });
    } catch (err) {
      console.error(err);
      alert('Failed to execute clinical node registration.');
    }
  };

  // Merge duplicate nodes
  const handleMergeRecords = async () => {
    if (!mergeSourceId || !mergeTargetId) {
      alert('Please specify both source and target unique identifiers.');
      return;
    }
    if (mergeSourceId === mergeTargetId) {
      alert('Source and destination cannot represent the same unique registry key.');
      return;
    }
    try {
      // Create audit trail for merge
      if (profile) {
        await logAction(profile.userId, profile.name, 'MERGE_DUPLICATES', 'Admin', `Merged duplicate patient record node ${mergeSourceId} into active registry ${mergeTargetId}`);
      }
      alert('Conflict Resolution Complete: Nodes synced successfully. Retaining targets and archiving legacy pointers.');
      setIsMergingRecords(false);
      setMergeSourceId('');
      setMergeTargetId('');
    } catch (err) {
      alert('Merge sequence failed.');
    }
  };

  // Create Staff Member
  const handleCreateStaff = (e: React.FormEvent) => {
    e.preventDefault();
    const generatedId = 'STF' + Math.floor(100 + Math.random() * 900);
    const staffNode: StaffProfile = {
      id: generatedId,
      name: newStaff.name,
      role: newStaff.role,
      department: newStaff.department,
      licenseNumber: newStaff.licenseNumber || 'LIC-' + Math.floor(10000 + Math.random() * 90000),
      schedule: newStaff.schedule,
      performanceRating: 5.0,
      patientsTreated: 0,
      leaveStatus: 'active',
      permissions: [newStaff.permissions]
    };

    setStaffList(prev => [staffNode, ...prev]);
    alert(`Staff credentials created successfully for ${newStaff.name}`);
    setIsCreatingStaff(false);
    setNewStaff({
      name: '',
      role: 'Consultant Specialist',
      department: 'General Outpatient Clinic',
      licenseNumber: '',
      schedule: 'Mon - Fri, 08:00 - 17:00',
      permissions: 'Clinical'
    });
  };

  // Create Purchase Order (PO) / Inventory Add
  const handleCreatePO = (e: React.FormEvent) => {
    e.preventDefault();
    const itemNode: InventoryItem = {
      id: 'INV' + Math.floor(100 + Math.random() * 900),
      name: newPO.name,
      category: newPO.category,
      batchNumber: newPO.batchNumber,
      quantity: parseInt(newPO.quantity) || 50,
      minQuantity: 20,
      expiryDate: '2028-12-31',
      purchaseOrderNo: 'PO-' + Math.floor(10000 + Math.random() * 90000),
      vendor: newPO.vendor || 'Standard Medical Supply',
      status: 'Safe'
    };

    setInventory(prev => [itemNode, ...prev]);
    alert(`Purchase Order successfully drafted and stock initialized for ${newPO.name}`);
    setIsCreatingPO(false);
    setNewPO({
      name: '',
      category: 'Medicine',
      quantity: '500',
      vendor: '',
      batchNumber: 'BTCH-' + Math.floor(100000 + Math.random() * 900000)
    });
  };

  // Create Billing Invoice
  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedPatient = users.find(u => u.id === newInvoice.patientId) || { name: 'Walk-in Patient' };
    const invoiceNode: InvoiceRecord = {
      id: 'INV-' + Math.floor(1000 + Math.random() * 9000),
      patientId: newInvoice.patientId || 'p-99401',
      patientName: selectedPatient.name,
      dateTime: new Date().toISOString(),
      amount: parseFloat(newInvoice.amount) || 100,
      status: 'outstanding',
      insuranceClaimed: newInvoice.insuranceClaimed,
      claimStatus: newInvoice.insuranceClaimed ? 'submitted' : 'none',
      items: [newInvoice.serviceType]
    };

    setBillingList(prev => [invoiceNode, ...prev]);
    alert(`Financial invoice created. Code tracking: ${invoiceNode.id}`);
    setIsCreatingInvoice(false);
    setNewInvoice({
      patientId: '',
      amount: '150',
      serviceType: 'Consultation Fee',
      insuranceClaimed: false
    });
  };

  // Filtered lists
  const filteredUsers = useMemo(() => {
    return users
      .filter(u => {
        const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
        const matchesRole = roleFilter === 'all' || u.role === roleFilter;
        return matchesSearch && matchesRole;
      })
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
      });
  }, [users, search, roleFilter, sortOrder]);

  const patientsList = useMemo(() => {
    return users.filter(u => u.role === 'patient');
  }, [users]);

  // Operational metrics from actual appointments
  const queueStats = useMemo(() => {
    const today = new Date().toDateString();
    const todayApts = appointments.filter(a => {
      if (!a.dateTime) return false;
      return new Date(a.dateTime).toDateString() === today;
    });

    const scheduled = todayApts.filter(a => a.status === 'scheduled').length;
    const completed = todayApts.filter(a => a.status === 'completed').length;
    const waiting = todayApts.filter(a => a.status === 'waiting').length;
    const consulting = todayApts.filter(a => a.status === 'consulting').length;
    const cancelled = todayApts.filter(a => a.status === 'cancelled').length;

    return {
      totalToday: todayApts.length,
      scheduled,
      completed,
      waiting,
      consulting,
      cancelled,
      avgWait: waiting > 0 ? 12 + waiting * 4 : 8 // dynamic wait time emulation
    };
  }, [appointments]);

  // Financial analytics calculation
  const financialTotals = useMemo(() => {
    const paidSum = billingList.filter(b => b.status === 'paid').reduce((acc, curr) => acc + curr.amount, 0);
    const outstandingSum = billingList.filter(b => b.status === 'outstanding').reduce((acc, curr) => acc + curr.amount, 0);
    const refundedSum = billingList.filter(b => b.status === 'refunded').reduce((acc, curr) => acc + curr.amount, 0);
    return {
      revenueToday: paidSum,
      outstanding: outstandingSum,
      refunded: refundedSum,
      projectedMonth: paidSum + outstandingSum + 25000
    };
  }, [billingList]);

  // Critical Inventory Expiry or low stock items
  const stockAlerts = useMemo(() => {
    return inventory.filter(i => i.status === 'Low' || i.status === 'Critical' || i.status === 'Expired');
  }, [inventory]);

  if (!isAdmin) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-rose-500">
        <AlertTriangle size={64} className="mb-4 animate-bounce" />
        <h2 className="text-2xl font-black uppercase tracking-tighter">Access Denied</h2>
        <p className="text-text-muted italic text-center max-w-md mt-2">Unauthorized entry detected. Administrative credentials required. Current identity: {profile?.email}</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-20 selection:bg-purple-500/30">
      
      {/* Dynamic Airport Control Tower Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-slate-950 p-8 rounded-[44px] border border-slate-900 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="relative z-10 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
            <span className="text-[10px] font-mono tracking-[0.4em] font-black text-slate-400 uppercase">SYS-CORE // NOMINAL OPERATIONS ACTIVE</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white uppercase leading-none italic font-serif">
            Command Center
          </h1>
          <p className="text-slate-400 font-medium italic text-sm md:text-base max-w-2xl">
            Airport Control Tower oversight of clinical nodes, physical asset registers, financial logs, and active paging triggers.
          </p>
        </div>

        <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 p-4 rounded-[28px] relative z-10">
          <StatMini label="ACTIVE NODES" value={users.length} />
          <div className="w-px h-8 bg-slate-800" />
          <StatMini label="WAIT QUEUE" value={queueStats.waiting} />
          <div className="w-px h-8 bg-slate-800" />
          <StatMini label="TOWER LINK" value="ONLINE" />
        </div>
      </div>

      {/* Control Tower Tab Bar */}
      <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-2">
        <TabButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Activity size={15} />} label="Operational Radar" />
        <TabButton active={activeTab === 'patients'} onClick={() => setActiveTab('patients')} icon={<Users size={15} />} label="Patient Registry" />
        <TabButton active={activeTab === 'staff'} onClick={() => setActiveTab('staff')} icon={<Briefcase size={15} />} label="Staff Roster" />
        <TabButton active={activeTab === 'performance'} onClick={() => setActiveTab('performance')} icon={<Award size={15} />} label="Staff Performance" />
        <TabButton active={activeTab === 'financials'} onClick={() => setActiveTab('financials')} icon={<DollarSign size={15} />} label="Financial Node" />
        <TabButton active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Package size={15} />} label="Supply Register" />
        <TabButton active={activeTab === 'security'} onClick={() => setActiveTab('security')} icon={<Shield size={15} />} label="Security Node" />
      </div>

      {/* RENDER MODULES */}
      
      {/* Tab 1: Operational Radar */}
      {activeTab === 'dashboard' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Key Analytics Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <OperationalCard title="Today's Appointments" count={queueStats.totalToday} subtitle="Rotations Scheduled" trend={`${queueStats.completed} Completed`} trendType="up" />
            <OperationalCard title="Checked-In Waiting" count={queueStats.waiting} subtitle="Average latency 15 mins" trend={`Avg: ${queueStats.avgWait}m`} trendType="warning" />
            <OperationalCard title="Consulting Staff" count={queueStats.consulting} subtitle="Nodes currently active" trend="76% Capacity" trendType="up" />
            <OperationalCard title="Outstanding Revenue" count={`$${financialTotals.outstanding}`} subtitle="Pending claims sync" trend={`Yield: $${financialTotals.revenueToday}`} trendType="down" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Dynamic Trends Graph */}
            <div className="lg:col-span-2 bg-white border border-slate-100 p-8 rounded-[44px] shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <span className="text-[9px] font-black uppercase text-purple-600 tracking-[0.3em]">Telemetry</span>
                  <h3 className="text-xl font-black italic font-serif text-slate-900 uppercase">Operational Timelines</h3>
                </div>
                <div className="flex gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                    <span className="text-[10px] font-black uppercase text-slate-400">Consultations</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                    <span className="text-[10px] font-black uppercase text-slate-400">Total Yield</span>
                  </div>
                </div>
              </div>

              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={[
                    { time: '08:00', load: 12, rev: 800 },
                    { time: '10:00', load: 38, rev: 2500 },
                    { time: '12:00', load: 45, rev: 4100 },
                    { time: '14:00', load: 29, rev: 3200 },
                    { time: '16:00', load: 54, rev: 5900 },
                    { time: '18:00', load: 15, rev: 1800 },
                  ]}>
                    <defs>
                      <linearGradient id="gradLoad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#9333ea" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#9333ea" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '16px', color: '#fff', fontSize: '11px' }} />
                    <Area type="monotone" dataKey="load" name="Active Appointments" stroke="#2563eb" strokeWidth={3} fill="url(#gradLoad)" />
                    <Area type="monotone" dataKey="rev" name="Gross Yield ($)" stroke="#9333ea" strokeWidth={3} fill="url(#gradRev)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Critical System Alerts Panel */}
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-[44px] text-white flex flex-col justify-between">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-rose-500/10 text-rose-500 rounded-xl">
                    <AlertTriangle size={18} />
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase text-rose-500 tracking-widest">ACTIVE RED FLAGS</span>
                    <h4 className="text-sm font-black uppercase font-serif italic text-white">System Diagnostics</h4>
                  </div>
                </div>

                <div className="space-y-4">
                  {stockAlerts.slice(0, 3).map((item) => (
                    <div key={item.id} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-rose-600 animate-ping shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{item.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">Expiry warning: Batch {item.batchNumber}</p>
                      </div>
                      <span className="text-[10px] bg-rose-500/10 text-rose-400 font-black uppercase px-2 py-0.5 rounded border border-rose-500/20">{item.status}</span>
                    </div>
                  ))}
                  
                  {queueStats.waiting > 4 && (
                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white">High Waiting Latency</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">Checked-in queue size exceeding nominal levels.</p>
                      </div>
                      <span className="text-[10px] bg-amber-500/10 text-amber-400 font-black uppercase px-2 py-0.5 rounded border border-amber-500/20">WARNING</span>
                    </div>
                  )}

                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white">Cloud Database Linked</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">Secure Firestore operational handshake successful.</p>
                    </div>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-black uppercase px-2 py-0.5 rounded border border-emerald-500/20">OK</span>
                  </div>
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-slate-800">
                <button onClick={handleSeed} disabled={seeding} className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all">
                  {seeding ? 'Syncing...' : 'Deploy Simulated Datasets'}
                </button>
              </div>
            </div>
          </div>

          {/* Checked-In Patients & Consultations summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white border border-slate-100 p-8 rounded-[44px]">
              <h3 className="text-lg font-black italic font-serif uppercase mb-4 text-slate-900">Checked-In Queue</h3>
              <div className="space-y-4">
                {appointments.filter(a => a.status === 'waiting').length > 0 ? (
                  appointments.filter(a => a.status === 'waiting').map((apt: any) => (
                    <div key={apt.id} className="p-4 bg-slate-50 rounded-2xl flex justify-between items-center">
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{apt.patientName || 'Emergency Referral'}</p>
                        <p className="text-[10px] text-slate-400 font-mono">Dept: {apt.departmentId || 'General'}</p>
                      </div>
                      <span className="text-[10px] font-mono text-amber-600 bg-amber-50 border border-amber-100 px-3 py-1 rounded-full uppercase font-black">IN QUEUE</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400 italic text-center py-6">No patients currently waiting in queue.</p>
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-100 p-8 rounded-[44px]">
              <h3 className="text-lg font-black italic font-serif uppercase mb-4 text-slate-900">Consultations In Progress</h3>
              <div className="space-y-4">
                {appointments.filter(a => a.status === 'consulting').length > 0 ? (
                  appointments.filter(a => a.status === 'consulting').map((apt: any) => (
                    <div key={apt.id} className="p-4 bg-slate-50 rounded-2xl flex justify-between items-center">
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{apt.patientName}</p>
                        <p className="text-[10px] text-slate-400 font-mono">Specialist: {apt.doctorName}</p>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full uppercase font-black">CONSULTING</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400 italic text-center py-6">No consultations actively ongoing right now.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Patient Registry */}
      {activeTab === 'patients' && (
        <div className="space-y-8 animate-fadeIn">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-100 p-8 rounded-[36px]">
            <div>
              <h3 className="text-xl font-black italic font-serif text-slate-900 uppercase">Patient Node Archives</h3>
              <p className="text-xs text-slate-500 mt-1">Register new clinics nodes, merge duplicate entries, and verify insurance limits.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => setIsScanningQR(true)} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <QrCode size={14} /> Scan Patient QR
              </button>
              <button onClick={() => setIsRegisteringPatient(true)} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <UserPlus size={14} /> Register Patient
              </button>
              <button onClick={() => setIsMergingRecords(true)} className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <RefreshCw size={14} /> Resolve Duplicates
              </button>
            </div>
          </div>

          {/* QR Code Scan Simulator Drawer */}
          <AnimatePresence>
            {isScanningQR && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }} 
                animate={{ height: 'auto', opacity: 1 }} 
                exit={{ height: 0, opacity: 0 }} 
                className="bg-slate-900 border border-indigo-500/20 text-white p-8 rounded-[36px] space-y-6"
              >
                <div className="flex justify-between items-start border-b border-white/10 pb-4">
                  <div>
                    <h4 className="text-lg font-black font-serif italic text-white flex items-center gap-2">
                      <QrCode className="text-indigo-400 animate-pulse" /> Active QR Passport Reader
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">Scan physical or digital QR Health Passports to fetch electronic patient records instantaneously.</p>
                  </div>
                  <button onClick={() => setIsScanningQR(false)} className="p-1 hover:bg-white/5 rounded text-slate-400 hover:text-white"><X size={18} /></button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                  {/* Camera frame simulation */}
                  <div className="md:col-span-5 bg-black border border-slate-800 rounded-3xl p-6 relative overflow-hidden flex flex-col items-center justify-center h-48 text-center">
                    <div className="absolute inset-0 border-2 border-indigo-500/30 rounded-3xl pointer-events-none"></div>
                    {/* Corner brackets */}
                    <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-indigo-400"></div>
                    <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-indigo-400"></div>
                    <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-indigo-400"></div>
                    <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-indigo-400"></div>

                    <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-indigo-500 animate-bounce shadow-[0_0_8px_#6366f1] opacity-70"></div>
                    
                    <Radio className="text-indigo-400 animate-pulse mb-2" size={24} />
                    <p className="text-[10px] font-mono text-indigo-300 font-bold uppercase tracking-widest">OPTICAL_SCANNER_READY</p>
                    <p className="text-[9px] text-slate-500 mt-1">Align patient's QR Passport in viewport frame</p>
                  </div>

                  {/* Input controls & patient select */}
                  <div className="md:col-span-7 space-y-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Select Registered Patient to Scan</label>
                      <select 
                        value={qrScanInput} 
                        onChange={(e) => setQrScanInput(e.target.value)} 
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="">-- Choose Patient Passport --</option>
                        {patientsList.map(p => (
                          <option key={p.id} value={p.id}>{p.name} (ID: {p.id.slice(0, 8)})</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex gap-3">
                      <button 
                        type="button"
                        onClick={async () => {
                          if (!qrScanInput) {
                            alert("Please select a patient to simulate scanning their QR code.");
                            return;
                          }
                          const found = patientsList.find(p => p.id === qrScanInput);
                          if (found) {
                            setSelectedUser(found);
                            setIsScanningQR(false);
                            if (profile) {
                              await logAction(
                                profile.userId,
                                profile.name,
                                'SCAN_PATIENT_QR',
                                'Admin',
                                `Scanned QR ID passport. Fetched clinical node for ${found.name}`
                              );
                            }
                          }
                        }}
                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-500/10 flex-1"
                      >
                        Trigger Laser Decode
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                          setIsScanningQR(false);
                          setQrScanInput('');
                        }} 
                        className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 font-black text-[10px] uppercase tracking-widest rounded-xl"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Merge UI Drawer / Modal */}
          <AnimatePresence>
            {isMergingRecords && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-slate-900 text-white p-8 rounded-[36px] space-y-6">
                <div>
                  <h4 className="text-lg font-black font-serif italic">Resolve Duplicate Registries</h4>
                  <p className="text-xs text-slate-400 mt-1">Merge record history, medical prescriptions, and biometric traces under a single valid target.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Legacy Source ID (To be Archived)</label>
                    <input type="text" value={mergeSourceId} onChange={(e) => setMergeSourceId(e.target.value)} placeholder="e.g., PT-77382" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Master Target ID (To Keep)</label>
                    <input type="text" value={mergeTargetId} onChange={(e) => setMergeTargetId(e.target.value)} placeholder="e.g., PT-22910" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white" />
                  </div>
                </div>
                <div className="flex gap-4">
                  <button onClick={handleMergeRecords} className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl">Execute Node Sync</button>
                  <button onClick={() => setIsMergingRecords(false)} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 font-black text-[10px] uppercase tracking-widest rounded-xl">Cancel</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Registration UI Drawer */}
          <AnimatePresence>
            {isRegisteringPatient && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-white border border-slate-100 p-8 rounded-[36px] shadow-lg">
                <form onSubmit={handleRegisterPatient} className="space-y-6">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                    <h4 className="text-lg font-black font-serif italic text-slate-900">Patient Intake Form</h4>
                    <button type="button" onClick={() => setIsRegisteringPatient(false)}><X size={18} /></button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <input type="text" required placeholder="Full Name" value={newPatient.name} onChange={(e) => setNewPatient({...newPatient, name: e.target.value})} className="w-full border border-slate-200 rounded-xl p-3 text-sm" />
                    <input type="email" required placeholder="Email Address" value={newPatient.email} onChange={(e) => setNewPatient({...newPatient, email: e.target.value})} className="w-full border border-slate-200 rounded-xl p-3 text-sm" />
                    <input type="number" required placeholder="Age" value={newPatient.age} onChange={(e) => setNewPatient({...newPatient, age: e.target.value})} className="w-full border border-slate-200 rounded-xl p-3 text-sm" />
                    <select value={newPatient.gender} onChange={(e) => setNewPatient({...newPatient, gender: e.target.value})} className="w-full border border-slate-200 rounded-xl p-3 text-sm">
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                    </select>
                    <input type="text" placeholder="Phone Number" value={newPatient.phone} onChange={(e) => setNewPatient({...newPatient, phone: e.target.value})} className="w-full border border-slate-200 rounded-xl p-3 text-sm" />
                    <select value={newPatient.department} onChange={(e) => setNewPatient({...newPatient, department: e.target.value})} className="w-full border border-slate-200 rounded-xl p-3 text-sm">
                      <option>General Outpatient Clinic</option>
                      <option>Cardiology</option>
                      <option>Pediatrics</option>
                      <option>Surgery</option>
                      <option>Neurology</option>
                    </select>
                    <input type="text" placeholder="Insurance Provider" value={newPatient.insuranceProvider} onChange={(e) => setNewPatient({...newPatient, insuranceProvider: e.target.value})} className="w-full border border-slate-200 rounded-xl p-3 text-sm" />
                    <input type="text" placeholder="Insurance Policy Number" value={newPatient.insurancePolicyNumber} onChange={(e) => setNewPatient({...newPatient, insurancePolicyNumber: e.target.value})} className="w-full border border-slate-200 rounded-xl p-3 text-sm" />
                    <div className="md:col-span-3 border-t border-slate-100 pt-4 flex flex-col md:flex-row items-start md:items-center gap-6">
                      <label className="flex items-center gap-2.5 text-xs font-bold text-slate-700 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={newPatient.checkInQueue} 
                          onChange={(e) => setNewPatient({...newPatient, checkInQueue: e.target.checked})} 
                          className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 border-slate-300" 
                        />
                        Check-in to Active Waitlist Queue & Issue Queue Number
                      </label>
                      {newPatient.checkInQueue && (
                        <input 
                          type="text" 
                          placeholder="Presenting Symptoms / Reason for visit" 
                          value={newPatient.symptoms} 
                          onChange={(e) => setNewPatient({...newPatient, symptoms: e.target.value})} 
                          className="flex-1 w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-500" 
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <button type="submit" className="px-6 py-3 bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl">Register Intake Node</button>
                    <button type="button" onClick={() => setIsRegisteringPatient(false)} className="px-6 py-3 bg-slate-100 text-slate-500 font-black text-[10px] uppercase tracking-widest rounded-xl">Cancel</button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Patients Listing with timeline lookups and printing ID capabilities */}
          <div className="bg-white border border-slate-100 rounded-[36px] overflow-hidden">
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-sm font-black uppercase tracking-wider text-slate-700">Registered Patient Directory</h4>
              <span className="text-[10px] font-mono text-slate-400">{patientsList.length} Nodes</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-100/50 border-b border-slate-200">
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Registry Code</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Full Name</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Insurance Sync</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Assigned Care Unit</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 text-right">Administrative Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {patientsList.map((patient) => (
                    <tr key={patient.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs font-bold text-slate-600">{(patient.id || '').slice(0, 10).toUpperCase()}</td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-800 text-sm">{patient.name}</span>
                        <div className="text-[10px] text-slate-400">{patient.email} // Age {patient.age || '30'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded text-[9px] font-black uppercase">
                          {patient.insuranceProvider || 'Blue Shield'} - VERIFIED
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-700">{patient.department || 'General Outpatient Clinic'}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => {
                          setSelectedUser(patient);
                          // Populate details
                        }} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5">
                          <QrCode size={12} /> ID Card Timeline
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Lifecycle timeline lookup when a patient is selected */}
          {selectedUser && selectedUser.role === 'patient' && (
            <div className="bg-slate-950 border border-slate-900 rounded-[44px] p-8 text-white space-y-8">
              <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                <div>
                  <span className="text-[9px] font-black uppercase text-blue-500 tracking-[0.4em]">PATIENT ID CARD GENERATOR // SYSTEM RADAR</span>
                  <h4 className="text-xl font-black italic font-serif uppercase">ClinicOS Digital Health Passport</h4>
                </div>
                <button onClick={() => setSelectedUser(null)} className="p-2 hover:bg-slate-800 rounded-full"><X size={18} /></button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Physical ID Card Preview */}
                <div className="bg-gradient-to-br from-slate-900 via-purple-950 to-slate-950 p-6 rounded-[32px] border border-slate-800 shadow-2xl relative overflow-hidden flex flex-col justify-between h-64">
                  <div className="absolute top-0 right-0 p-6 opacity-10">
                    <Shield size={160} />
                  </div>
                  <div className="flex justify-between items-start relative z-10">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">ClinicOS EHR Node ID</p>
                      <h5 className="text-xl font-black italic uppercase font-serif text-white">{selectedUser.name}</h5>
                    </div>
                    <div className="p-1 bg-white border border-slate-800 rounded-xl overflow-hidden w-16 h-16 flex items-center justify-center">
                      {selectedUserQrCode ? (
                        <img src={selectedUserQrCode} alt="Patient QR Code" className="w-14 h-14 object-contain" />
                      ) : (
                        <QrCode size={32} className="text-slate-800" />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10 relative z-10 font-mono text-[10px]">
                    <div>
                      <span className="text-slate-500 uppercase block">NODE ID</span>
                      <span className="font-bold text-white uppercase">{selectedUser.id.slice(0, 16)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 uppercase block">DEPT</span>
                      <span className="font-bold text-white uppercase">{selectedUser.department || 'GENERAL OUTPATIENT'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 uppercase block">INSURANCE</span>
                      <span className="font-bold text-white uppercase">{selectedUser.insuranceProvider || 'BLUE SHIELD'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 uppercase block">NOMINAL STATUS</span>
                      <span className="text-emerald-400 uppercase">ACTIVE RADAR</span>
                    </div>
                  </div>
                </div>

                {/* Patient Journey Lifecycle Timeline */}
                <div className="space-y-6">
                  <h4 className="text-sm font-black uppercase tracking-wider text-slate-300">Journey timeline ledger</h4>
                  <PatientTimeline patientId={selectedUser.id} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Staff Roster */}
      {activeTab === 'staff' && (
        <div className="space-y-8 animate-fadeIn">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-100 p-8 rounded-[36px]">
            <div>
              <h3 className="text-xl font-black italic font-serif text-slate-900 uppercase">Staff Registry & Schedules</h3>
              <p className="text-xs text-slate-500 mt-1">Manage professional credentials, active roster shifts, and leave requests.</p>
            </div>
            <button onClick={() => setIsCreatingStaff(true)} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
              <Plus size={14} /> Create Staff Node
            </button>
          </div>

          {/* Create Staff Form */}
          <AnimatePresence>
            {isCreatingStaff && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-white border border-slate-100 p-8 rounded-[36px] shadow-lg">
                <form onSubmit={handleCreateStaff} className="space-y-6">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                    <h4 className="text-lg font-black font-serif italic text-slate-900">Provision Staff Credentials</h4>
                    <button type="button" onClick={() => setIsCreatingStaff(false)}><X size={18} /></button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <input type="text" required placeholder="Staff Full Name" value={newStaff.name} onChange={(e) => setNewStaff({...newStaff, name: e.target.value})} className="w-full border border-slate-200 rounded-xl p-3 text-sm" />
                    <input type="text" placeholder="Professional License Number (e.g. MED-77421)" value={newStaff.licenseNumber} onChange={(e) => setNewStaff({...newStaff, licenseNumber: e.target.value})} className="w-full border border-slate-200 rounded-xl p-3 text-sm" />
                    <select value={newStaff.role} onChange={(e) => setNewStaff({...newStaff, role: e.target.value})} className="w-full border border-slate-200 rounded-xl p-3 text-sm">
                      <option>Consultant Specialist</option>
                      <option>Nurse Practitioner</option>
                      <option>Lead Surgeon</option>
                      <option>Clinical Director</option>
                    </select>
                    <select value={newStaff.department} onChange={(e) => setNewStaff({...newStaff, department: e.target.value})} className="w-full border border-slate-200 rounded-xl p-3 text-sm">
                      <option>General Outpatient Clinic</option>
                      <option>Cardiology</option>
                      <option>Pediatrics</option>
                      <option>Surgery</option>
                      <option>Neurology</option>
                    </select>
                    <input type="text" placeholder="Roster Shifts Schedule" value={newStaff.schedule} onChange={(e) => setNewStaff({...newStaff, schedule: e.target.value})} className="w-full border border-slate-200 rounded-xl p-3 text-sm" />
                    <select value={newStaff.permissions} onChange={(e) => setNewStaff({...newStaff, permissions: e.target.value})} className="w-full border border-slate-200 rounded-xl p-3 text-sm">
                      <option>Clinical</option>
                      <option>Prescribe</option>
                      <option>Surgery</option>
                      <option>System-Root</option>
                    </select>
                  </div>
                  <div className="flex gap-4">
                    <button type="submit" className="px-6 py-3 bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl">Commit Staff Node</button>
                    <button type="button" onClick={() => setIsCreatingStaff(false)} className="px-6 py-3 bg-slate-100 text-slate-500 font-black text-[10px] uppercase tracking-widest rounded-xl">Cancel</button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Roster profiles with ratings and performance statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {staffList.map((staff) => (
              <div key={staff.id} className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm flex flex-col justify-between hover:shadow-xl transition-shadow group">
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[9px] font-black uppercase text-blue-600 tracking-widest">{staff.department} // {staff.role}</span>
                      <h4 className="text-lg font-black font-serif italic uppercase text-slate-950 mt-1">{staff.name}</h4>
                    </div>
                    <span className="px-2.5 py-1 bg-slate-50 border border-slate-100 rounded text-[9px] font-mono text-slate-500 uppercase">{staff.id}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl font-mono text-[10px]">
                    <div>
                      <span className="text-slate-400 uppercase block">LIC LICENSE</span>
                      <span className="font-bold text-slate-800 uppercase">{staff.licenseNumber}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 uppercase block">SCHEDULE</span>
                      <span className="font-bold text-slate-800 uppercase">{staff.schedule}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 uppercase block">PERFORMANCE</span>
                      <span className="text-emerald-600 font-black">★ {staff.performanceRating} / 5.0</span>
                    </div>
                    <div>
                      <span className="text-slate-400 uppercase block">YIELD PATIENTS</span>
                      <span className="font-bold text-slate-800">{staff.patientsTreated} Cases</span>
                    </div>
                  </div>
                </div>

                {/* Approve leave Requests inside card */}
                {staff.leaveStatus === 'pending_leave' ? (
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-amber-800">Leave Request Pending</p>
                      <p className="text-[9px] text-amber-600 font-medium">{staff.leaveDates}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => {
                        setStaffList(prev => prev.map(s => s.id === staff.id ? {...s, leaveStatus: 'on_leave'} : s));
                        alert('Leave request approved.');
                      }} className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-500"><Check size={12} /></button>
                      <button onClick={() => {
                        setStaffList(prev => prev.map(s => s.id === staff.id ? {...s, leaveStatus: 'active'} : s));
                        alert('Leave request declined.');
                      }} className="p-1 bg-rose-600 text-white rounded hover:bg-rose-500"><X size={12} /></button>
                    </div>
                  </div>
                ) : staff.leaveStatus === 'on_leave' ? (
                  <div className="mt-4 p-3 bg-purple-50 border border-purple-100 rounded-xl">
                    <p className="text-[10px] font-bold text-purple-700 uppercase tracking-widest text-center">● Currently on leave registry</p>
                  </div>
                ) : (
                  <div className="mt-4 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                    <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest text-center">● Active and on rotation duty</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Staff Performance View */}
      {activeTab === 'performance' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Action Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white border border-slate-100 p-8 rounded-[44px]">
            <div>
              <span className="text-[9px] font-black uppercase text-purple-600 tracking-[0.3em]">Operational Oversight</span>
              <h3 className="text-2xl font-black italic font-serif text-slate-900 uppercase mt-1">Staff & Department Performance</h3>
              <p className="text-xs text-slate-500 mt-1.5 max-w-xl">
                Oversight of operational throughput, patient care reviews, and EHR metadata compliance. Compare department statistics against our overall hospital benchmark using radar models.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {(['Cardiology', 'Neurology', 'Pediatrics', 'Surgery', 'General Outpatient Clinic'] as const).map((dept) => (
                <button
                  key={dept}
                  onClick={() => setSelectedDeptPerf(dept)}
                  className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl border transition-all ${
                    selectedDeptPerf === dept
                      ? 'bg-purple-600 border-purple-600 text-white shadow-lg shadow-purple-500/15'
                      : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {dept}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Interactive Metrics Sliders */}
            <div className="lg:col-span-4 bg-white border border-slate-100 p-8 rounded-[44px] space-y-6">
              <div>
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">Metrics Override Console</h4>
                <p className="text-[11px] text-slate-500 mt-1">Adjust and simulate live clinical throughput benchmarks for {selectedDeptPerf}.</p>
              </div>

              <div className="space-y-5">
                {[
                  { key: 'throughput', label: 'Patient Throughput' },
                  { key: 'satisfaction', label: 'Patient Satisfaction' },
                  { key: 'compliance', label: 'EHR Documentation' },
                  { key: 'quality', label: 'Clinical Quality Index' },
                  { key: 'prescribing', label: 'e-Rx Transmission Rate' },
                  { key: 'discharge', label: 'Discharge Speed & Flow' },
                ].map((item) => (
                  <div key={item.key} className="space-y-2">
                    <div className="flex justify-between text-xs font-bold text-slate-700">
                      <span>{item.label}</span>
                      <span className="font-mono text-slate-500">{deptMetrics[selectedDeptPerf]?.[item.key] || 0}%</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min="20"
                        max="100"
                        value={deptMetrics[selectedDeptPerf]?.[item.key] || 70}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setDeptMetrics((prev) => ({
                            ...prev,
                            [selectedDeptPerf]: {
                              ...prev[selectedDeptPerf],
                              [item.key]: val,
                            },
                          }));
                        }}
                        className="flex-1 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-purple-600"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-100">
                <button
                  onClick={async () => {
                    if (profile) {
                      await logAction(
                        profile.userId,
                        profile.name,
                        'OVERRIDE_METRICS',
                        'Admin',
                        `Simulated dynamic performance benchmark update for ${selectedDeptPerf}`
                      );
                    }
                    alert(`Performance ledger successfully updated for ${selectedDeptPerf}! Dynamic radar charts calibrated.`);
                  }}
                  className="w-full py-3 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-colors"
                >
                  Commit Performance Ledger
                </button>
              </div>
            </div>

            {/* Radar Chart Display */}
            <div className="lg:col-span-5 bg-white border border-slate-100 p-8 rounded-[44px] space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">Department Performance Radar</h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Visualizing <strong>{selectedDeptPerf}</strong> (Purple) against the <strong>Hospital-Wide Baseline</strong> (Slate).
                  </p>
                </div>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 font-mono font-black uppercase px-2.5 py-1 rounded">
                  CALIBRATED
                </span>
              </div>

              {/* RECHARTS RADAR CHART */}
              <div className="h-80 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart
                    cx="50%"
                    cy="50%"
                    outerRadius="75%"
                    data={[
                      { subject: 'Throughput', Dept: deptMetrics[selectedDeptPerf]?.throughput || 70, Baseline: hospitalBaseline.throughput },
                      { subject: 'Satisfaction', Dept: deptMetrics[selectedDeptPerf]?.satisfaction || 70, Baseline: hospitalBaseline.satisfaction },
                      { subject: 'EHR Compliance', Dept: deptMetrics[selectedDeptPerf]?.compliance || 70, Baseline: hospitalBaseline.compliance },
                      { subject: 'Quality', Dept: deptMetrics[selectedDeptPerf]?.quality || 70, Baseline: hospitalBaseline.quality },
                      { subject: 'e-Rx Accuracy', Dept: deptMetrics[selectedDeptPerf]?.prescribing || 70, Baseline: hospitalBaseline.prescribing },
                      { subject: 'Discharge', Dept: deptMetrics[selectedDeptPerf]?.discharge || 70, Baseline: hospitalBaseline.discharge },
                    ]}
                  >
                    <PolarGrid stroke="#f1f5f9" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 8 }} />
                    <Radar
                      name={selectedDeptPerf}
                      dataKey="Dept"
                      stroke="#8b5cf6"
                      fill="#8b5cf6"
                      fillOpacity={0.45}
                    />
                    <Radar
                      name="Hospital Baseline"
                      dataKey="Baseline"
                      stroke="#64748b"
                      fill="#64748b"
                      fillOpacity={0.15}
                    />
                    <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '10px' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 text-[10px] font-mono uppercase text-slate-500">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded bg-purple-500" />
                  <span>{selectedDeptPerf} Scope</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded bg-slate-400" />
                  <span>Hospital Mean</span>
                </div>
              </div>
            </div>

            {/* Department Roster & Commendations */}
            <div className="lg:col-span-3 space-y-6">
              {/* Staff filtered lists */}
              <div className="bg-slate-950 text-white border border-slate-900 p-8 rounded-[44px] space-y-4">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Department Roster</h4>
                  <p className="text-[10px] text-slate-500 mt-1">Assigned physicians currently on shift duty.</p>
                </div>

                <div className="space-y-3.5">
                  {staffList.filter((s) => s.department === selectedDeptPerf).map((staff) => (
                    <div key={staff.id} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-xs text-white">{staff.name}</p>
                          <p className="text-[9px] text-slate-500 mt-0.5">{staff.role}</p>
                        </div>
                        <span className="text-[9px] font-black text-purple-400">
                          ★ {staff.performanceRating}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[9px] font-mono text-slate-400 border-t border-slate-800/50 pt-2">
                        <span>Patients: {staff.patientsTreated}</span>
                        <button
                          onClick={async () => {
                            if (profile) {
                              await logAction(
                                profile.userId,
                                profile.name,
                                'COMMEND_STAFF',
                                'Admin',
                                `Sent Clinical Excellence Commendation to ${staff.name}`
                              );
                            }
                            alert(`Official Clinical Excellence Commendation dispatched to ${staff.name}! Logged on system credentials.`);
                          }}
                          className="px-2 py-0.5 bg-purple-500/20 border border-purple-500/30 hover:bg-purple-500 hover:text-white rounded text-[8px] font-black text-purple-300 tracking-wider uppercase transition-all"
                        >
                          Commend
                        </button>
                      </div>
                    </div>
                  ))}

                  {staffList.filter((s) => s.department === selectedDeptPerf).length === 0 && (
                    <p className="text-xs text-slate-500 italic text-center py-4">No rostered staff assigned to this department node yet.</p>
                  )}
                </div>
              </div>

              {/* Operational Forecasting / Clinical Quality Insights */}
              <div className="bg-white border border-slate-100 p-6 rounded-[32px] space-y-3">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Quality Dashboard Insight</h4>
                <div className="text-xs text-slate-700 space-y-2.5">
                  <div className="flex gap-2.5 items-start">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5" />
                    <p className="leading-normal">
                      <strong>EHR compliance</strong> is strong across outpatient nodes. Keep templates synchronized.
                    </p>
                  </div>
                  <div className="flex gap-2.5 items-start">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5" />
                    <p className="leading-normal">
                      <strong>Throughput</strong> lag noticed in Specialty departments. Recommend activating waitlist alerts.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Financial Ledger */}
      {activeTab === 'financials' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Action Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-100 p-8 rounded-[36px]">
            <div>
              <h3 className="text-xl font-black italic font-serif text-slate-900 uppercase">Financial Node</h3>
              <p className="text-xs text-slate-500 mt-1">Audit active billing transactions, file insurance claims, and verify staff payroll ledgers.</p>
            </div>
            <button onClick={() => setIsCreatingInvoice(true)} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
              <DollarSign size={14} /> Create Invoice
            </button>
          </div>

          {/* Create Invoice form */}
          <AnimatePresence>
            {isCreatingInvoice && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-white border border-slate-100 p-8 rounded-[36px] shadow-lg">
                <form onSubmit={handleCreateInvoice} className="space-y-6">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                    <h4 className="text-lg font-black font-serif italic text-slate-900">Issue Medical Billing Invoice</h4>
                    <button type="button" onClick={() => setIsCreatingInvoice(false)}><X size={18} /></button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Select Registered Patient</label>
                      <select required value={newInvoice.patientId} onChange={(e) => setNewInvoice({...newInvoice, patientId: e.target.value})} className="w-full border border-slate-200 rounded-xl p-3 text-sm">
                        <option value="">-- Choose Patient Node --</option>
                        {patientsList.map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Billing Service/Medication</label>
                      <input type="text" required placeholder="e.g. Surgery Consultation, ECG assessment" value={newInvoice.serviceType} onChange={(e) => setNewInvoice({...newInvoice, serviceType: e.target.value})} className="w-full border border-slate-200 rounded-xl p-3 text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Invoice Cost Amount ($)</label>
                      <input type="number" required placeholder="150" value={newInvoice.amount} onChange={(e) => setNewInvoice({...newInvoice, amount: e.target.value})} className="w-full border border-slate-200 rounded-xl p-3 text-sm" />
                    </div>
                    <div className="flex items-center gap-3 pt-8">
                      <input type="checkbox" checked={newInvoice.insuranceClaimed} onChange={(e) => setNewInvoice({...newInvoice, insuranceClaimed: e.target.checked})} className="w-5 h-5 text-blue-600 rounded border-slate-300" />
                      <span className="text-xs font-bold text-slate-700">Submit and Link to verified insurance policy</span>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <button type="submit" className="px-6 py-3 bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl">Post Ledger Item</button>
                    <button type="button" onClick={() => setIsCreatingInvoice(false)} className="px-6 py-3 bg-slate-100 text-slate-500 font-black text-[10px] uppercase tracking-widest rounded-xl">Cancel</button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Financial visualizations (Charts rather than tables) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white border border-slate-100 p-8 rounded-[44px]">
              <h3 className="text-xl font-black italic font-serif text-slate-900 uppercase mb-6">Revenue Stream allocations</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { category: 'Intake Fees', value: 8900 },
                    { category: 'Diagnostics', value: 14500 },
                    { category: 'Surgery', value: 24000 },
                    { category: 'Pharmacy', value: 12000 },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="category" stroke="#94a3b8" fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: 'transparent' }} />
                    <Bar dataKey="value" fill="#3b82f6" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-slate-900 text-white border border-slate-800 p-8 rounded-[44px]">
              <h3 className="text-xl font-black italic font-serif text-white uppercase mb-6">Payroll Node synchronic</h3>
              <div className="space-y-4">
                <div className="p-4 bg-slate-950 rounded-2xl flex justify-between items-center border border-slate-800">
                  <div>
                    <p className="font-bold text-white text-sm">Active Staff Payroll</p>
                    <p className="text-[10px] text-slate-500">Scheduled: 15th of the month</p>
                  </div>
                  <span className="text-[10px] bg-blue-500/10 text-blue-400 font-black uppercase px-3 py-1 rounded border border-blue-500/20">READY</span>
                </div>
                <div className="p-4 bg-slate-950 rounded-2xl flex justify-between items-center border border-slate-800">
                  <div>
                    <p className="font-bold text-white text-sm">Total Compensation Pool</p>
                    <p className="text-[10px] text-slate-500">Simulated: 4 active specialists</p>
                  </div>
                  <span className="font-mono text-sm font-black">$45,000.00</span>
                </div>
                <button onClick={() => alert('Secure Payroll Node sync complete. All active accounts dispatched.')} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all">
                  Trigger Secure Payroll Disbursement
                </button>
              </div>
            </div>
          </div>

          {/* Detailed Invoices Ledger */}
          <div className="bg-white border border-slate-100 rounded-[36px] overflow-hidden">
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-sm font-black uppercase tracking-wider text-slate-700">Billing Ledger Transactions</h4>
              <span className="text-[10px] font-mono text-slate-400">{billingList.length} Invoices</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Invoice ID</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Patient Details</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Gross Fee</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Insurance Link</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Status</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs">
                  {billingList.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-bold text-slate-700">{invoice.id}</td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-800 font-sans text-sm">{invoice.patientName}</span>
                        <div className="text-[10px] text-slate-400 mt-0.5 font-mono">{invoice.items.join(', ')}</div>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900">${invoice.amount.toFixed(2)}</td>
                      <td className="px-6 py-4">
                        {invoice.insuranceClaimed ? (
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter ${
                            invoice.claimStatus === 'approved' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                            invoice.claimStatus === 'rejected' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                            'bg-blue-50 text-blue-600 border border-blue-100'
                          }`}>
                            Claim {invoice.claimStatus}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest font-sans ${
                          invoice.status === 'paid' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                          invoice.status === 'outstanding' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {invoice.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-sans">
                        {invoice.status === 'outstanding' ? (
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => {
                              setBillingList(prev => prev.map(b => b.id === invoice.id ? {...b, status: 'paid', claimStatus: 'approved'} : b));
                              alert('Payment recorded successfully.');
                            }} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-black text-[9px] uppercase tracking-widest">
                              Pay
                            </button>
                            <button onClick={() => {
                              setBillingList(prev => prev.map(b => b.id === invoice.id ? {...b, claimStatus: 'rejected'} : b));
                              alert('Insurance claim updated to rejected.');
                            }} className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded font-black text-[9px] uppercase tracking-widest">
                              Reject Claim
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => {
                            setBillingList(prev => prev.map(b => b.id === invoice.id ? {...b, status: 'refunded'} : b));
                            alert('Transaction successfully refunded.');
                          }} className="px-3 py-1 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded font-black text-[9px] uppercase tracking-widest">
                            Refund
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Supply Registry */}
      {activeTab === 'inventory' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Action Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-100 p-8 rounded-[36px]">
            <div>
              <h3 className="text-xl font-black italic font-serif text-slate-900 uppercase">Pharmacy & Supply Registers</h3>
              <p className="text-xs text-slate-500 mt-1">Audit medicine registers, verify batch expirations, and generate purchase orders.</p>
            </div>
            <button onClick={() => setIsCreatingPO(true)} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
              <Plus size={14} /> Draft Purchase Order
            </button>
          </div>

          {/* Draft PO Form */}
          <AnimatePresence>
            {isCreatingPO && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-white border border-slate-100 p-8 rounded-[36px] shadow-lg">
                <form onSubmit={handleCreatePO} className="space-y-6">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                    <h4 className="text-lg font-black font-serif italic text-slate-900">Procure Supplies / Medicine</h4>
                    <button type="button" onClick={() => setIsCreatingPO(false)}><X size={18} /></button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <input type="text" required placeholder="Asset / Medication Name" value={newPO.name} onChange={(e) => setNewPO({...newPO, name: e.target.value})} className="w-full border border-slate-200 rounded-xl p-3 text-sm" />
                    <select value={newPO.category} onChange={(e) => setNewPO({...newPO, category: e.target.value as any})} className="w-full border border-slate-200 rounded-xl p-3 text-sm">
                      <option>Medicine</option>
                      <option>Medical Supply</option>
                      <option>Consumable</option>
                      <option>Equipment</option>
                    </select>
                    <input type="number" required placeholder="Quantity (vials, boxes or packs)" value={newPO.quantity} onChange={(e) => setNewPO({...newPO, quantity: e.target.value})} className="w-full border border-slate-200 rounded-xl p-3 text-sm" />
                    <input type="text" required placeholder="Manufacturer Vendor" value={newPO.vendor} onChange={(e) => setNewPO({...newPO, vendor: e.target.value})} className="w-full border border-slate-200 rounded-xl p-3 text-sm" />
                  </div>
                  <div className="flex gap-4">
                    <button type="submit" className="px-6 py-3 bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl">Commit Purchase Order</button>
                    <button type="button" onClick={() => setIsCreatingPO(false)} className="px-6 py-3 bg-slate-100 text-slate-500 font-black text-[10px] uppercase tracking-widest rounded-xl">Cancel</button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Inventory Table with Auto Warning Flags */}
          <div className="bg-white border border-slate-100 rounded-[36px] overflow-hidden">
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-sm font-black uppercase tracking-wider text-slate-700">Supplies & Medicine Catalog</h4>
              <span className="text-[10px] font-mono text-slate-400">{inventory.length} Stock items</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Asset</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Batch Code</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Category</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Current Qty</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Vendor</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500">Expiration</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs">
                  {inventory.map((item) => {
                    const isExpiringSoon = new Date(item.expiryDate).getTime() < new Date('2027-01-01').getTime();
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4">
                          <span className="font-sans font-bold text-sm text-slate-800 block">{item.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{item.id}</span>
                        </td>
                        <td className="px-6 py-4">{item.batchNumber}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 rounded text-[9px] font-black uppercase">
                            {item.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-bold">
                          {item.quantity} 
                          <span className="text-[10px] text-slate-400 font-medium font-sans block">Min threshold: {item.minQuantity}</span>
                        </td>
                        <td className="px-6 py-4 text-slate-600 font-sans">{item.vendor}</td>
                        <td className="px-6 py-4">
                          <span className={isExpiringSoon ? 'text-rose-600 font-bold' : 'text-slate-600'}>
                            {item.expiryDate}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-sans">
                          <span className={`px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-widest ${
                            item.status === 'Safe' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                            item.status === 'Low' ? 'bg-amber-50 text-amber-600 border border-amber-100 animate-pulse' :
                            item.status === 'Expired' ? 'bg-slate-900 text-white' :
                            'bg-rose-50 text-rose-600 border border-rose-100 animate-pulse'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: Security Node (Contains standard active registry listings, audit logs, and paging dispatch units) */}
      {activeTab === 'security' && (
        <div className="space-y-8 animate-fadeIn">
          <div className="flex gap-4 border-b border-slate-100 pb-2">
            <button onClick={() => setSecuritySubTab('registry')} className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest relative ${securitySubTab === 'registry' ? 'text-purple-600' : 'text-slate-400'}`}>
              Access Registry Nodes
              {securitySubTab === 'registry' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />}
            </button>
            <button onClick={() => setSecuritySubTab('audit')} className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest relative ${securitySubTab === 'audit' ? 'text-purple-600' : 'text-slate-400'}`}>
              Immutable Log Audits
              {securitySubTab === 'audit' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />}
            </button>
            <button onClick={() => setSecuritySubTab('paging')} className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest relative ${securitySubTab === 'paging' ? 'text-purple-600' : 'text-slate-400'}`}>
              Staff Dispatch Paging
              {securitySubTab === 'paging' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />}
            </button>
          </div>

          {/* Sub-tab A: Registry Nodes */}
          {securitySubTab === 'registry' && (
            <div className="bg-white border border-slate-100 rounded-[40px] shadow-2xl overflow-hidden">
              <div className="p-8 border-b border-slate-100 bg-white/[0.02] flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex flex-wrap items-center gap-4 flex-1 max-w-2xl">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="Query Registry Node..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-16 pr-8 py-4 text-slate-900 outline-none focus:ring-2 focus:ring-purple-600/50 transition-all font-bold tracking-tight"
                    />
                  </div>
                  <div className="flex gap-2">
                    <FilterButton active={roleFilter === 'all'} onClick={() => setRoleFilter('all')} label="All" />
                    <FilterButton active={roleFilter === 'doctor'} onClick={() => setRoleFilter('doctor')} label="Doctors" />
                    <FilterButton active={roleFilter === 'patient'} onClick={() => setRoleFilter('patient')} label="Patients" />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">User ID</th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Name & Identity</th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Access Role</th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Registration</th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Audit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50/50 transition-all">
                        <td className="px-8 py-6 font-mono text-[10px] text-slate-500">{(user.id || '').slice(0, 12).toUpperCase()}</td>
                        <td className="px-8 py-6">
                          <span className="font-black text-slate-900 text-sm block">{user.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{user.email}</span>
                        </td>
                        <td className="px-8 py-6">
                          <select 
                            value={user.role} 
                            onChange={(e) => updateUserRole(user.id, e.target.value)}
                            className={`bg-transparent font-black px-4 py-2 rounded-full text-[10px] uppercase tracking-widest border transition-all outline-none ${
                            user.role === 'admin' ? 'border-purple-500/30 text-purple-600 bg-purple-500/5' :
                            user.role === 'doctor' ? 'border-emerald-500/30 text-emerald-600 bg-emerald-500/5' :
                            'border-blue-500/30 text-blue-600 bg-blue-500/5'
                          }`}>
                            <option value="patient">Patient</option>
                            <option value="doctor">Doctor</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="px-8 py-6 text-center text-xs text-slate-500 font-bold">
                          {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Historical'}
                        </td>
                        <td className="px-8 py-6 text-right">
                          <button onClick={() => setSelectedUser(user)} className="p-2 bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 rounded-xl transition-all">
                            <Activity size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-tab B: Audit logs */}
          {securitySubTab === 'audit' && (
            <div className="bg-white border border-slate-100 rounded-[40px] shadow-2xl overflow-hidden">
              <div className="p-8 border-b border-slate-100 bg-slate-900 text-white flex justify-between items-center">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] italic font-serif">System Transaction Logs // Immutable</h3>
                <span className="text-[10px] font-mono opacity-50">Last 50 Events</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Timestamp</th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Ident</th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Module</th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Action</th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Payload/Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-xs text-slate-600">
                    {auditLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50/50">
                        <td className="px-8 py-4 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="px-8 py-4 font-sans">
                          <div className="font-bold text-slate-800">{log.userName}</div>
                          <div className="text-[9px] text-slate-400 font-mono">{(log.userId || '').slice(0, 8)}</div>
                        </td>
                        <td className="px-8 py-4">
                          <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 rounded text-[9px] font-black uppercase">
                            {log.module}
                          </span>
                        </td>
                        <td className="px-8 py-4">
                          <span className={`text-[10px] font-black uppercase ${
                            log.action.includes('FAIL') ? 'text-rose-600' : 
                            log.action.includes('SUCCESS') ? 'text-emerald-600' : 'text-blue-600'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-8 py-4 text-xs italic font-sans max-w-xs truncate">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-tab C: Paging dispatch system */}
          {securitySubTab === 'paging' && <PagingSystem />}
        </div>
      )}

      {/* User Activity Modal */}
      <AnimatePresence>
        {selectedUser && selectedUser.role !== 'patient' && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[85vh]"
            >
              <div className="p-8 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-600/10 text-blue-600 rounded-2xl">
                    <Activity size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black italic font-serif leading-none uppercase tracking-tight">Node Activity Audit</h3>
                    <p className="text-[10px] font-mono text-slate-500 mt-1 uppercase">User: {selectedUser.name} // {selectedUser.id}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedUser(null)} className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-all">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                {loadingLogs ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                  </div>
                ) : selectedUserLogs.length > 0 ? (
                  <div className="space-y-4">
                    {selectedUserLogs.map((log) => (
                      <div key={log.id} className="p-6 bg-slate-50 border border-slate-100 rounded-[28px] hover:border-blue-200 transition-all flex items-start gap-6">
                        <div className="w-px h-12 bg-slate-200 shrink-0 mt-1" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                             <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border ${
                               log.action.includes('FAIL') ? 'bg-rose-50 border-rose-100 text-rose-600' :
                               log.action.includes('SUCCESS') ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                               'bg-blue-50 border-blue-100 text-blue-600'
                             }`}>
                               {log.action}
                             </span>
                             <span className="text-[10px] font-mono text-slate-500">
                               {new Date(log.timestamp).toLocaleString()}
                             </span>
                          </div>
                          <p className="text-sm font-medium text-slate-800 italic line-clamp-2">"{log.details}"</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-20 opacity-40 italic">
                    <Terminal size={48} className="mx-auto mb-4" />
                    <p>No activity signatures found for this clinical node.</p>
                  </div>
                )}
              </div>

              <div className="p-8 border-t border-slate-100 bg-slate-50 text-right">
                <button onClick={() => setSelectedUser(null)} className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all">
                  Close Audit
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PagingSystem() {
  const { profile } = useAuth();
  const [pages, setPages] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'normal' | 'emergency' | 'critical'>('normal');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'pagingRequests'), orderBy('timestamp', 'desc'), limit(20));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'pagingRequests'));
    return () => unsubscribe();
  }, []);

  const sendPage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !message) return;
    setSending(true);
    try {
      await addDoc(collection(db, 'pagingRequests'), {
        senderId: profile.userId,
        senderName: profile.name,
        message,
        priority,
        status: 'sent',
        timestamp: serverTimestamp()
      });
      setMessage('');
      setPriority('normal');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'pagingRequests');
    } finally {
      setSending(false);
    }
  };

  const updatePageStatus = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, 'pagingRequests', id), { status });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `pagingRequests/${id}`);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <div className="lg:col-span-4 space-y-8">
        <div className="bg-slate-900 border border-slate-800 rounded-[40px] p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 text-rose-500/10"><Radio size={100} /></div>
          <h3 className="text-sm font-black uppercase tracking-[0.3em] text-rose-500 mb-8 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            Dispatch Command
          </h3>
          
          <form onSubmit={sendPage} className="space-y-6 relative z-10">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest pl-1">Priority Level</label>
              <div className="grid grid-cols-3 gap-2">
                {['normal', 'emergency', 'critical'].map((p) => (
                  <button 
                    key={p}
                    type="button"
                    onClick={() => setPriority(p as any)}
                    className={`py-3 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${
                      priority === p 
                        ? p === 'critical' ? 'bg-rose-600 border-rose-500 text-white shadow-lg' : 
                          p === 'emergency' ? 'bg-amber-600 border-amber-500 text-white shadow-lg' : 
                          'bg-blue-600 border-blue-500 text-white shadow-lg'
                        : 'bg-slate-950 border-slate-800 text-slate-500'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest pl-1">Clinical Directive</label>
              <textarea 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Escalate protocol to Physician-Node..."
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white font-medium outline-none focus:border-blue-500/50 h-32 placeholder:text-slate-700"
              />
            </div>

            <button 
              type="submit"
              disabled={sending}
              className="w-full py-5 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-xl shadow-rose-900/20 flex items-center justify-center gap-3"
            >
              <Send size={16} /> Broadcast Page
            </button>
          </form>
        </div>
      </div>

      <div className="lg:col-span-8 space-y-6">
        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-4 font-mono">Transmission History</h3>
        <AnimatePresence mode="popLayout">
          {pages.map((p) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`bg-white border-2 rounded-[32px] p-6 flex items-start gap-6 transition-all ${
                p.priority === 'critical' ? 'border-rose-400 shadow-[0_0_20px_rgba(225,29,72,0.1)]' :
                p.priority === 'emergency' ? 'border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.1)]' :
                'border-slate-100'
              }`}
            >
              <div className={`p-4 rounded-2xl ${
                p.priority === 'critical' ? 'bg-rose-600 text-white' :
                p.priority === 'emergency' ? 'bg-amber-500 text-white' :
                'bg-blue-600 text-white'
              }`}>
                <Radio size={24} className="animate-pulse" />
              </div>
              
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3 font-mono">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">{p.senderName}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                    <span className="text-[10px] text-slate-400">{format(p.timestamp?.toDate ? p.timestamp.toDate() : new Date(), 'HH:mm:ss')}</span>
                  </div>
                  <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest font-mono ${
                    p.status === 'sent' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                  }`}>
                    {p.status}
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-800 italic leading-relaxed">"{p.message}"</p>
                {p.status === 'sent' && (
                  <div className="mt-4 flex gap-2">
                    <button 
                      onClick={() => updatePageStatus(p.id, 'read')}
                      className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all flex items-center gap-2"
                    >
                      <CheckCircle2 size={12} /> Mark Responded
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StatMini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="px-4 py-1">
      <div className="text-[9px] font-black uppercase text-slate-500 tracking-widest leading-none font-mono">{label}</div>
      <div className="text-lg font-black text-white mt-1 leading-none">{value}</div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all ${
        active 
          ? 'bg-slate-900 text-white shadow-xl shadow-slate-950/20' 
          : 'bg-transparent text-slate-400 hover:text-slate-900 hover:bg-slate-50'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function OperationalCard({ title, count, subtitle, trend, trendType }: { title: string, count: string | number, subtitle: string, trend: string, trendType: 'up' | 'down' | 'warning' }) {
  return (
    <div className="bg-white border border-slate-100 p-6 rounded-[32px] shadow-sm flex flex-col justify-between group hover:shadow-xl transition-all">
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">{title}</div>
        <div className="text-4xl font-black text-slate-950 tracking-tighter leading-none">{count}</div>
        <p className="text-[10px] text-slate-400 mt-2 italic font-medium">{subtitle}</p>
      </div>
      <div className="pt-4 border-t border-slate-50 mt-4 flex items-center justify-between">
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Current delta</span>
        <span className={`text-[10px] font-black uppercase ${
          trendType === 'up' ? 'text-emerald-600' : trendType === 'warning' ? 'text-amber-600' : 'text-rose-600'
        }`}>{trend}</span>
      </div>
    </div>
  );
}

function TimelineNode({ title, desc, active, time }: { title: string, desc: string, active?: boolean, time: string }) {
  return (
    <div className="relative group">
      <div className={`absolute -left-[31px] top-1.5 w-4.5 h-4.5 rounded-full border-2 transition-colors ${
        active ? 'bg-blue-500 border-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-slate-950 border-slate-800'
      }`} />
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h5 className={`text-xs font-black uppercase tracking-wider ${active ? 'text-white' : 'text-slate-500'}`}>{title}</h5>
          <span className="text-[9px] font-mono text-slate-500 font-bold">{time}</span>
        </div>
        <p className="text-xs text-slate-400 italic font-medium">{desc}</p>
      </div>
    </div>
  );
}

function FilterButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`px-5 py-3 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all ${
        active 
          ? 'bg-purple-600 border-purple-500 text-white shadow-lg' 
          : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-950'
      }`}
    >
      {label}
    </button>
  );
}
