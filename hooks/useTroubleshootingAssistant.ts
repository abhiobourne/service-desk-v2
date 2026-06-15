"use client";

import { useState, useRef, useCallback } from "react";

export interface TroubleshootingFaqItem {
  id: string;
  question: string;
  answer: string; // may contain HTML
}

export interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  text: string;
}

function stripHtml(s: string) {
  return s.replace(/<[^>]*>/g, "").trim();
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function generateQuestion(faq: TroubleshootingFaqItem): Promise<string> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message:
          `You are a troubleshooting assistant.\n` +
          `Convert the following FAQ into a short, single troubleshooting question for the user to consider.\n` +
          `FAQ Question: ${faq.question}\n` +
          `FAQ Answer: ${stripHtml(faq.answer)}\n` +
          `Return ONLY the generated question string. Do not include any quotes, explanations, or additional text.`,
      }),
    });
    if (!res.ok) throw new Error("api-error");
    const data = await res.json();
    return (data.reply as string)?.trim() || `Is your issue related to: ${faq.question}?`;
  } catch {
    return `Is your issue related to: ${faq.question}?`;
  }
}

export function useTroubleshootingAssistant() {
  const [messages, setMessages]   = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping]   = useState(false);
  const [isFinished, setIsFinished]     = useState(false);
  const [needsTicket, setNeedsTicket]   = useState(false);
  const [isResolved, setIsResolved]     = useState(false);

  // Refs for state values that async callbacks must read without stale closure
  const faqsRef                    = useRef<TroubleshootingFaqItem[]>([]);
  const indexRef                   = useRef(0);
  const isFinishedRef              = useRef(false);
  const waitingForResolutionRef    = useRef(false);

  // Sync helpers — update both ref and React state
  function setFinished(v: boolean)            { isFinishedRef.current = v;         setIsFinished(v); }
  function setWaitingForResolution(v: boolean){ waitingForResolutionRef.current = v; }

  function append(msg: Omit<ChatMessage, "id">) {
    setMessages(prev => [...prev, { ...msg, id: uid() }]);
  }

  const askNextQuestion = useCallback(async (
    faqs: TroubleshootingFaqItem[],
    index: number,
    prefix?: string,
  ) => {
    if (index >= faqs.length) {
      const text = prefix
        ? `${prefix}\n\nIs your issue resolved?`
        : "Is your issue resolved?";
      append({ role: "assistant", text });
      setFinished(true);
      return;
    }

    indexRef.current = index;
    setIsTyping(true);
    const question = await generateQuestion(faqs[index]);
    setIsTyping(false);

    const text = prefix ? `${prefix}\n\n${question}` : question;
    append({ role: "assistant", text });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startSession = useCallback(async (faqs: TroubleshootingFaqItem[]) => {
    // Reset all state
    setMessages([]);
    setIsTyping(false);
    setFinished(false);
    setNeedsTicket(false);
    setIsResolved(false);
    setWaitingForResolution(false);
    faqsRef.current = faqs;
    indexRef.current = 0;

    if (faqs.length === 0) {
      append({ role: "assistant", text: "No troubleshooting steps are available for this component. Would you like to raise a support ticket?" });
      setFinished(true);
      setNeedsTicket(true);
      return;
    }

    await askNextQuestion(faqs, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askNextQuestion]);

  const handleUserResponse = useCallback(async (response: "Yes" | "No") => {
    append({ role: "user", text: response });

    const faqs  = faqsRef.current;
    const index = indexRef.current;
    const finished = isFinishedRef.current;
    const waitingForResolution = waitingForResolutionRef.current;

    // ── Final "is your issue resolved?" prompt ──
    if (finished) {
      if (response === "Yes") {
        append({ role: "assistant", text: "Glad I could help! The issue has been resolved. ✓" });
        setIsResolved(true);
      } else {
        append({ role: "assistant", text: "No worries — let's get this escalated so our team can take a closer look." });
        setNeedsTicket(true);
      }
      return;
    }

    // ── "Did the answer help?" follow-up ──
    if (waitingForResolution) {
      setWaitingForResolution(false);
      if (response === "Yes") {
        append({ role: "assistant", text: "Glad I could help! The issue has been resolved. ✓" });
        setIsResolved(true);
      } else {
        const nextIndex = index + 1;
        const prefix = nextIndex >= faqs.length
          ? "We have explored all troubleshooting options for this component."
          : "Okay, let's explore other options.";
        await askNextQuestion(faqs, nextIndex, prefix);
      }
      return;
    }

    // ── Standard FAQ question ──
    if (response === "Yes") {
      await new Promise(r => setTimeout(r, 600));
      const rawAnswer = faqs[index]?.answer ?? "";
      const answer = stripHtml(rawAnswer) || "Please follow the documented inspection steps for this component.";
      append({ role: "assistant", text: `${answer}\n\nDid this help resolve your issue?` });
      setWaitingForResolution(true);
    } else {
      await askNextQuestion(faqs, index + 1, "It doesn't seem to be this problem.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askNextQuestion]);

  return {
    messages,
    isTyping,
    isFinished,
    needsTicket,
    isResolved,
    startSession,
    handleUserResponse,
  };
}
