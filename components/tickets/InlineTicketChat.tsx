"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { X, SendHorizontal, Search, ExternalLink, AlertCircle } from "lucide-react";
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

export function InlineTicketChat({ ticket, onClose, onOpenDetail }: InlineTicketChatProps) {
  const { user } = useAuth();
  const [rawMessages, setRawMessages] = useState<any[]>([]);
  const [liveMessages, setLiveMessages] = useState<any[]>([]);
  // messageId → isRead (false = unread for current user)
  const [readMap, setReadMap] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [searchVal, setSearchVal] = useState("");
  const [connected, setConnected] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<string>(ticket.status ?? "");
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const ticketId = ticket.id;

  // Load past messages from REST
  useEffect(() => {
    setLiveMessages([]);
    setReadMap({});
    fetchTicketCommunications(ticketId).then((msgs) => {
      setRawMessages(msgs);
      // Build initial read map from REST data
      const map: Record<string, boolean> = {};
      for (const m of msgs) {
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
    sock.on("exception", (error: any) => {
      const msg = error?.message || "Something went wrong";
      toast.error(msg);
    });

    sock.on("ticket:message-created", (msg: any) => {
      setLiveMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      // Update read map for the new message
      if (msg.id) {
        setReadMap((prev) => ({ ...prev, [msg.id]: !!msg.is_read }));
      }
      // If this message is for us and not auto-read, mark it read now (we're viewing)
      if (msg.recipient_id === user?.id && !msg.is_read) {
        sock.emit("ticket:mark-as-read", { ticketId, messageIds: [msg.id] });
      }
    });

    sock.on("ticket:messages-marked-as-read", (data: any) => {
      const ids: string[] = data.messageIds ?? [];
      if (ids.length === 0) return;
      setReadMap((prev) => {
        const next = { ...prev };
        for (const id of ids) next[id] = true;
        return next;
      });
    });

    sock.on("ticket:status-updated", (data: any) => {
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
        !(readMap[m.id] ?? m.is_read ?? true);
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
      (ack: any) => {
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
    <div className="flex flex-col h-full bg-[#090b10]">
      {/* Header */}
      <div className="h-14 shrink-0 border-b border-white/5 bg-[#0c0e16] flex items-center gap-3 px-4">
        <div className="w-8 h-8 rounded-full bg-blue-600/30 flex items-center justify-center shrink-0">
          <span className="text-xs font-mono font-bold text-blue-300">
            {assigneeName ? assigneeName[0].toUpperCase() : "A"}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className={`text-xs font-mono font-semibold truncate ${assigneeName ? "text-blue-200" : "text-white/40"}`}>
              {assigneeName ?? "Awaiting Assignment"}
            </div>
            {/* Connection dot */}
            <span
              title={connectError ? `Error: ${connectError}` : connected ? "Connected" : "Connecting…"}
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${connectError ? "bg-rose-400 animate-pulse" : connected ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`}
            />
          </div>
          <div className="flex items-center gap-2">
            <code className="text-[9px] font-mono text-blue-400">#{ticket.ticket_id}</code>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-[8px] font-mono font-bold text-blue-300">
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
              className="p-1.5 rounded text-white/30 hover:text-white/70 hover:bg-white/5 transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => setShowSearch((v) => !v)}
            className={`p-1.5 rounded transition ${showSearch ? "text-violet-400 bg-violet-500/10" : "text-white/30 hover:text-white/70 hover:bg-white/5"}`}
          >
            <Search className="w-3.5 h-3.5" />
          </button>
          <button onClick={onClose} className="p-1.5 rounded text-white/30 hover:text-white/70 hover:bg-white/5 transition">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="px-4 py-2.5 border-b border-white/5 bg-[#0c0e16]">
          <input
            type="text"
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            placeholder="Search messages…"
            autoFocus
            className="w-full bg-transparent border border-white/10 text-white text-xs font-mono px-3 py-1.5 rounded-lg focus:outline-none focus:border-violet-500/40 placeholder:text-white/20"
          />
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 bg-[#08090e] space-y-1">
        {displayed.length === 0 && (
          <div className="text-center text-white/20 text-xs font-mono mt-12">No messages yet</div>
        )}
        {displayed.map((msg, idx) => {
          const showDay = idx === 0 || dayKey(displayed[idx - 1].createdAt) !== dayKey(msg.createdAt);
          return (
            <React.Fragment key={`${msg.id ?? "welcome"}-${idx}`}>
              {showDay && (
                <div className="text-center text-[9px] font-mono text-white/25 my-3">{fmtDay(msg.createdAt)}</div>
              )}
              <div className={`flex mb-2 ${msg.sender === "user" && !msg.isSystem ? "justify-end" : "justify-start"}`}>
                <div className={`relative px-4 py-2.5 text-xs font-mono leading-relaxed shadow-sm ${msg.isBackendSystem
                  ? "max-w-[85%] bg-amber-500/10 border border-amber-500/20 text-amber-300/80 rounded-xl rounded-bl-sm"
                  : msg.isSystem
                    ? "max-w-[85%] bg-white/5 border border-white/8 text-white/50 rounded-xl"
                    : msg.sender === "user"
                      ? "max-w-[70%] bg-violet-600 text-white rounded-2xl rounded-br-sm"
                      : msg.isUnread
                        ? "max-w-[70%] bg-[#0f0c1a] border border-violet-500/30 text-white/80 rounded-2xl rounded-bl-sm ring-1 ring-violet-500/20"
                        : "max-w-[70%] bg-white/8 text-white/70 rounded-2xl rounded-bl-sm border border-white/8"
                  }`}>
                  {msg.isBackendSystem && (
                    <div className="text-[9px] font-bold uppercase tracking-widest mb-1.5 text-amber-400/60">System</div>
                  )}
                  {/* Unread indicator dot */}
                  {msg.isUnread && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-violet-400 rounded-full border-2 border-[#08090e]" />
                  )}
                  <p className="whitespace-pre-line">{msg.text}</p>
                  <div className="text-[9px] mt-1.5 text-right opacity-50">{fmtTime(msg.createdAt)}</div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {isClosedOrResolved ? (
        <div className="bg-[#090b10] border-t border-white/5 px-4 py-4 shrink-0">
          <div className="bg-white/3 border border-white/8 rounded-xl p-3 text-center">
            <p className="text-xs font-mono text-white/40">
              {(liveStatus || ticket.status || "").toLowerCase().includes("resolv") ? "✓ Ticket resolved — chat disabled." : "Ticket closed — messaging disabled."}
            </p>
          </div>
        </div>
      ) : !ticket.assignee_details || (!ticket.assignee_details.firstName && !ticket.assignee_details.lastName) ? (
        <div className="bg-[#090b10] border-t border-white/5 px-4 py-4 shrink-0">
          <div className="bg-white/3 border border-white/8 rounded-xl p-3 text-center">
            <p className="text-xs font-mono text-amber-400/60">
              Technician not assigned yet. Please wait for the technician to be assigned.
            </p>
          </div>
        </div>
      ) : connectError ? (
        <div className="bg-[#090b10] border-t border-white/5 px-4 py-4 shrink-0">
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <p className="text-xs font-mono text-rose-400/80 truncate">Connection failed — check your session</p>
          </div>
        </div>
      ) : (
        <div className="bg-[#090b10] border-t border-white/5 px-3 py-3 flex items-center gap-2 shrink-0">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={connected ? "Start Typing" : "Connecting…"}
            disabled={!connected}
            className="flex-1 bg-white/5 rounded-full px-4 py-2 text-xs font-mono text-white placeholder:text-white/20 focus:outline-none border border-white/5 focus:border-violet-500/30 disabled:opacity-40"
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={!message.trim() || !connected}
            className={`transition ${message.trim() && connected ? "text-violet-400 hover:text-violet-300" : "text-white/20 cursor-not-allowed"}`}
          >
            <SendHorizontal className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
