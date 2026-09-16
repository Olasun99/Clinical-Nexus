import { z } from 'zod';

export const medicalRecordSchema = z.object({
  patientId: z.string().min(5, "Valid patient identifier required"),
  type: z.enum(['lab', 'imaging', 'prescription', 'note']),
  title: z.string().min(3, "Title must be at least 3 characters").max(100),
  content: z.string().min(10, "Clinical content is too short for a standard record").max(5000),
});

export const intakeFormSchema = z.object({
  fullName: z.string().min(2, "Full node name required").max(100),
  email: z.string().email("Invalid comms vector (email)"),
  phone: z.string().min(10, "Invalid comms link (phone)"),
  dob: z.string().min(1, "Origin date required"),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']),
  bloodType: z.string(),
  primaryConcern: z.string().min(10, "Please provide more detail for clinical synthesis").max(2000),
  duration: z.string().min(1, "State duration required"),
  painLevel: z.string().or(z.number()),
  allergies: z.string().optional(),
  medications: z.string().optional(),
  familyHistory: z.string().optional(),
  emergencyContact: z.string().optional(),
});

export const appointmentSchema = z.object({
  departmentId: z.string().min(1, "Select a department"),
  dateTime: z.string().min(1, "Appointment slot required"),
  symptoms: z.string().min(5, "Brief description of symptoms (min 5 chars)").max(500),
});

export type MedicalRecordFormValues = z.infer<typeof medicalRecordSchema>;
export type IntakeFormValues = z.infer<typeof intakeFormSchema>;
export type AppointmentFormValues = z.infer<typeof appointmentSchema>;
