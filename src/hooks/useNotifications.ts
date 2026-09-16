import { useEffect, useState } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from './useAuth';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: any;
  link?: string;
}

export function useNotifications() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', profile.userId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];
      
      setNotifications(docs);
      setUnreadCount(docs.filter(n => !n.read).length);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    });

    return () => unsubscribe();
  }, [profile]);

  const markAsRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        read: true
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!profile) return;
    try {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', profile.userId),
        where('read', '==', false)
      );
      const snapshot = await getDocs(q);
      const batch = snapshot.docs.map(d => updateDoc(d.ref, { read: true }));
      await Promise.all(batch);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead
  };
}

export async function createNotification(userId: string, data: Omit<Notification, 'id' | 'userId' | 'read' | 'createdAt'>) {
  try {
    await addDoc(collection(db, 'notifications'), {
      userId,
      ...data,
      read: false,
      createdAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}
