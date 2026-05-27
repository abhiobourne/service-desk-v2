"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { X, SendHorizontal, Search } from "lucide-react";
import { io, Socket } from "socket.io-client";
import toast from "react-hot-toast";
import { fetchTicketCommunications } from "../../lib/api";
import { useAuth } from "../../providers/AuthProvider";
import { getApiToken } from "../../lib/api";

const SOCKET_URL = "http://localhost:7000";

interface TicketChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  ticketId: string;
  ticketInfo?: {
    ticket_id: string;
    status: string;
    createdAt?: string;
    order_id?: string;
    product_name?: string;
    reason?: string;
    description?: string;
    user_name?: string;
    assignee_details?: { firstName?: string | null; lastName?: string | null } | null;
  };
}

interface ChatMsg {
  id?: string;
  sender: "user" | "agent";
  text: string;
  createdAt: string;
  isSystem?: boolean;
  isBackendSystem?: boolean;
}

export function TicketChatDrawer({ isOpen, onClose, ticketId, ticketInfo }: TicketChatDrawerProps) {
  const { user } = useAuth();
  const [apiMessages, setApiMessages] = useState<any[]>([]);
  const [liveMessages, setLiveMessages] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [searchVal, setSearchVal] = useState("");
  const [sending, setSending] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load past messages
  useEffect(() => {
    if (!isOpen || !ticketId) return;
    setLiveMessages([]);
    fetchTicketCommunications(ticketId).then(setApiMessages);
  }, [isOpen, ticketId]);

  // Socket.io
  useEffect(() => {
    if (!isOpen || !ticketId) return;
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
    sock.on("connect", () => { sock.emit("ticket:subscribe", { ticketId }); });
    sock.on("connect_error", (err) => { console.error("[TicketChatDrawer] connect_error:", err.message); });
    sock.on("exception", (error: any) => { toast.error(error?.message || "Something went wrong"); });
    sock.on("ticket:message-created", (msg: any) => {
      setLiveMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });
    return () => {
      sock.emit("ticket:unsubscribe", { ticketId });
      sock.disconnect();
      socketRef.current = null;
    };
  }, [isOpen, ticketId]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [apiMessages, liveMessages]);

  const allMessages = useMemo<ChatMsg[]>(() => {
    const merged = [...apiMessages, ...liveMessages].filter(
      (m, i, arr) => i === arr.findIndex((x) => x.id === m.id),
    );
    const mapped: ChatMsg[] = merged.map((m) => {
      const fromMe = m.sender_id === user?.id;
      const isBackendSystem = !!m.metadata?.status || m.type === "system" || m.is_system === true;
      return {
        id: m.id, sender: fromMe ? "user" : "agent",
        text: m.message ?? "", createdAt: m.createdAt,
        isSystem: isBackendSystem, isBackendSystem,
      };
    });

    // Synthetic system welcome message
    if (ticketInfo) {
      const welcome: ChatMsg = {
        sender: "agent",
        text: `Ticket ${ticketInfo.ticket_id} has been created successfully.\n\nOrder ID: ${ticketInfo.order_id ?? "—"}\nProduct: ${ticketInfo.product_name ?? "—"}\nReason:\n${(ticketInfo.reason ?? "No reason provided.").replace(/<[^>]*>/g, "")}\nDescription:\n${(ticketInfo.description ?? "No description provided.").replace(/<[^>]*>/g, "")}\nRaised By: ${ticketInfo.user_name ?? "Unknown"}\nAssigned To: ${ticketInfo.assignee_details ? `${ticketInfo.assignee_details.firstName ?? ""} ${ticketInfo.assignee_details.lastName ?? ""}`.trim() || "Agent" : "Unassigned"}\nStatus: ${ticketInfo.status}`,
        createdAt: ticketInfo.createdAt ?? new Date().toISOString(),
        isSystem: true, isBackendSystem: false,
      };
      return [welcome, ...mapped].sort((a, b) => {
        if (!a.id && !b.id) return 0;
        if (!a.id) return -1;
        if (!b.id) return 1;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
    }
    return mapped.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [apiMessages, liveMessages, user?.id, ticketInfo]);

  const displayed = useMemo(() => {
    if (!searchVal.trim()) return allMessages;
    const q = searchVal.toLowerCase();
    return allMessages.filter((m) => m.text.toLowerCase().includes(q));
  }, [allMessages, searchVal]);

  const isClosedOrResolved = ["resolved", "closed"].includes((ticketInfo?.status ?? "").toLowerCase());

  const sendMessage = () => {
    if (!message.trim() || isClosedOrResolved || !socketRef.current?.connected) return;
    const msgToSend = message.trim();
    setMessage("");
    socketRef.current.emit(
      "ticket:send-message",
      { ticketId, message: msgToSend, metadata: null },
      (ack: any) => {
        if (ack && !ack.success) {
          setMessage(msgToSend);
          toast.error(ack.message || "Failed to send message");
        }
      },
    );
  };

  const fmtDay = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString("en-US", { weekday: "long" })}, ${d.toLocaleDateString("en-GB")}`;
  };
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-GB");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-50 w-1/2 min-w-[640px] max-w-[900px] h-full bg-[#090b10] border-l border-white/5 flex flex-col shadow-2xl">
        <div className="h-12 shrink-0 border-b border-white/5 flex items-center justify-between px-4">
          <span className="text-sm font-mono text-white/70">
            Chat — <code className="text-violet-400">#{ticketInfo?.ticket_id ?? ticketId}</code>
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowSearch((v) => !v)} className="p-1.5 rounded text-white/30 hover:text-white/70 hover:bg-white/5 transition">
              <Search className="w-3.5 h-3.5" />
            </button>
            <button onClick={onClose} className="p-1.5 rounded text-white/30 hover:text-white/70 hover:bg-white/5 transition">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

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

        <div className="flex-1 overflow-y-auto px-4 py-5 bg-[#08090e] space-y-1">
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
                  <div className={`px-4 py-2.5 text-xs font-mono leading-relaxed shadow-sm ${
                    msg.isBackendSystem
                      ? "max-w-[85%] bg-amber-500/10 border border-amber-500/20 text-amber-300/80 rounded-xl rounded-bl-sm"
                      : msg.isSystem
                      ? "max-w-[85%] bg-white/5 border border-white/8 text-white/50 rounded-xl"
                      : msg.sender === "user"
                      ? "max-w-[70%] bg-violet-600 text-white rounded-2xl rounded-br-sm"
                      : "max-w-[70%] bg-white/8 text-white/70 rounded-2xl rounded-bl-sm border border-white/8"
                  }`}>
                    {msg.isBackendSystem && (
                      <div className="text-[9px] font-bold uppercase tracking-widest mb-1.5 text-amber-400/60">System</div>
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

        {isClosedOrResolved ? (
          <div className="bg-[#090b10] border-t border-white/5 px-4 py-4">
            <div className="bg-white/3 border border-white/8 rounded-xl p-4 text-center">
              <p className="text-xs font-mono text-white/40">
                {ticketInfo?.status?.includes("resolv") ? "✓ Ticket resolved — chat disabled." : "🔒 Ticket closed — messaging disabled."}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-[#090b10] border-t border-white/5 px-3 py-3 flex items-center gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Write a message…"
              className="flex-1 bg-white/5 rounded-full px-4 py-2 text-xs font-mono text-white placeholder:text-white/20 focus:outline-none border border-white/5 focus:border-violet-500/30"
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={!message.trim() || sending}
              className={`transition ${message.trim() ? "text-violet-400 hover:text-violet-300" : "text-white/20 cursor-not-allowed"}`}
            >
              <SendHorizontal className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
