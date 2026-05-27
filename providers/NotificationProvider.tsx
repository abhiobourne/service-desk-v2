"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthProvider";
import { getApiToken, fetchUnreadNotifications } from "../lib/api";

const SOCKET_URL = process.env.NEXT_PUBLIC_API_SERVER || "http://localhost:7000";

export interface TicketNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  ticketId?: string;
  createdAt: string;
  isRead: boolean;
}

interface NotifCtx {
  notifications: TicketNotification[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

const NotifContext = createContext<NotifCtx | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<TicketNotification[]>([]);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user?.id) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    const token = getApiToken();
    if (!token) return;

    fetchUnreadNotifications().then((unread) => {
      setNotifications((prev) => {
        const newNotifs = unread.filter(u => !prev.some(p => p.id === u.id)).map(u => ({
          id: u.id,
          type: u.event_key || u.type || "ticket",
          title: "New ticket message",
          message: u.message || "",
          ticketId: u.ticket_id,
          createdAt: u.createdAt,
          isRead: false
        }));
        return [...newNotifs, ...prev].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      });
    });

    const sock = io(`${SOCKET_URL}/ticket-communication`, {
      path: "/socket.io/",
      auth: { token },
      transports: ["websocket", "polling"],
      autoConnect: false,
    });
    socketRef.current = sock;
    sock.connect();

    sock.on("ticket:notification", (notif: any) => {
      setNotifications((prev) => {
        if (prev.some((n) => n.id === notif.id)) return prev;
        return [
          {
            id: notif.id,
            type: notif.type || "chat",
            title: notif.title || "New message",
            message: notif.message || "",
            ticketId: notif.data?.ticketId,
            createdAt: notif.createdAt || new Date().toISOString(),
            isRead: false,
          },
          ...prev,
        ];
      });
    });

    return () => {
      sock.disconnect();
      socketRef.current = null;
    };
  }, [user?.id]);

  const markRead = (id: string) =>
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));

  const markAllRead = () =>
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <NotifContext.Provider value={{ notifications, unreadCount, markRead, markAllRead }}>
      {children}
    </NotifContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotifContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
