import React, { useState, useRef, useEffect } from 'react';
import { Bell, Check, Info, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { useNotifications, Notification } from '../hooks/useNotifications';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="text-emerald-500" size={16} />;
      case 'warning': return <AlertTriangle className="text-amber-500" size={16} />;
      case 'error': return <X className="text-rose-500" size={16} />;
      default: return <Info className="text-blue-500" size={16} />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-3 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm group"
      >
        <Bell size={20} className="group-hover:scale-110 transition-transform" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-600 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-4 w-80 md:w-96 bg-white rounded-[32px] border border-slate-200 shadow-2xl overflow-hidden z-[100]"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 italic font-serif">Notifications</h3>
              {unreadCount > 0 && (
                <button 
                  onClick={markAllAsRead}
                  className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:text-blue-700 flex items-center gap-1"
                >
                  <Check size={12} />
                  Mark all as read
                </button>
              )}
            </div>

            <div className="max-h-[400px] overflow-y-auto scrollbar-hide bg-white">
              {notifications.length > 0 ? (
                <div className="divide-y divide-slate-50">
                  {notifications.map((n) => (
                    <div 
                      key={n.id} 
                      className={`p-5 hover:bg-slate-50/80 transition-colors relative group ${!n.read ? 'bg-blue-50/30' : ''}`}
                      onClick={() => !n.read && markAsRead(n.id)}
                    >
                      <div className="flex gap-4">
                        <div className={`mt-1 w-8 h-8 rounded-xl flex items-center justify-center shadow-sm border ${
                          n.type === 'success' ? 'bg-emerald-50 border-emerald-100' :
                          n.type === 'warning' ? 'bg-amber-50 border-amber-100' :
                          n.type === 'error' ? 'bg-rose-50 border-rose-100' :
                          'bg-blue-50 border-blue-100'
                        }`}>
                          {getIcon(n.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1">
                            <h4 className="text-sm font-bold text-slate-900 truncate">{n.title}</h4>
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap ml-2">
                              {n.createdAt && formatDistanceToNow(n.createdAt.toDate(), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed italic">{n.message}</p>
                        </div>
                      </div>
                      {!n.read && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-600 rounded-r-full" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mx-auto mb-4">
                    <Bell size={24} />
                  </div>
                  <p className="text-xs text-slate-400 font-medium italic">No new notifications</p>
                </div>
              )}
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
               <button className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-colors">Clear History</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
