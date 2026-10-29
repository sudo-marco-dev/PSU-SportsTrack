import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { InAppNotification } from '@/lib/notifications';
import { Bell, CheckCheck, UserPlus, CheckCircle2, AlertCircle, ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface NotificationBellProps {
  className?: string;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ className }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        setNotifications(data as InAppNotification[]);
      }
    } catch (err) {
      console.warn('[NotificationBell] Failed to fetch notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();

    let channel: any = null;
    try {
      const channelName = `user_notifications_${user.id}_${Math.random().toString(36).substring(2, 9)}`;
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchNotifications();
          }
        )
        .subscribe();
    } catch (e) {
      console.warn('[NotificationBell] Realtime subscription notice:', e);
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {
          // ignore cleanup error
        }
      }
    };
  }, [user, fetchNotifications]);

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!user) return null;

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    } catch (err) {
      console.warn('[NotificationBell] Failed to mark as read:', err);
    }
  };

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
    } catch (err) {
      console.warn('[NotificationBell] Failed to mark all as read:', err);
    }
  };

  const handleNotificationClick = (n: InAppNotification) => {
    if (!n.is_read) {
      markAsRead(n.id);
    }
    if (n.link) {
      setIsOpen(false);
      navigate(n.link);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'coach_invite':
        return <UserPlus className="size-4 text-orange-500 shrink-0" />;
      case 'verification_approved':
        return <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />;
      case 'verification_rejected':
        return <AlertCircle className="size-4 text-rose-500 shrink-0" />;
      default:
        return <Bell className="size-4 text-blue-500 shrink-0" />;
    }
  };

  const formatRelativeTime = (timestamp: string) => {
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHrs = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHrs / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        aria-label="View notifications"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`relative p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer ${className || ''}`}
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-orange-600 text-[9px] font-black text-white shadow-sm ring-2 ring-white dark:ring-slate-950 animate-in zoom-in-50">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 lg:right-auto lg:left-0 top-full mt-2 w-80 sm:w-96 max-w-[calc(100vw-1.5rem)] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Notifications
              </span>
              {unreadCount > 0 && (
                <Badge className="bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0 h-4 rounded-full">
                  {unreadCount} new
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="h-7 px-2 text-[10px] font-bold text-slate-500 hover:text-orange-500 gap-1 rounded-lg"
                >
                  <CheckCheck className="size-3" />
                  <span>Mark all read</span>
                </Button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5 scrollbar-thin">
            {isLoading && notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 font-medium">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center space-y-1">
                <Bell className="size-8 text-slate-300 dark:text-slate-700 mx-auto" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No notifications yet</p>
                <p className="text-[10px] text-slate-400">
                  You'll receive alerts when invited to teams or when your credentials update.
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer text-left hover:bg-slate-50 dark:hover:bg-white/5 ${
                    !n.is_read ? 'bg-orange-500/5 dark:bg-orange-500/10' : ''
                  }`}
                >
                  <div className="mt-0.5">{getNotificationIcon(n.type)}</div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-xs font-bold line-clamp-1 ${!n.is_read ? 'text-slate-900 dark:text-white font-black' : 'text-slate-700 dark:text-slate-300'}`}>
                        {n.title}
                      </p>
                      <span className="text-[9px] text-slate-400 whitespace-nowrap shrink-0">
                        {formatRelativeTime(n.created_at)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug line-clamp-2">
                      {n.message}
                    </p>
                    {n.link && (
                      <div className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-500">
                        <span>View details</span>
                        <ExternalLink className="size-2.5" />
                      </div>
                    )}
                  </div>
                  {!n.is_read && (
                    <span className="size-2 rounded-full bg-orange-500 shrink-0 mt-1.5" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
