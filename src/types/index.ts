export type UserRole = 'patient' | 'doctor' | 'admin';

export type Permission = 
  | 'view_all_records' 
  | 'create_records' 
  | 'delete_records'
  | 'view_all_appointments'
  | 'update_appointment_status'
  | 'manage_users'
  | 'view_all_financials'
  | 'manage_financials'
  | 'review_intake';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'view_all_records', 'create_records', 'delete_records',
    'view_all_appointments', 'update_appointment_status',
    'manage_users',
    'view_all_financials', 'manage_financials',
    'review_intake'
  ],
  doctor: [
    'view_all_records', 'create_records',
    'view_all_appointments', 'update_appointment_status',
    'review_intake'
  ],
  patient: []
};

export interface UserProfile {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface PatientProfile {
  age?: number;
  gender?: string;
  medicalHistory?: string;
  allergies?: string[];
  medications?: string[];
  bloodType?: string;
  emergencyContact?: string;
}

export interface DoctorProfile {
  specialty: string;
  department: string;
  experience?: number;
  bio?: string;
  availability?: string[]; // e.g. ["Mon 08:00-12:00", ...]
  licenseNumber?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  module: 'Medical Records' | 'Appointments' | 'Financials' | 'Admin' | 'Auth';
  details: string;
  timestamp: string;
  ipAddress?: string;
}

export type AppointmentStatus = 'scheduled' | 'waiting' | 'in-consultation' | 'completed' | 'cancelled';
export type TriageUrgency = 'low' | 'moderate' | 'high' | 'critical';

export interface Appointment {
  id: string;
  patientId: string;
  doctorId?: string;
  departmentId: string;
  dateTime: string;
  status: AppointmentStatus;
  queuePosition?: number;
  symptoms?: string;
  triageLevel?: TriageUrgency;
  patientName?: string;
  doctorName?: string;
}

export interface TriageRecord {
  id: string;
  patientId: string;
  symptoms: string;
  riskScore: number;
  suggestedDepartment: string;
  urgency: TriageUrgency;
  followUpQuestion?: string;
  timestamp: string;
}

export interface MedicalRecord {
  id: string;
  patientId: string;
  doctorId: string;
  type: 'lab' | 'imaging' | 'prescription' | 'note';
  title: string;
  content: string;
  fileUrl?: string;
  date: string;
}

export interface Invoice {
  id: string;
  userId: string;
  amount: number;
  label: string;
  status: 'pending' | 'paid' | 'overdue';
  dueDate: string;
}

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  title: string;
  desc: string;
  date: string;
  status: 'COMPLETED' | 'SYNCED' | 'PROCESSING';
  type: 'debit' | 'credit';
}
