import { db } from './firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { AuditLog } from '../types';

export async function logAction(
  userId: string, 
  userName: string, 
  action: string, 
  module: AuditLog['module'], 
  details: string
) {
  try {
    await addDoc(collection(db, 'auditLogs'), {
      userId,
      userName,
      action,
      module,
      details,
      timestamp: Timestamp.now().toDate().toISOString(),
      platform: 'WEB_OS_CLINICAL'
    });
  } catch (error) {
    console.error('Audit Log Error:', error);
  }
}
