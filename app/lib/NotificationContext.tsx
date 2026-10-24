"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AppNotification } from "./types";
import { mockNotifications } from "./mockData";
import { apiGet, apiSend } from "./api";
import { toNotification, type ApiNotification } from "./apiMappers";

type NotificationType = AppNotification["type"];

type NotificationContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  toast: AppNotification | null;
  addNotification: (message: string, type: NotificationType) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  dismissToast: () => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

const TOAST_DURATION_MS = 4000;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] =
    useState<AppNotification[]>(mockNotifications);
  const [toast, setToast] = useState<AppNotification | null>(null);

  // Load the signed-in user's notifications from the API. If that fails (for example,
  // not logged in yet), keep the sample data so the screen still works.
  useEffect(() => {
    let cancelled = false;
    apiGet<ApiNotification[]>("/api/me/notifications").then((data) => {
      if (!cancelled && data) setNotifications(data.map(toNotification));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Hide the toast automatically a few seconds after it appears.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const addNotification = useCallback(
    (message: string, type: NotificationType) => {
      const created: AppNotification = {
        id: crypto.randomUUID(),
        message,
        type,
        read: false,
        timestamp: new Date().toISOString(),
      };
      // Newest first, so lists can render in the stored order.
      setNotifications((prev) => [created, ...prev]);
      setToast(created);
    },
    []
  );

  const markAsRead = useCallback((id: string) => {
    void apiSend(`/api/me/notifications/${id}`, "PATCH", { isRead: true });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    void apiSend("/api/me/notifications/read-all", "POST");
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      toast,
      addNotification,
      markAsRead,
      markAllAsRead,
      dismissToast,
    }),
    [notifications, unreadCount, toast, addNotification, markAsRead, markAllAsRead, dismissToast]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used inside a NotificationProvider");
  }
  return context;
}
