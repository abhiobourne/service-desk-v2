"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { X, SendHorizontal, Search, Check, CheckCheck } from "lucide-react";
import { io, Socket } from "socket.io-client";
import toast from "react-hot-toast";
import { fetchTicketCommunications } from "../../lib/api";
import { useAuth } from "../../providers/AuthProvider";
import { getApiToken } from "../../lib/api";

const SOCKET_URL = process.env.NEXT_PUBLIC_API_SERVER || "http://localhost:7000";

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

interface TicketCommunicationMessage {
  id?: string;
  sender_id?: string;
  message?: string;
  createdAt: string;
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

function MessageReadTick({ isRead }: { isRead?: boolean }) {
  return isRead ? <CheckCheck size={12} className="text-emerald-400" /> : <Check size={12} className="text-white/80" />;
}

export function TicketChatDrawer({ isOpen, onClose, ticketId, ticketInfo }: TicketChatDrawerProps) {
  const { user } = useAuth();
  const [apiMessages, setApiMessages] = useState<TicketCommunicationMessage[]>([]);
  const [liveMessages, setLiveMessages] = useState<TicketCommunicationMessage[]>([]);
  const [message, setMessage] = useState("");
  const [searchVal, setSearchVal] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  // Load past messages
  useEffect(() => {
    if (!isOpen || !ticketId) return;
    fetchTicketCommunications(ticketId).then((messages) => {
      setLiveMessages([]);
      setApiMessages(messages as TicketCommunicationMessage[]);
    });
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
    sock.on("connect", () => {
      sock.emit("ticket:subscribe", { ticketId });
    });
    sock.on("connect_error", (err) => {
      console.error("[TicketChatDrawer] connect_error:", err.message);
    });
    sock.on("exception", (error: SocketError) => { toast.error(error?.message || "Something went wrong"); });
    sock.on("ticket:message-created", (msg: TicketCommunicationMessage) => {
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

  // Close search on outside click
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        setShowSearch(false);
        setSearchVal("");
      }
    };
    if (showSearch) document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showSearch]);

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
      (ack: SendMessageAck | undefined) => {
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
    <div className="fixed inset-0 z-[10005] flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Drawer panel */}
      <div className="absolute inset-y-0 right-0 flex flex-col w-full sm:w-[480px] md:w-[600px] lg:w-[750px] xl:w-[900px] bg-[#f7f7f8] shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 bg-white border-b border-slate-200 shrink-0">
          <h2 className="text-base sm:text-lg font-semibold text-slate-800 truncate">
            #{ticketInfo?.ticket_id ?? ticketId}
          </h2>

          <div className="flex items-center gap-1 shrink-0">
            {/* Search toggle */}
            <div ref={searchContainerRef}>
              <button
                onClick={(e) => { e.stopPropagation(); setShowSearch((prev) => !prev); }}
                className={`p-2 rounded-md transition ${showSearch ? "bg-slate-100 text-slate-900" : "hover:bg-slate-100 text-slate-600"}`}
              >
                <Search size={18} />
              </button>
            </div>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Search bar */}
        {showSearch && (
          <div className="px-4 py-3 bg-white border-b border-slate-200 shrink-0">
            <div className="relative">
              <input
                type="text"
                placeholder="Search messages..."
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-4 py-2 pr-10 text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#5B6CFF]"
                autoFocus
              />
              {searchVal && (
                <button
                  type="button"
                  onClick={() => setSearchVal("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-5 bg-[#f7f7f8]">
          {displayed.length === 0 && (
            <div className="text-center text-slate-400 text-sm mt-10">No messages found</div>
          )}

          {displayed.map((msg, idx) => {
            const showDay = idx === 0 || dayKey(displayed[idx - 1].createdAt) !== dayKey(msg.createdAt);
            return (
              <React.Fragment key={`${msg.id ?? "welcome"}-${idx}`}>
                {showDay && (
                  <div className="text-center text-xs text-slate-400 my-3">
                    {fmtDay(msg.createdAt)}
                  </div>
                )}

                <div className={`flex mb-3 ${msg.sender === "user" && !msg.isSystem ? "justify-end" : "justify-start"}`}>
                  <div className={`px-4 py-3 text-sm leading-relaxed shadow-sm ${
                    msg.isBackendSystem
                      ? "max-w-[90%] bg-[#FFF7E8] border border-[#F6D48F] text-[#7A5B00] rounded-2xl rounded-bl-md"
                      : msg.sender === "user"
                        ? "max-w-[75%] bg-[#5B6CFF] text-white rounded-2xl rounded-br-md"
                        : "max-w-[75%] bg-white text-slate-700 rounded-2xl rounded-bl-md"
                  }`}>
                    {msg.isBackendSystem && (
                      <div className="text-[11px] font-semibold uppercase tracking-wide mb-2 text-[#A17400]">
                        System Message
                      </div>
                    )}
                    <p className="whitespace-pre-line">{msg.text}</p>
                    <div className="mt-2 flex items-center justify-end gap-1 text-[10px] opacity-70">
                      <span>{fmtTime(msg.createdAt)}</span>
                      {msg.sender === "user" && !msg.isSystem && <MessageReadTick />}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}

          <div ref={bottomRef} />
        </div>

        {/* Footer */}
        {isClosedOrResolved ? (
          <div className="bg-white border-t border-slate-200 px-4 py-4 shrink-0">
            <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 text-center">
              <p className="text-sm text-slate-600">
                {ticketInfo?.status?.includes("resolv")
                  ? <>✅ This ticket has been <span className="font-semibold">resolved</span>. Chat is disabled.</>
                  : <>🔒 This ticket has been <span className="font-semibold">closed</span>. You cannot send messages.</>
                }
              </p>
            </div>
          </div>
        ) : !ticketInfo?.assignee_details || (!ticketInfo.assignee_details.firstName && !ticketInfo.assignee_details.lastName) ? (
          <div className="bg-white border-t border-slate-200 px-4 py-4 shrink-0">
            <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 text-center">
              <p className="text-sm text-slate-600">
                ⚠️ Assign a technician to enable chat.
              </p>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
            className="bg-white border-t border-slate-200 px-4 py-3 flex items-center gap-3 shrink-0"
          >
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Write a message..."
              className="flex-1 bg-slate-100 rounded-full px-4 py-2 text-sm text-black focus:outline-none min-w-0"
            />
            <button
              type="submit"
              disabled={!message.trim()}
              className={`shrink-0 transition ${message.trim() ? "text-[#5B6CFF] hover:text-blue-700" : "text-slate-300 cursor-not-allowed"}`}
            >
              <SendHorizontal size={22} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
