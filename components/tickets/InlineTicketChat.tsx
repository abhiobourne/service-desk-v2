"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { X, SendHorizontal, ExternalLink, AlertCircle } from "lucide-react";
import { io, Socket } from "socket.io-client";
import toast from "react-hot-toast";
import { fetchTicketCommunications, getApiToken } from "../../lib/api";
import { useAuth } from "../../providers/AuthProvider";
import type { OrderTicket } from "../../lib/api";

const SOCKET_URL = process.env.NEXT_PUBLIC_API_SERVER || "http://localhost:7000";

interface InlineTicketChatProps {
  ticket: OrderTicket;
  onClose: () => void;
  onOpenDetail?: () => void;
}

interface ChatMsg {
  id?: string;
  sender: "user" | "agent";
  text: string;
  createdAt: string;
  isSystem?: boolean;
  isBackendSystem?: boolean;
  isUnread?: boolean;
}

interface TicketCommunicationMessage {
  id?: string;
  sender_id?: string;
  recipient_id?: string;
  message?: string;
  createdAt: string;
  is_read?: boolean;
  is_system?: boolean;
  type?: string;
  metadata?: { status?: unknown } | null;
}

interface SocketError {
  message?: string;
}

interface SendMessageAck {
  success?: boolean;
  message?: string;
}

export function InlineTicketChat({ ticket, onClose, onOpenDetail }: InlineTicketChatProps) {
  const { user } = useAuth();
  const [rawMessages, setRawMessages] = useState<TicketCommunicationMessage[]>([]);
  const [liveMessages, setLiveMessages] = useState<TicketCommunicationMessage[]>([]);
  // messageId → isRead (false = unread for current user)
  const [readMap, setReadMap] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState("");
  const [searchVal, setSearchVal] = useState("");
  const [connected, setConnected] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<string>(ticket.status ?? "");
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const ticketId = ticket.id;

  // Load past messages from REST
  useEffect(() => {
    fetchTicketCommunications(ticketId).then((msgs) => {
      const typedMessages = msgs as TicketCommunicationMessage[];
      setLiveMessages([]);
      setReadMap({});
      setRawMessages(typedMessages);
      // Build initial read map from REST data
      const map: Record<string, boolean> = {};
      for (const m of typedMessages) {
        if (m.id) map[m.id] = !!m.is_read;
      }
      setReadMap(map);
    });
  }, [ticketId]);

  // Socket.io
  useEffect(() => {
    const token = getApiToken();
    if (!token) return;
    const sock = io(`${SOCKET_URL}/ticket-communication`, {
      path: "/socket.io/",
      auth: { token },
      transports: ["websocket", "polling"],
      autoConnect: false,
    });
    socketRef.current = sock;
    sock.connect();

    sock.on("connect", () => {
      setConnected(true);
      setConnectError(null);
      sock.emit("ticket:subscribe", { ticketId });
      // Mark all existing unread messages as read on open
      sock.emit("ticket:mark-as-read", { ticketId });
    });

    sock.on("disconnect", () => setConnected(false));

    sock.on("connect_error", (err) => {
      console.error("[TicketChat] connect_error:", err.message);
      setConnectError(err.message);
    });

    // NestJS emits 'exception' when a @SubscribeMessage handler throws WsException
    sock.on("exception", (error: SocketError) => {
      const msg = error?.message || "Something went wrong";
      toast.error(msg);
    });

    sock.on("ticket:message-created", (msg: TicketCommunicationMessage) => {
      setLiveMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      // Update read map for the new message
      const messageId = msg.id;
      if (messageId) {
        setReadMap((prev) => ({ ...prev, [messageId]: !!msg.is_read }));
      }
      // If this message is for us and not auto-read, mark it read now (we're viewing)
      if (messageId && msg.recipient_id === user?.id && !msg.is_read) {
        sock.emit("ticket:mark-as-read", { ticketId, messageIds: [messageId] });
      }
    });

    sock.on("ticket:messages-marked-as-read", (data: { messageIds?: string[] }) => {
      const ids: string[] = data.messageIds ?? [];
      if (ids.length === 0) return;
      setReadMap((prev) => {
        const next = { ...prev };
        for (const id of ids) next[id] = true;
        return next;
      });
    });

    sock.on("ticket:status-updated", (data: { status?: string }) => {
      if (data?.status) setLiveStatus(data.status);
    });

    return () => {
      sock.emit("ticket:unsubscribe", { ticketId });
      sock.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [ticketId, user?.id]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [rawMessages, liveMessages]);

  const allMessages = useMemo<ChatMsg[]>(() => {
    const merged = [...rawMessages, ...liveMessages].filter(
      (m, i, arr) => i === arr.findIndex((x) => x.id === m.id),
    );
    const mapped: ChatMsg[] = merged.map((m) => {
      const fromMe = m.sender_id === user?.id;
      const isBackendSystem = !!m.metadata?.status || m.type === "auto" || m.is_system === true;
      // A message is unread for the current user if they are the recipient AND not yet read
      const isUnread =
        m.recipient_id === user?.id &&
        !(m.id ? readMap[m.id] : m.is_read ?? true);
      return {
        id: m.id,
        sender: fromMe ? "user" : "agent",
        text: m.message ?? "",
        createdAt: m.createdAt,
        isSystem: isBackendSystem,
        isBackendSystem,
        isUnread,
      };
    });

    const welcome: ChatMsg = {
      sender: "agent",
      text: `Ticket ${ticket.ticket_id} has been created successfully.\n\nOrder ID: ${ticket.order_id ?? "—"}\nProduct: ${ticket.items?.[0]?.product_name ?? "—"}\nReason:\n${(ticket.reason ?? "No reason provided.").replace(/<[^>]*>/g, "")}\nDescription:\n${(ticket.description ?? "No description provided.").replace(/<[^>]*>/g, "")}\nRaised By: ${ticket.user_name ?? "Unknown"}\nAssigned To: ${ticket.assignee_details ? `${ticket.assignee_details.firstName ?? ""} ${ticket.assignee_details.lastName ?? ""}`.trim() || "Agent" : "Unassigned"}\nStatus: ${ticket.status}`,
      createdAt: ticket.createdAt,
      isSystem: true,
      isBackendSystem: false,
    };
    return [welcome, ...mapped].sort((a, b) => {
      if (!a.id && !b.id) return 0;
      if (!a.id) return -1;
      if (!b.id) return 1;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [rawMessages, liveMessages, user?.id, ticket, readMap]);

  const unreadCount = useMemo(
    () => allMessages.filter((m) => m.isUnread).length,
    [allMessages],
  );

  const displayed = useMemo(() => {
    if (!searchVal.trim()) return allMessages;
    const q = searchVal.toLowerCase();
    return allMessages.filter((m) => m.text.toLowerCase().includes(q));
  }, [allMessages, searchVal]);

  const isClosedOrResolved = ["resolved", "closed"].includes((liveStatus || ticket.status || "").toLowerCase());

  const sendMessage = () => {
    if (!message.trim() || isClosedOrResolved || !socketRef.current?.connected) return;
    const msgToSend = message.trim();
    setMessage("");
    socketRef.current.emit(
      "ticket:send-message",
      { ticketId, message: msgToSend, metadata: null },
      (ack: SendMessageAck | undefined) => {
        // NestJS returns { success: true } on success; if ack has no success, restore
        if (ack && !ack.success) {
          setMessage(msgToSend);
          toast.error(ack.message || "Failed to send message");
        }
      },
    );
  };

  const assigneeName = ticket.assignee_details
    ? `${ticket.assignee_details.firstName ?? ""} ${ticket.assignee_details.lastName ?? ""}`.trim() || "Agent"
    : null;

  const fmtDay = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString("en-US", { weekday: "long" })}, ${d.toLocaleDateString("en-GB")}`;
  };
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-GB");

  return (
    <div className="flex h-full flex-col bg-white dark:bg-[#090b10]">
      {/* Header */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-5 dark:border-white/5 dark:bg-[#0c0e16]">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 shadow-sm">
          <span className="text-xs font-bold text-white">
            {assigneeName ? assigneeName[0].toUpperCase() : "A"}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className={`truncate text-sm font-semibold ${assigneeName ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-white/40"}`}>
              {assigneeName ?? "Awaiting Assignment"}
            </div>
            {/* Connection dot */}
            <span
              title={connectError ? `Error: ${connectError}` : connected ? "Connected" : "Connecting…"}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                connectError
                  ? "bg-rose-50 text-rose-600 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/20"
                  : connected
                    ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20"
                    : "bg-amber-50 text-amber-600 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${
                connectError ? "bg-rose-500" : connected ? "bg-emerald-500" : "animate-pulse bg-amber-500"
              }`} />
              {connectError ? "Offline" : connected ? "Active" : "Connecting"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <code className="text-[10px] font-mono text-blue-600 dark:text-blue-400">#{ticket.ticket_id}</code>
            {unreadCount > 0 && (
              <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[8px] font-bold text-blue-600 ring-1 ring-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:ring-blue-500/30">
                {unreadCount} unread
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onOpenDetail && (
            <button
              onClick={onOpenDetail}
              title="Open full details"
              className="rounded-md p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-white/30 dark:hover:bg-white/5 dark:hover:text-white/70"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={onClose} className="rounded-md p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-white/30 dark:hover:bg-white/5 dark:hover:text-white/70">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="border-b border-slate-200 bg-white px-5 py-3 dark:border-white/5 dark:bg-[#0c0e16]">
        <div className="relative">
          <input
            type="text"
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            placeholder="Search messages…"
            autoFocus
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-3 pr-9 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/20 dark:focus:border-blue-500/40 dark:focus:ring-blue-500/10"
          />
          {searchVal && (
            <button
              type="button"
              onClick={() => setSearchVal("")}
              aria-label="Clear message search"
              title="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:text-white/30 dark:hover:bg-white/10 dark:hover:text-white/70"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-1 overflow-y-auto bg-slate-50 px-5 py-5 dark:bg-[#08090e]">
        {displayed.length === 0 && (
          <div className="mt-12 text-center text-xs text-slate-400 dark:text-white/20">No messages yet</div>
        )}
        {displayed.map((msg, idx) => {
          const showDay = idx === 0 || dayKey(displayed[idx - 1].createdAt) !== dayKey(msg.createdAt);
          return (
            <React.Fragment key={`${msg.id ?? "welcome"}-${idx}`}>
              {showDay && (
                <div className="my-4 flex items-center gap-3">
                  <span className="h-px flex-1 bg-slate-200 dark:bg-white/5" />
                  <span className="text-[10px] font-medium text-slate-400 dark:text-white/25">{fmtDay(msg.createdAt)}</span>
                  <span className="h-px flex-1 bg-slate-200 dark:bg-white/5" />
                </div>
              )}
              <div className={`flex mb-2 ${msg.sender === "user" && !msg.isSystem ? "justify-end" : "justify-start"}`}>
                <div className={`relative px-4 py-3 text-xs leading-relaxed ${msg.isBackendSystem
                  ? "max-w-[88%] rounded-xl border border-blue-200 bg-blue-50 text-slate-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-100/80"
                  : msg.isSystem
                    ? "max-w-[88%] rounded-xl border border-blue-100 bg-white text-slate-600 shadow-sm dark:border-white/8 dark:bg-white/5 dark:text-white/55"
                    : msg.sender === "user"
                      ? "max-w-[76%] rounded-2xl rounded-br-md bg-blue-600 text-white shadow-sm"
                      : msg.isUnread
                        ? "max-w-[76%] rounded-2xl rounded-bl-md border border-blue-200 bg-white text-slate-800 shadow-sm ring-2 ring-blue-100 dark:border-blue-500/30 dark:bg-[#0f1420] dark:text-white/80 dark:ring-blue-500/10"
                        : "max-w-[76%] rounded-2xl rounded-bl-md border border-slate-200 bg-white text-slate-700 shadow-sm dark:border-white/8 dark:bg-white/8 dark:text-white/70"
                  }`}>
                  {msg.isBackendSystem && (
                    <div className="mb-1.5 text-[9px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">System update</div>
                  )}
                  {/* Unread indicator dot */}
                  {msg.isUnread && (
                    <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-slate-50 bg-blue-500 dark:border-[#08090e]" />
                  )}
                  <p className={`whitespace-pre-line ${msg.sender === "user" && !msg.isSystem ? "text-white" : ""}`}>{msg.text}</p>
                  <div className={`mt-1.5 text-right text-[9px] opacity-55 ${msg.sender === "user" && !msg.isSystem ? "text-white" : ""}`}>{fmtTime(msg.createdAt)}</div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {isClosedOrResolved ? (
        <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-4 dark:border-white/5 dark:bg-[#090b10]">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center dark:border-white/8 dark:bg-white/3">
            <p className="text-xs text-slate-500 dark:text-white/40">
              {(liveStatus || ticket.status || "").toLowerCase().includes("resolv") ? "✓ Ticket resolved — chat disabled." : "Ticket closed — messaging disabled."}
            </p>
          </div>
        </div>
      ) : !ticket.assignee_details || (!ticket.assignee_details.firstName && !ticket.assignee_details.lastName) ? (
        <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-4 dark:border-white/5 dark:bg-[#090b10]">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-center dark:border-blue-500/20 dark:bg-blue-500/10">
            <p className="text-xs text-blue-700 dark:text-blue-300/80">
              Technician not assigned yet. Please wait for the technician to be assigned.
            </p>
          </div>
        </div>
      ) : connectError ? (
        <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-4 dark:border-white/5 dark:bg-[#090b10]">
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-500/20 dark:bg-rose-500/10">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <p className="text-xs font-mono text-rose-400/80 truncate">Connection failed — check your session</p>
          </div>
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-2 border-t border-slate-200 bg-white px-4 py-3 dark:border-white/5 dark:bg-[#090b10]">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={connected ? "Start Typing" : "Connecting…"}
            disabled={!connected}
            className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-40 dark:border-white/8 dark:bg-white/5 dark:text-white dark:placeholder:text-white/20 dark:focus:border-blue-500/40 dark:focus:ring-blue-500/10"
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={!message.trim() || !connected}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition ${message.trim() && connected ? "bg-blue-600 text-white shadow-sm hover:bg-blue-700" : "cursor-not-allowed bg-slate-100 text-slate-300 dark:bg-white/5 dark:text-white/20"}`}
          >
            <SendHorizontal className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
