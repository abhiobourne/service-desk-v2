"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { X, SendHorizontal, Search, ExternalLink } from "lucide-react";
import { io, Socket } from "socket.io-client";
import { fetchTicketCommunications, getApiToken } from "../../lib/api";
import { useAuth } from "../../providers/AuthProvider";
import type { OrderTicket } from "../../lib/api";

const SOCKET_URL = "http://localhost:7000";

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
}

export function InlineTicketChat({ ticket, onClose, onOpenDetail }: InlineTicketChatProps) {
  const { user } = useAuth();
  const [apiMessages, setApiMessages] = useState<any[]>([]);
  const [liveMessages, setLiveMessages] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [searchVal, setSearchVal] = useState("");
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const ticketId = ticket.id;

  // Load past messages
  useEffect(() => {
    setLiveMessages([]);
    fetchTicketCommunications(ticketId).then(setApiMessages);
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
    sock.on("connect", () => { sock.emit("ticket:subscribe", { ticketId }); });
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
  }, [ticketId]);

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
        id: m.id,
        sender: fromMe ? "user" : "agent",
        text: m.message ?? "",
        createdAt: m.createdAt,
        isSystem: isBackendSystem,
        isBackendSystem,
      };
    });

    const welcome: ChatMsg = {
      sender: "agent",
      text: `Ticket ${ticket.ticket_id} created.\n\nOrder: ${ticket.order_id ?? "—"}\nProduct: ${ticket.items?.[0]?.product_name ?? "—"}\nReason: ${(ticket.reason ?? "No reason provided.").replace(/<[^>]*>/g, "")}\nStatus: ${ticket.status}\nAssigned: ${ticket.assignee_details ? `${ticket.assignee_details.firstName ?? ""} ${ticket.assignee_details.lastName ?? ""}`.trim() || "Agent" : "Unassigned"}`,
      createdAt: "2000-01-01T00:00:00.000Z",
      isSystem: true,
      isBackendSystem: false,
    };
    return [welcome, ...mapped].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [apiMessages, liveMessages, user?.id, ticket]);

  const displayed = useMemo(() => {
    if (!searchVal.trim()) return allMessages;
    const q = searchVal.toLowerCase();
    return allMessages.filter((m) => m.text.toLowerCase().includes(q));
  }, [allMessages, searchVal]);

  const isClosedOrResolved = ["resolved", "closed"].includes((ticket.status ?? "").toLowerCase());

  const sendMessage = () => {
    if (!message.trim() || isClosedOrResolved || !socketRef.current?.connected) return;
    socketRef.current.emit("ticket:send-message", { ticketId, message: message.trim(), metadata: null });
    setMessage("");
  };

  const assigneeName = ticket.assignee_details
    ? `${ticket.assignee_details.firstName ?? ""} ${ticket.assignee_details.lastName ?? ""}`.trim() || "Agent"
    : null;

  const fmt = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString("en-GB")} · ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  return (
    <div className="flex flex-col h-full bg-[#090b10]">
      {/* Header */}
      <div className="h-14 shrink-0 border-b border-white/5 flex items-center gap-3 px-4">
        <div className="w-8 h-8 rounded-full bg-violet-600/30 flex items-center justify-center shrink-0">
          <span className="text-xs font-mono font-bold text-violet-300">
            {assigneeName ? assigneeName[0].toUpperCase() : "A"}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-mono font-semibold text-white/80 truncate">
            {assigneeName ?? "Support Agent"}
          </div>
          <code className="text-[9px] font-mono text-violet-400">#{ticket.ticket_id}</code>
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
        {displayed.map((msg, idx) => (
          <React.Fragment key={`${msg.createdAt}-${idx}`}>
            <div className="text-center text-[9px] font-mono text-white/20 my-2">{fmt(msg.createdAt)}</div>
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
              </div>
            </div>
          </React.Fragment>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {isClosedOrResolved ? (
        <div className="bg-[#090b10] border-t border-white/5 px-4 py-4 shrink-0">
          <div className="bg-white/3 border border-white/8 rounded-xl p-3 text-center">
            <p className="text-xs font-mono text-white/40">
              {ticket.status?.includes("resolv") ? "✓ Ticket resolved — chat disabled." : "🔒 Ticket closed — messaging disabled."}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-[#090b10] border-t border-white/5 px-3 py-3 flex items-center gap-2 shrink-0">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Secure message…"
            className="flex-1 bg-white/5 rounded-full px-4 py-2 text-xs font-mono text-white placeholder:text-white/20 focus:outline-none border border-white/5 focus:border-violet-500/30"
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={!message.trim()}
            className={`transition ${message.trim() ? "text-violet-400 hover:text-violet-300" : "text-white/20 cursor-not-allowed"}`}
          >
            <SendHorizontal className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
