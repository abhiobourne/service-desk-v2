"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import {
  ChevronRight, ChevronDown, Box, Folder, FileText, BookOpen, HelpCircle,
  Search, X, ArrowLeft, Package, Loader2, ChevronLeft, File, CheckSquare, Square,
  FileSpreadsheet, FileImage, MessageCircle, Plus, Ticket, ExternalLink, ClipboardList, Layers,
} from "lucide-react";
import {
  fetchProductCatalog, fetchTroubleshootingByProduct, fetchOrdersList,
  ApiProductCatalog, TroubleshootingDesignNode,
} from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { useAbility } from "@/providers/AbilityProvider";
import { GlbViewerDark, type DarkHotspot } from "@/components/GlbViewerDark";
import { AddTicketDrawer } from "@/components/tickets/AddTicketDrawer";
import { fuzzyAny } from "@/lib/search";
import { Panel, Group, Separator } from "react-resizable-panels";
import { PageHeader } from "@/components/ui/PageHeader";

const BASE_URL = process.env.NEXT_PUBLIC_API_SERVER || "http://localhost:7000";

// ---------------------------------------------------------------------------
// Colour maps (dark theme)
// ---------------------------------------------------------------------------
const NODE_COLORS: Record<string, { icon: string; badge: string; badgeBg: string; row: string }> = {
  "Product": { icon: "text-slate-400", badge: "text-slate-300", badgeBg: "bg-slate-500/15 border-slate-500/25", row: "hover:bg-slate-500/10" },
  "Mother Assembly": { icon: "text-violet-400", badge: "text-violet-300", badgeBg: "bg-violet-500/15 border-violet-500/25", row: "hover:bg-violet-500/10" },
  "Child Assembly": { icon: "text-blue-400", badge: "text-blue-300", badgeBg: "bg-blue-500/15 border-blue-500/25", row: "hover:bg-blue-500/10" },
  "Component": { icon: "text-emerald-400", badge: "text-emerald-300", badgeBg: "bg-emerald-500/15 border-emerald-500/25", row: "hover:bg-emerald-500/10" },
  "Sub-Component": { icon: "text-amber-400", badge: "text-amber-300", badgeBg: "bg-amber-500/15 border-amber-500/25", row: "hover:bg-amber-500/10" },
};
const DESIGN_COLORS: Record<string, string> = {
  "Product": "#64748b", "Mother Assembly": "#7c3aed", "Child Assembly": "#2563eb",
  "Component": "#059669", "Sub-Component": "#d97706",
};
const DEFAULT_NC = NODE_COLORS["Mother Assembly"];

const FILE_ICONS: Record<string, { Icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  pdf: { Icon: FileText, cls: "text-rose-400" },
  doc: { Icon: FileText, cls: "text-blue-400" },
  docx: { Icon: FileText, cls: "text-blue-400" },
  glb: { Icon: Box, cls: "text-indigo-400" },
  gltf: { Icon: Box, cls: "text-indigo-400" },
  xlsx: { Icon: FileSpreadsheet, cls: "text-emerald-400" },
  xls: { Icon: FileSpreadsheet, cls: "text-emerald-400" },
  png: { Icon: FileImage, cls: "text-purple-400" },
  jpg: { Icon: FileImage, cls: "text-purple-400" },
  jpeg: { Icon: FileImage, cls: "text-purple-400" },
  svg: { Icon: FileImage, cls: "text-purple-400" },
  faq: { Icon: HelpCircle, cls: "text-amber-400" },
};
function fileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return FILE_ICONS[ext] ?? { Icon: File, cls: "text-slate-600 dark:text-white/30" };
}
function isGlb(name: string) { const e = name.split(".").pop()?.toLowerCase(); return e === "glb" || e === "gltf"; }
function stripHtml(s: string) { return s.replace(/<[^>]*>/g, "").trim(); }

// ---------------------------------------------------------------------------
// Types for the flat visible tree
// ---------------------------------------------------------------------------
type TreeFileItem = {
  kind: "file";
  id: string;
  name: string;
  url: string;
  path: string;
  isGlb: boolean;
  depth: number;
  isLastChild: boolean;
};
type TreeFaqItem = { kind: "faq"; nodeKey: string; count: number; depth: number; isLastChild: boolean };
type TreeNodeItem = {
  kind: "node";
  key: string;
  node: TroubleshootingDesignNode;
  depth: number;
  isExpanded: boolean;
  isLastChild: boolean;
  isProductRoot?: boolean;
};
type FlatItem = TreeNodeItem | TreeFileItem | TreeFaqItem;

// ---------------------------------------------------------------------------
// Build flat DFS visible list
// ---------------------------------------------------------------------------
function buildFlatList(
  nodes: TroubleshootingDesignNode[],
  expanded: Set<string>,
  activeGlbId: string | null,
  activeDocId: string | null,
  productId: string,
  productName: string,
): FlatItem[] {
  const result: FlatItem[] = [];

  // Synthetic product-root node
  const rootKey = "product-root";
  const isRootExpanded = expanded.has(rootKey);
  result.push({ kind: "node", key: rootKey, node: { design_name: productName, design_type: "Product", design_id: productId, level: -1 } as TroubleshootingDesignNode, depth: 0, isExpanded: isRootExpanded, isLastChild: true, isProductRoot: true });

  if (!isRootExpanded) return result;

  function addChildren(parentUuid: string | null, parentVersionId: string | null, depth: number) {
    const siblings = nodes.filter(
      n => n.parent_design_uuid === parentUuid && n.parent_version_id === parentVersionId,
    );
    siblings.forEach((node, si) => {
      const key = node.design_version_id || node.design_uuid;
      const isExp = expanded.has(key);
      const isLast = si === siblings.length - 1;
      const hasChildren = nodes.some(n => n.parent_design_uuid === node.design_uuid);
      const allFiles = [
        ...node.drawing_files.map(f => ({ ...f, kind_: "drawing" as const })),
        ...node.kb_files.map(f => ({ ...f, kind_: "kb" as const })),
      ];
      const hasFaqs = node.faq_items.length > 0;
      const isExpandable = hasChildren || allFiles.length > 0 || hasFaqs;

      result.push({ kind: "node", key, node, depth, isExpanded: isExp, isLastChild: isLast });

      if (isExp) {
        const fileCount = allFiles.length + (hasFaqs ? 1 : 0);
        allFiles.forEach((f, fi) => {
          const fIsLast = fi === allFiles.length - 1 && !hasFaqs;
          result.push({
            kind: "file", id: f.id, name: f.file_name,
            url: `${BASE_URL}${f.url}`, path: f.path ?? f.url,
            isGlb: isGlb(f.file_name), depth: depth + 1, isLastChild: fIsLast,
          });
        });
        if (hasFaqs) {
          result.push({ kind: "faq", nodeKey: key, count: node.faq_items.length, depth: depth + 1, isLastChild: true });
        }
        addChildren(node.design_uuid, node.design_version_id, depth + 1);
      }
    });
  }

  addChildren(null, null, 1);
  return result;
}

// ---------------------------------------------------------------------------
// Connector lines
// ---------------------------------------------------------------------------
function Connector({ depth, isLast }: { depth: number; isLast: boolean }) {
  if (depth === 0) return null;
  const left = 8 + (depth - 1) * 14 + 6;
  return (
    <>
      <span className="pointer-events-none absolute border-l border-dashed border-slate-200 dark:border-white/10" style={{ left, top: 0, bottom: isLast ? "50%" : 0 }} />
      <span className="pointer-events-none absolute h-px bg-slate-100 dark:bg-white/10" style={{ left, top: "50%", width: 7 }} />
    </>
  );
}

// ---------------------------------------------------------------------------
// FAQ Accordion
// ---------------------------------------------------------------------------
function FaqAccordion({ items }: { items: TroubleshootingDesignNode["faq_items"] }) {
  const [open, setOpen] = useState<string>("");
  return (
    <div className="p-6 space-y-2 overflow-y-auto h-full">
      <h3 className="text-[10px] font-mono text-slate-600 dark:text-white/30 uppercase tracking-widest mb-4">Frequently Asked Questions</h3>
      {items.map(faq => (
        <div key={faq.id} className="border border-slate-200 dark:border-white/8 rounded-lg overflow-hidden">
          <button
            onClick={() => setOpen(o => o === faq.id ? "" : faq.id)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-100 dark:bg-white/5 transition"
          >
            <span className="text-xs font-mono text-amber-400/90 font-semibold leading-snug pr-4">{faq.question}</span>
            {open === faq.id
              ? <ChevronDown className="h-3.5 w-3.5 text-slate-600 dark:text-white/30 shrink-0" />
              : <ChevronRight className="h-3.5 w-3.5 text-slate-600 dark:text-white/30 shrink-0" />}
          </button>
          {open === faq.id && (
            <div className="px-4 pb-4 border-t border-slate-200 dark:border-white/5">
              <p className="text-[11px] font-mono text-slate-600 dark:text-white/50 leading-relaxed mt-3">{stripHtml(faq.answer)}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Doc Viewer
// ---------------------------------------------------------------------------
function DocViewer({ src, fileName, faqItems }: {
  src: string | null;
  fileName: string | null;
  faqItems: TroubleshootingDesignNode["faq_items"] | null;
}) {
  if (faqItems) return <FaqAccordion items={faqItems} />;

  if (!src || !fileName) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center">
          <FileText className="w-6 h-6 text-slate-600 dark:text-white/20" />
        </div>
        <div>
          <p className="text-sm font-mono text-slate-600 dark:text-white/30">No document selected</p>
          <p className="text-xs font-mono text-slate-600 dark:text-white/20 mt-1">Click a PDF, doc, or FAQ from the tree</p>
        </div>
      </div>
    );
  }

  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";

  if (ext === "pdf") {
    return (
      <iframe
        key={src}
        src={src}
        className="w-full h-full border-0 bg-white"
        title={fileName}
      />
    );
  }

  if (ext === "md" || ext === "txt") {
    return <MarkdownViewer src={src} />;
  }

  // Fallback: open in new tab link + iframe attempt
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-slate-200 dark:border-white/5 flex items-center gap-2">
        {(() => { const { Icon, cls } = fileIcon(fileName); return <Icon className={`h-3.5 w-3.5 ${cls}`} />; })()}
        <span className="text-xs font-mono text-slate-600 dark:text-white/50 truncate flex-1">{fileName}</span>
        <a href={src} target="_blank" rel="noreferrer" className="text-[10px] font-mono text-blue-400 hover:text-blue-300 uppercase tracking-wide shrink-0">Open ↗</a>
      </div>
      <div className="flex-1 overflow-hidden">
        <iframe key={src} src={src} className="w-full h-full border-0 bg-white" title={fileName} />
      </div>
    </div>
  );
}

function MarkdownViewer({ src }: { src: string }) {
  const [html, setHtml] = useState("Loading…");
  useEffect(() => {
    (async () => {
      try {
        const MarkdownIt = (await import("markdown-it")).default;
        const md = new MarkdownIt({ html: false, linkify: true, typographer: true });
        const res = await fetch(src);
        const text = await res.text();
        setHtml(md.render(text));
      } catch {
        setHtml("<p style='color:#666;padding:16px'>Preview failed.</p>");
      }
    })();
  }, [src]);
  return (
    <div
      className="w-full h-full overflow-auto p-6 text-[13px] text-slate-600 dark:text-white/70 leading-relaxed prose prose-invert prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function TroubleshootingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ orderRef?: string; productName?: string }>();
  const { user, loading: authLoading } = useAuth();

  const orderRef = params?.orderRef ? decodeURIComponent(params.orderRef) : "";
  const productNameFromUrl = params?.productName ? decodeURIComponent(params.productName) : "";

  // Full-view: either ?full=1 OR opened via nested /troubleshooting/:orderRef/:productName route
  const isFullView = searchParams.get("full") === "1" || !!(params?.orderRef && params?.productName);
  const queryProductId = searchParams.get("productId") ?? "";
  const queryClientId = searchParams.get("clientId") ?? "";
  const queryOrderId = searchParams.get("orderId") ?? "";

  const [products, setProducts] = useState<ApiProductCatalog[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [selectedOrderCtx, setSelectedOrderCtx] = useState<any | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [treeNodes, setTreeNodes] = useState<TroubleshootingDesignNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["product-root"]));
  const [loadingTree, setLoadingTree] = useState(false);
  const [productsLoading, setProductsLoading] = useState(true);

  // Active file state
  const [activeGlbSrc, setActiveGlbSrc] = useState<string | null>(null);
  const [activeGlbId, setActiveGlbId] = useState<string | null>(null);
  const [glbHistory, setGlbHistory] = useState<Array<{ src: string; id: string }>>([]);
  const [activeDocSrc, setActiveDocSrc] = useState<string | null>(null);
  const [activeDocName, setActiveDocName] = useState<string | null>(null);
  const [activeFaqNodeKey, setActiveFaqNodeKey] = useState<string | null>(null);

  // Nav breadcrumb path
  const [navPath, setNavPath] = useState<TroubleshootingDesignNode[]>([]);

  // Search
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Sidebar collapse
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Right panel: "3d" | "chat"
  const [rightPanel, setRightPanel] = useState<"3d" | "chat">("3d");

  // Gemini AI chat state
  type ChatMsg = { role: "user" | "assistant"; text: string; id: string };
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatStarted, setChatStarted] = useState(false);
  const [chatFinished, setChatFinished] = useState(false);
  const [chatNeedsTicket, setChatNeedsTicket] = useState(false);
  const [chatResolved, setChatResolved] = useState(false);
  const [chatFaqIndex, setChatFaqIndex] = useState(0);
  const [chatWaitingForResolution, setChatWaitingForResolution] = useState(false);
  const [addTicketOpen, setAddTicketOpen] = useState(false);
  const [selectedParts, setSelectedParts] = useState<Set<string>>(new Set());
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Auth guard is handled globally by DashboardLayout

  // Gate: both order and product must be selected before showing the 3-pane workspace
  const hasOrderCtx = !!(selectedOrderCtx?.id || queryOrderId || orderRef);
  const hasProductCtx = !!selectedProductId;
  const hasContext = hasOrderCtx && hasProductCtx;

  // Load products catalog + orders list.
  // We eagerly set selectedProductId from the URL so the tree loads without waiting for catalog.
  // After catalog loads, we normalise the ID (URL might pass product_id display string instead of UUID).
  useEffect(() => {
    if (!user && !isFullView) return;

    if (queryProductId) {
      setSelectedProductId(queryProductId);
    }

    fetchProductCatalog().then(list => {
      setProducts(list);
      setProductsLoading(false);

      // Normalise: if the URL param matches by product_id (display) rather than UUID, resolve to UUID
      if (queryProductId) {
        const byUuid = list.find(p => p.id === queryProductId);
        const byDisplay = list.find(p => p.product_id === queryProductId);
        const resolved = byUuid ?? byDisplay;
        if (resolved && resolved.id !== queryProductId) {
          setSelectedProductId(resolved.id);
        }
        return;
      }

      // Match by URL product name (nested route)
      if (productNameFromUrl) {
        const found = list.find(p => p.product_name.toLowerCase() === productNameFromUrl.toLowerCase());
        if (found) { setSelectedProductId(found.id); return; }
      }

      // No URL context — auto-select first product
      if (list.length > 0) setSelectedProductId(list[0].id);
    });

    setOrdersLoading(true);
    fetchOrdersList().then(list => {
      setAllOrders(list);
      setOrdersLoading(false);
      if (queryOrderId) {
        const matched = list.find((o: any) => o.id === queryOrderId || o.order_id === queryOrderId);
        if (matched) setSelectedOrderCtx(matched);
      } else if (list.length > 0) {
        setSelectedOrderCtx(list[0]);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isFullView, queryProductId, productNameFromUrl]);

  // Clear part selections when order or product context changes
  useEffect(() => {
    setSelectedParts(new Set());
  }, [selectedProductId, selectedOrderCtx]);

  // Load tree when product changes
  useEffect(() => {
    if (!selectedProductId) return;
    setLoadingTree(true);
    setTreeNodes([]);
    setExpanded(new Set(["product-root"]));
    setActiveGlbSrc(null); setActiveGlbId(null); setGlbHistory([]);
    setActiveDocSrc(null); setActiveDocName(null); setActiveFaqNodeKey(null);
    setNavPath([]);
    fetchTroubleshootingByProduct(selectedProductId).then(res => {
      if (res.success && res.data.length > 0) {
        setTreeNodes(res.data);

        // If the product itself has a GLB, use it as the default viewer src
        if (res.product_glb && !activeGlbSrc) {
          setActiveGlbSrc(`${BASE_URL}${res.product_glb}`);
        }

        // Auto-expand and navigate to ?part= if provided
        const partParam = searchParams.get("part") ?? "";
        if (partParam) {
          const target = res.data.find(n => n.design_id === partParam);
          if (target) {
            const toExpand = new Set<string>(["product-root"]);
            const chain: TroubleshootingDesignNode[] = [];
            let cur: TroubleshootingDesignNode | undefined = target;
            while (cur) {
              toExpand.add(cur.design_version_id || cur.design_uuid);
              chain.unshift(cur);
              const parent = res.data.find(
                n => n.design_uuid === cur!.parent_design_uuid && n.design_version_id === cur!.parent_version_id
              );
              cur = parent;
            }
            setExpanded(toExpand);
            setNavPath(chain);

            // Auto-load target's GLB, or fall back to product GLB, then first GLB in tree
            const targetGlb = target.drawing_files.find(f => isGlb(f.file_name));
            if (targetGlb) {
              setActiveGlbSrc(`${BASE_URL}${targetGlb.url}`);
              setActiveGlbId(targetGlb.id);
            } else {
              // Try design nodes first, then fall back to product_glb
              let foundGlb = false;
              for (const node of res.data) {
                const glbFile = node.drawing_files.find(f => isGlb(f.file_name));
                if (glbFile) {
                  setActiveGlbSrc(`${BASE_URL}${glbFile.url}`);
                  setActiveGlbId(glbFile.id);
                  foundGlb = true;
                  break;
                }
              }
              if (!foundGlb && res.product_glb) {
                setActiveGlbSrc(`${BASE_URL}${res.product_glb}`);
              }
            }

            // Auto-load first document: prefer target node's docs, then any node
            const targetDoc = [...target.drawing_files, ...target.kb_files].find(f => !isGlb(f.file_name));
            if (targetDoc) {
              setActiveDocSrc(`${BASE_URL}${targetDoc.url}`);
              setActiveDocName(targetDoc.file_name);
            } else {
              for (const node of res.data) {
                const docFile = [...node.drawing_files, ...node.kb_files].find(f => !isGlb(f.file_name));
                if (docFile) {
                  setActiveDocSrc(`${BASE_URL}${docFile.url}`);
                  setActiveDocName(docFile.file_name);
                  break;
                }
              }
            }
            return;
          }
        }

        // Auto-expand root assemblies (level 0)
        const roots = res.data.filter(n => n.parent_design_uuid === null);
        setExpanded(new Set(["product-root", ...roots.map(r => r.design_version_id || r.design_uuid)]));

        // Auto-load product GLB first, fall back to first design node GLB
        if (res.product_glb) {
          setActiveGlbSrc(`${BASE_URL}${res.product_glb}`);
          setActiveGlbId(null);
          setNavPath([]);
        } else {
          for (const node of res.data) {
            const glbFile = node.drawing_files.find(f => isGlb(f.file_name));
            if (glbFile) {
              setActiveGlbSrc(`${BASE_URL}${glbFile.url}`);
              setActiveGlbId(glbFile.id);
              setNavPath([node]);
              break;
            }
          }
        }

        // Auto-load first document file found (PDF, doc, image, etc.)
        for (const node of res.data) {
          const docFile = [...node.drawing_files, ...node.kb_files].find(f => !isGlb(f.file_name));
          if (docFile) {
            setActiveDocSrc(`${BASE_URL}${docFile.url}`);
            setActiveDocName(docFile.file_name);
            break;
          }
        }
      }
    }).finally(() => setLoadingTree(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProductId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "b") { e.preventDefault(); setSidebarCollapsed(v => !v); }
      if (e.key === "Escape") { setSearch(""); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const selectedProduct = products.find(p => p.id === selectedProductId);

  // Toggle node expand
  const toggleNode = useCallback((key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  // Toggle part selection for multi-select
  const togglePartSelect = useCallback((key: string) => {
    setSelectedParts(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  // Build selected parts data for ticket creation
  const selectedPartsData = useMemo(() => {
    return Array.from(selectedParts).map(key => {
      const node = treeNodes.find(n => (n.design_version_id || n.design_uuid) === key);
      return node ? { key, name: node.design_name, type: node.design_type } : null;
    }).filter(Boolean) as Array<{ key: string; name: string; type: string }>;
  }, [selectedParts, treeNodes]);

  const selectedPartNodes = useMemo(() => {
    return Array.from(selectedParts)
      .map(key => treeNodes.find(n => (n.design_version_id || n.design_uuid) === key))
      .filter((node): node is TroubleshootingDesignNode => !!node);
  }, [selectedParts, treeNodes]);

  // File click
  const handleFileClick = useCallback((item: TreeFileItem, ownerNode: TroubleshootingDesignNode | null) => {
    if (item.isGlb) {
      if (activeGlbSrc) setGlbHistory(h => [...h, { src: activeGlbSrc, id: activeGlbId ?? "" }]);
      setActiveGlbSrc(item.url);
      setActiveGlbId(item.id);
      if (ownerNode) setNavPath(prev => {
        const exists = prev.find(n => (n.design_version_id || n.design_uuid) === (ownerNode.design_version_id || ownerNode.design_uuid));
        return exists ? prev : [...prev, ownerNode];
      });
    } else {
      setActiveFaqNodeKey(null);
      setActiveDocSrc(item.url);
      setActiveDocName(item.name);
    }
  }, [activeGlbSrc, activeGlbId]);

  // FAQ click
  const handleFaqClick = useCallback((nodeKey: string) => {
    setActiveFaqNodeKey(prev => prev === nodeKey ? null : nodeKey);
    setActiveDocSrc(null);
    setActiveDocName(null);
  }, []);

  // GLB back
  const handleGlbBack = useCallback(() => {
    setGlbHistory(prev => {
      const next = [...prev];
      const last = next.pop() ?? null;
      setActiveGlbSrc(last?.src ?? null);
      setActiveGlbId(last?.id ?? null);
      setNavPath(p => p.slice(0, -1));
      return next;
    });
  }, []);

  // Active node for GLB
  const activeGlbNode = useMemo(() => {
    if (!activeGlbId) return null;
    return treeNodes.find(n => n.drawing_files.some(f => f.id === activeGlbId));
  }, [activeGlbId, treeNodes]);

  // Sync ?part= query param when the active node changes
  useEffect(() => {
    if (loadingTree) return;
    const newPart = activeGlbNode?.design_id ?? "";
    const currentPart = searchParams.get("part") ?? "";
    if (newPart === currentPart) return;

    const sp = new URLSearchParams(searchParams.toString());
    if (newPart) {
      sp.set("part", newPart);
    } else {
      sp.delete("part");
    }
    router.replace(`?${sp.toString()}`, { scroll: false });
  }, [activeGlbNode, searchParams, router, loadingTree]);

  // Hotspots: children of active GLB node that have GLBs (or top-level nodes if at product root)
  const hotspots = useMemo<DarkHotspot[]>(() => {
    let children: TroubleshootingDesignNode[] = [];
    if (!activeGlbNode) {
      // At Product Root
      children = treeNodes.filter(n => n.parent_design_uuid === null);
    } else {
      children = treeNodes.filter(
        n => n.parent_design_uuid === activeGlbNode.design_uuid &&
          n.parent_version_id === activeGlbNode.design_version_id,
      );
    }
    return children.reduce<DarkHotspot[]>((acc, child) => {
      const childGlb = child.drawing_files.find(f => isGlb(f.file_name));
      if (!childGlb) return acc;
      acc.push({
        id: child.design_version_id || child.design_uuid,
        label: child.design_name || child.design_id,
        description: child.design_type,
        color: DESIGN_COLORS[child.design_type] ?? "#6366f1",
        onActivate: () => {
          if (activeGlbSrc) setGlbHistory(h => [...h, { src: activeGlbSrc, id: activeGlbId ?? "" }]);
          setActiveGlbSrc(`${BASE_URL}${childGlb.url}`);
          setActiveGlbId(childGlb.id);
          setNavPath(prev => [...prev, child]);
          setExpanded(prev => {
            const next = new Set(prev);
            next.add(child.design_version_id || child.design_uuid);
            return next;
          });
          // Auto-add the navigated part to the selection
          setSelectedParts(prev => {
            const next = new Set(prev);
            next.add(child.design_version_id || child.design_uuid);
            return next;
          });
        },
      });
      return acc;
    }, []);
  }, [activeGlbNode, treeNodes, activeGlbSrc, activeGlbId]);

  const activeGlbNodeKey = activeGlbNode ? (activeGlbNode.design_version_id || activeGlbNode.design_uuid) : "";

  // When search is active, compute an expanded set that auto-expands ancestors of
  // every matching node so matches are always visible regardless of collapse state.
  const searchExpandedSet = useMemo<Set<string>>(() => {
    const q = search.trim();
    if (!q || !treeNodes.length) return expanded;

    // Collect keys of all matching nodes
    const matchKeys = new Set<string>();
    for (const node of treeNodes) {
      if (fuzzyAny([node.design_name, node.design_id, node.design_type], q)) {
        matchKeys.add(node.design_version_id || node.design_uuid);
      }
    }
    if (matchKeys.size === 0) return expanded;

    // Walk up the parent chain for every match, adding all ancestor keys
    const expandSet = new Set<string>(["product-root"]);
    for (const key of matchKeys) {
      expandSet.add(key);
      const startNode = treeNodes.find(n => (n.design_version_id || n.design_uuid) === key);
      let cur: TroubleshootingDesignNode | undefined = startNode;
      while (cur?.parent_design_uuid) {
        const parent = treeNodes.find(
          n => n.design_uuid === cur!.parent_design_uuid &&
            n.design_version_id === cur!.parent_version_id,
        );
        if (!parent) break;
        expandSet.add(parent.design_version_id || parent.design_uuid);
        cur = parent;
      }
    }
    return expandSet;
  }, [search, treeNodes, expanded]);

  // Flat tree list — when searching, use auto-expanded set and filter to only matching nodes
  const flatItems = useMemo<FlatItem[]>(() => {
    if (!treeNodes.length) return [];
    const effectiveExpanded = search.trim() ? searchExpandedSet : expanded;
    const all = buildFlatList(treeNodes, effectiveExpanded, activeGlbId, activeDocSrc ? "doc" : null, selectedProductId, selectedProduct?.product_name ?? "Product");
    if (!search.trim()) return all;
    return all.filter(item => {
      if (item.kind === "node") {
        if (item.isProductRoot) return true; // always show root
        return fuzzyAny([item.node.design_name, item.node.design_id, item.node.design_type], search);
      }
      if (item.kind === "file") return fuzzyAny([item.name], search);
      return false;
    });
  }, [treeNodes, expanded, searchExpandedSet, activeGlbId, activeDocSrc, selectedProductId, selectedProduct, search]);

  // Node lookup helper (for file click ownership)
  const nodeByKey = useCallback((key: string) => treeNodes.find(n => (n.design_version_id || n.design_uuid) === key), [treeNodes]);

  // FAQ items for active node
  const activeFaqItems = useMemo(() => {
    if (!activeFaqNodeKey) return null;
    if (activeFaqNodeKey === "product-root") return null;
    const node = nodeByKey(activeFaqNodeKey);
    return node?.faq_items ?? null;
  }, [activeFaqNodeKey, nodeByKey]);

  // Auto-scroll chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  // Reset chat when product changes
  useEffect(() => {
    setChatMessages([]);
    setChatStarted(false);
    setRightPanel("3d");
  }, [selectedProductId]);

  const startChat = () => {
    const product = products.find(p => p.id === selectedProductId);
    const faqs = activeGlbNode?.faq_items ?? [];
    setChatFaqIndex(0);
    setChatFinished(false);
    setChatNeedsTicket(false);
    setChatResolved(false);
    setChatWaitingForResolution(false);
    const intro = `Self  Troubleshoot AI assistant for ${product?.product_name ?? "this product"}${activeGlbNode ? ` / ${activeGlbNode.design_name}` : ""}.`;
    const first = faqs[0]
      ? `${intro}\n\n${stripHtml(faqs[0].question)}`
      : `${intro}\n\nThere are no guided checks for this component. Raise a ticket?`;
    setChatFinished(faqs.length === 0);
    setChatNeedsTicket(faqs.length === 0);
    setChatMessages([{ role: "assistant", text: first, id: "welcome" }]);
    setChatStarted(true);
  };

  const askNextChatQuestion = async (nextIndex: number, prefix: string) => {
    const faqs = activeGlbNode?.faq_items ?? [];
    if (nextIndex >= faqs.length) {
      setChatFinished(true);
      setChatMessages(prev => [...prev, {
        role: "assistant",
        text: `${prefix}\n\nWe have explored all guided checks. Is your issue resolved?`,
        id: `done-${Date.now()}`,
      }]);
      return;
    }
    setChatLoading(true);
    await new Promise(resolve => setTimeout(resolve, 350));
    setChatFaqIndex(nextIndex);
    setChatMessages(prev => [...prev, {
      role: "assistant",
      text: `${prefix}\n\n${stripHtml(faqs[nextIndex].question)}`,
      id: `q-${nextIndex}-${Date.now()}`,
    }]);
    setChatLoading(false);
  };

  const handleChatResponse = async (response: "Yes" | "No") => {
    if (chatLoading || chatResolved) return;
    const faqs = activeGlbNode?.faq_items ?? [];
    setChatMessages(prev => [...prev, { role: "user", text: response, id: `u-${Date.now()}` }]);
    if (chatNeedsTicket) {
      if (response === "Yes") setAddTicketOpen(true);
      return;
    }
    if (chatFinished) {
      if (response === "Yes") {
        setChatResolved(true);
        setChatMessages(prev => [...prev, { role: "assistant", text: "Issue marked resolved.", id: `resolved-${Date.now()}` }]);
      } else {
        setChatNeedsTicket(true);
        setChatMessages(prev => [...prev, { role: "assistant", text: "Raise a ticket so the selected faulty components and context can be reviewed.", id: `ticket-${Date.now()}` }]);
      }
      return;
    }
    if (chatWaitingForResolution) {
      setChatWaitingForResolution(false);
      if (response === "Yes") {
        setChatResolved(true);
        setChatMessages(prev => [...prev, { role: "assistant", text: "Issue marked resolved.", id: `resolved-${Date.now()}` }]);
      } else {
        await askNextChatQuestion(chatFaqIndex + 1, "Okay, checking the next likely cause.");
      }
      return;
    }
    if (response === "Yes") {
      setChatLoading(true);
      await new Promise(resolve => setTimeout(resolve, 350));
      const answer = stripHtml(faqs[chatFaqIndex]?.answer ?? "Follow the documented inspection step for this component.");
      setChatMessages(prev => [...prev, { role: "assistant", text: `${answer}\n\nDid this resolve the issue?`, id: `a-${Date.now()}` }]);
      setChatWaitingForResolution(true);
      setChatLoading(false);
    } else {
      await askNextChatQuestion(chatFaqIndex + 1, "It does not seem to be this problem.");
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#06070a] flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-violet-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className={`${isFullView ? "fixed inset-0 z-50" : "h-screen"} flex flex-col overflow-hidden bg-slate-50 dark:bg-[#06070a] text-slate-900 dark:text-white`}>

      {/* ─── Header (hidden in full-view mode) ─────────────────────── */}
      {!isFullView && (
        <PageHeader
          breadcrumbs={[
            { label: "Dashboard", href: "/" },
            { label: "Diagnostics", href: "/diagnostics" },
            { label: "Troubleshooting" },
          ]}
          backHref="/"
          icon={<BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
          iconClassName="bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20"
          title="Troubleshooting"
          subtitle="Navigate product components and documentation"
          right={
            <button
              type="button"
              disabled={!selectedProductId}
              onClick={() => {
                const qs = new URLSearchParams({ productId: selectedProductId, full: "1" });
                if (activeGlbNode?.design_id) qs.set("part", activeGlbNode.design_id);
                const ctxClientId = selectedOrderCtx?.client_id ?? queryClientId;
                const ctxOrderId = selectedOrderCtx?.id ?? queryOrderId;
                if (ctxClientId) qs.set("clientId", ctxClientId);
                if (ctxOrderId) qs.set("orderId", ctxOrderId);
                const pRef = encodeURIComponent(orderRef || "VIEW");
                const pName = encodeURIComponent(products.find(p => p.id === selectedProductId)?.product_name || "PRODUCT");
                window.open(`/diagnostics/troubleshooting/${pRef}/${pName}?${qs.toString()}`, "_blank");
              }}
              className="flex items-center gap-1.5 rounded border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-600 dark:text-white/45 transition hover:border-violet-500/30 hover:text-slate-900 dark:text-white disabled:opacity-30"
            >
              <ExternalLink className="h-3 w-3" />
              Full View
            </button>
          }
        />
      )}

      {/* ─── Secondary nav bar: order context + tree path + raise ticket ── */}
      {(isFullView || orderRef || navPath.length > 0 || selectedParts.size > 0) && (
        <div className="h-9 shrink-0 border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-[#090b10] flex items-center px-4 gap-2 overflow-x-auto">
          {/* Go Back button in full-view mode */}
          {isFullView && (
            <button
              onClick={() => router.push("/diagnostics/troubleshooting")}
              className="shrink-0 flex items-center gap-1.5 text-slate-600 dark:text-white/50 hover:text-slate-900 dark:text-white text-[11px] font-mono transition px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-white/5"
            >
              <ArrowLeft className="h-3 w-3" />
              Go Back
            </button>
          )}
          {isFullView && (orderRef || navPath.length > 0) && (
            <span className="text-slate-300 dark:text-white/10 shrink-0">|</span>
          )}
          {orderRef && orderRef !== "VIEW" && (
            <>
              <span className="shrink-0 text-[10px] font-mono text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 px-2 py-0.5 rounded uppercase">
                Order: {orderRef}
              </span>
              {navPath.length > 0 && <span className="text-slate-300 dark:text-white/10 shrink-0">|</span>}
            </>
          )}
          {navPath.map((node, i) => {
            const isCurrent = i === navPath.length - 1;
            return (
              <React.Fragment key={i}>
                {i > 0 && <ChevronRight className="h-3 w-3 text-slate-300 dark:text-white/15 shrink-0" />}
                <span
                  className={`shrink-0 text-[11px] font-mono px-2 py-0.5 rounded transition ${isCurrent
                    ? "bg-slate-100 dark:bg-white/8 text-slate-600 dark:text-white/70 cursor-default"
                    : "text-slate-500 dark:text-white/40 hover:text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
                  }`}
                  onClick={() => { if (!isCurrent) setNavPath(p => p.slice(0, i + 1)); }}
                >
                  {node.design_name}
                  {node.design_type && <span className="text-slate-400 dark:text-white/25 ml-1">({node.design_type})</span>}
                </span>
              </React.Fragment>
            );
          })}
          {selectedParts.size > 0 && (
            <div className="ml-auto flex items-center gap-1.5 bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/25 rounded px-2 py-1 shrink-0">
              <span className="text-[10px] font-mono text-violet-600 dark:text-violet-300">{selectedParts.size} part{selectedParts.size > 1 ? "s" : ""}</span>
              <button onClick={() => setSelectedParts(new Set())} className="text-violet-400/50 hover:text-violet-500 dark:hover:text-violet-300 transition" title="Clear">
                <X className="h-3 w-3" />
              </button>
              <button
                onClick={() => setAddTicketOpen(true)}
                className="flex items-center gap-1 bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-mono font-semibold px-2 py-0.5 rounded transition"
              >
                <Ticket className="h-3 w-3" />
                Raise Ticket
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── Body ───────────────────────────────────────────────────── */}
      {!hasContext ? (
        /* No-context empty state */
        <div className="flex flex-1 items-center justify-center bg-slate-50 dark:bg-[#06070a]">
          <div className="flex flex-col items-center gap-4 text-center p-8 max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/8 flex items-center justify-center">
              <Layers className="w-7 h-7 text-slate-600 dark:text-white/20" />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-mono font-semibold text-slate-600 dark:text-white/50">No context selected</p>
              <p className="text-xs font-mono text-slate-600 dark:text-white/25 leading-relaxed">
                Open troubleshooting from an order or product to start a session.
                Both an order and a product must be set before the workspace loads.
              </p>
            </div>
            <div className="flex items-center gap-3 mt-2">
              {!hasOrderCtx && (
                <span className="flex items-center gap-1.5 text-[10px] font-mono text-amber-400/70 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded">
                  <ClipboardList className="h-3 w-3" />
                  Order missing
                </span>
              )}
              {!hasProductCtx && (
                <span className="flex items-center gap-1.5 text-[10px] font-mono text-violet-400/70 bg-violet-500/10 border border-violet-500/20 px-3 py-1.5 rounded">
                  <Package className="h-3 w-3" />
                  Product missing
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* ── LEFT SIDEBAR ── */}
          <aside
            className={`shrink-0 flex flex-col border-r border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-[#090b10] transition-[width] duration-200 overflow-hidden ${sidebarCollapsed ? "w-0" : "w-[300px]"
              }`}
          >
            {/* Sidebar header — always-visible fuzzy search */}
            <div className="px-2 py-1.5 border-b border-slate-200 dark:border-white/5 shrink-0 space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[9px] font-mono text-slate-600 dark:text-white/25 uppercase tracking-widest truncate">
                  {selectedProduct?.product_name ?? "Assembly Structure"}
                </span>
                <button
                  onClick={() => setExpanded(new Set())}
                  title="Collapse all"
                  className="p-1 rounded hover:bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/25 hover:text-slate-600 dark:text-white/55 text-[9px] font-mono"
                >
                  ⊟
                </button>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-600 dark:text-white/25" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search parts"
                  className="w-full bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/8 rounded text-[10px] font-mono text-slate-900 dark:text-white placeholder-white/20 pl-7 pr-6 py-1.5 focus:outline-none focus:border-slate-200 dark:border-white/20"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 dark:text-white/25 hover:text-slate-600 dark:text-white/60"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              {search.trim() && (
                <p className="text-[9px] font-mono text-slate-600 dark:text-white/20 px-1">
                  {flatItems.filter(i => i.kind === "node" && !i.isProductRoot).length} match
                  {flatItems.filter(i => i.kind === "node" && !i.isProductRoot).length !== 1 ? "es" : ""}
                </p>
              )}
            </div>

            {/* Tree */}
            <div className="flex-1 overflow-y-auto py-0.5 pb-0">
              {loadingTree ? (
                <div className="flex items-center justify-center gap-2 py-12 text-slate-600 dark:text-white/30">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs font-mono">Loading tree…</span>
                </div>
              ) : treeNodes.length === 0 && !loadingTree ? (
                <div className="text-center py-12 px-4">
                  <Package className="h-7 w-7 text-slate-600 dark:text-white/10 mx-auto mb-2" />
                  <p className="text-xs font-mono text-slate-600 dark:text-white/30">No assembly data for this product</p>
                </div>
              ) : flatItems.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <p className="text-xs font-mono text-slate-600 dark:text-white/30">No results for &ldquo;{search.trim()}&rdquo;</p>
                </div>
              ) : (
                flatItems.map((item, idx) => {
                  if (item.kind === "node") {
                    const color = NODE_COLORS[item.node.design_type] ?? DEFAULT_NC;
                    const isActive = navPath.some(n => (n.design_version_id || n.design_uuid) === item.key) && !item.isProductRoot;
                    const hasChildren = item.isProductRoot
                      ? true
                      : treeNodes.some(n => n.parent_design_uuid === item.node.design_uuid) ||
                      item.node.drawing_files.length > 0 || item.node.kb_files.length > 0 || item.node.faq_items.length > 0;

                    const isSelectable = !item.isProductRoot;
                    const isPartSelected = selectedParts.has(item.key);
                    return (
                      <div
                        key={`${item.key}-${idx}`}
                        className={`relative flex items-center gap-1.5 py-1.5 transition-colors select-none text-xs font-mono ${isPartSelected ? "bg-violet-500/10 border-l-2 border-violet-500" :
                            isActive ? `${color.badgeBg} border-l-2 ${item.kind === "node" ? "border-" + (color.icon.split("-")[1]) + "-500" : ""}` : color.row
                          }`}
                        style={{ paddingLeft: 8 + item.depth * 14, paddingRight: 8 }}
                      >
                        <Connector depth={item.depth} isLast={item.isLastChild} />
                        {/* Expand toggle */}
                        <button
                          className="shrink-0 flex items-center justify-center"
                          onClick={() => { if (hasChildren) toggleNode(item.key); }}
                        >
                          {hasChildren ? (
                            item.isExpanded
                              ? <ChevronDown className="h-3 w-3 text-slate-600 dark:text-white/25" />
                              : <ChevronRight className="h-3 w-3 text-slate-600 dark:text-white/25" />
                          ) : (
                            <span className="h-3 w-3 flex items-center justify-center">
                              <span className="w-1 h-1 rounded-full bg-slate-100 dark:bg-white/20" />
                            </span>
                          )}
                        </button>
                        {/* Folder/Box icon + name (click expands) */}
                        <button
                          className={`flex-1 flex items-center gap-1.5 text-left cursor-pointer min-w-0`}
                          onClick={() => { if (hasChildren) toggleNode(item.key); }}
                        >
                          {(item.node.design_type === "Product" || item.node.design_type === "Mother Assembly" || item.node.design_type === "Child Assembly" || item.isProductRoot)
                            ? <Folder className={`h-3 w-3 shrink-0 ${color.icon}`} />
                            : <Box className={`h-3 w-3 shrink-0 ${color.icon}`} />
                          }
                          <span className={`flex-1 truncate ${isPartSelected ? "text-violet-300 font-semibold" : isActive ? "text-slate-900 dark:text-white font-semibold" : "text-slate-600 dark:text-white/65"}`}>
                            {item.node.design_name || item.node.design_id}
                          </span>
                        </button>
                        {!item.isProductRoot && (
                          <span className={`shrink-0 text-[8px] font-semibold tracking-wide opacity-50 ${color.badge}`}>
                            {item.node.design_type.replace("Assembly", "Asm")}
                          </span>
                        )}
                        {/* Remove button — only shown when part is selected (parts auto-added via hotspot) */}
                        {isSelectable && isPartSelected && (
                          <button
                            onClick={e => { e.stopPropagation(); togglePartSelect(item.key); }}
                            className="shrink-0 ml-1 text-rose-400/70 hover:text-rose-500 transition"
                            title="Remove part from selection"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    );
                  }

                  if (item.kind === "faq") {
                    const isActive = activeFaqNodeKey === item.nodeKey;
                    return (
                      <button
                        key={`faq-${item.nodeKey}-${idx}`}
                        className={`relative w-full flex items-center gap-1.5 py-1.5 text-left transition-colors text-xs font-mono ${isActive ? "bg-amber-500/15 text-amber-300" : "text-amber-400/60 hover:text-amber-400 hover:bg-slate-100 dark:bg-white/5"
                          }`}
                        style={{ paddingLeft: 8 + item.depth * 14, paddingRight: 8 }}
                        onClick={() => handleFaqClick(item.nodeKey)}
                      >
                        <Connector depth={item.depth} isLast={item.isLastChild} />
                        <span className="h-3 w-3 shrink-0 flex items-center justify-center">
                          <span className="w-1 h-1 rounded-full bg-amber-500/40" />
                        </span>
                        <HelpCircle className="h-3 w-3 shrink-0 text-amber-400" />
                        <span className="flex-1 truncate">
                          Common FAQs ({item.count})
                        </span>
                      </button>
                    );
                  }

                  // File
                  const { Icon, cls } = fileIcon(item.name);
                  const isActiveDoc = activeDocSrc === item.url;
                  const isActiveGlb = activeGlbId === item.id;
                  const isActive = isActiveDoc || isActiveGlb;
                  const owner = treeNodes.find(n =>
                    n.drawing_files.some(f => f.id === item.id) ||
                    n.kb_files.some(f => f.id === item.id)
                  );
                  return (
                    <button
                      key={`file-${item.id}-${idx}`}
                      className={`relative w-full flex items-center gap-1.5 py-1 text-left transition-colors text-xs font-mono ${isActive
                          ? item.isGlb ? "bg-indigo-500/15 text-indigo-300" : "bg-blue-500/15 text-blue-300"
                          : "text-slate-600 dark:text-white/45 hover:text-slate-600 dark:text-white/80 hover:bg-slate-100 dark:bg-white/5"
                        }`}
                      style={{ paddingLeft: 8 + item.depth * 14, paddingRight: 8 }}
                      onClick={() => handleFileClick(item, owner ?? null)}
                    >
                      <Connector depth={item.depth} isLast={item.isLastChild} />
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={e => {
                          e.stopPropagation();
                          if (owner) togglePartSelect(owner.design_version_id || owner.design_uuid);
                        }}
                        onKeyDown={e => {
                          if ((e.key === "Enter" || e.key === " ") && owner) {
                            e.preventDefault();
                            e.stopPropagation();
                            togglePartSelect(owner.design_version_id || owner.design_uuid);
                          }
                        }}
                        className={`h-3 w-3 shrink-0 flex items-center justify-center rounded-full ${owner && selectedParts.has(owner.design_version_id || owner.design_uuid)
                            ? "bg-violet-500/30 text-violet-200"
                            : "hover:bg-slate-100 dark:bg-white/10"
                          }`}
                        title={owner ? "Add this component to ticket" : undefined}
                      >
                        <span className="w-1 h-1 rounded-full bg-current opacity-60" />
                      </span>
                      <Icon className={`h-3 w-3 shrink-0 ${isActive ? (item.isGlb ? "text-indigo-400" : "text-blue-400") : cls}`} />
                      <span className="flex-1 truncate text-[10px]">{item.name}</span>
                      {item.isGlb && (
                        <span className="shrink-0 text-[8px] font-mono opacity-50 uppercase tracking-wide">3D</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* Sidebar toggle tab */}
          <div className="relative shrink-0">
            <button
              onClick={() => setSidebarCollapsed(v => !v)}
              title={sidebarCollapsed ? "Expand (Ctrl+B)" : "Collapse (Ctrl+B)"}
              className="absolute top-1/2 -translate-y-1/2 z-20 w-4 h-10 bg-slate-50 dark:bg-[#090b10] border border-slate-200 dark:border-white/5 border-l-0 rounded-r flex items-center justify-center cursor-pointer hover:bg-slate-100 dark:bg-white/5 transition"
            >
              {sidebarCollapsed
                ? <ChevronRight className="h-3 w-3 text-slate-600 dark:text-white/30" />
                : <ChevronLeft className="h-3 w-3 text-slate-600 dark:text-white/30" />}
            </button>
          </div>

          {/* ── CENTER AND RIGHT PANELS ── */}
          <Group orientation="horizontal" className="flex-1 min-w-0 flex overflow-hidden">
            {/* ── CENTER: DOC VIEWER ── */}
            <Panel defaultSize={50} minSize={25} className="flex flex-col border-r border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-[#06070a] overflow-hidden">
              {/* Doc panel header */}
              <div className="h-9 shrink-0 border-b border-slate-200 dark:border-white/5 flex items-center px-3 gap-2 bg-slate-50 dark:bg-[#090b10]">
                <FileText className="h-3.5 w-3.5 text-slate-600 dark:text-white/20" />
                <span className="text-[10px] font-mono text-slate-600 dark:text-white/30 uppercase tracking-widest truncate flex-1">
                  {activeFaqItems ? "FAQs" : activeDocName ?? "Document Viewer"}
                </span>
                {activeDocSrc && (
                  <a href={activeDocSrc} target="_blank" rel="noreferrer" className="text-[10px] font-mono text-blue-400 hover:text-blue-300 uppercase tracking-wide shrink-0">Open ↗</a>
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                <DocViewer src={activeDocSrc} fileName={activeDocName} faqItems={activeFaqItems} />
              </div>
            </Panel>

            <Separator className="w-1.5 hover:bg-violet-500/50 active:bg-violet-500/80 cursor-col-resize shrink-0 transition-colors z-10 -mx-0.5" />

            {/* ── RIGHT: 3D GLB VIEWER / AI CHAT ── */}
            <Panel defaultSize={50} minSize={25} className="flex flex-col bg-slate-50 dark:bg-[#06070a] overflow-hidden">
              {/* Panel header with tabs */}
              <div className="h-9 shrink-0 border-b border-slate-200 dark:border-white/5 flex items-center bg-slate-50 dark:bg-[#090b10]">
                <button
                  onClick={() => setRightPanel("3d")}
                  className={`h-full px-3 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest border-r border-slate-200 dark:border-white/5 transition ${rightPanel === "3d" ? "text-slate-900 dark:text-white bg-slate-100 dark:bg-white/5" : "text-slate-600 dark:text-white/30 hover:text-slate-600 dark:text-white/60"
                    }`}
                >
                  <Box className="h-3 w-3" />
                  {activeGlbNode ? activeGlbNode.design_name.slice(0, 20) : "3D Viewer"}
                </button>
                <button
                  onClick={() => { setRightPanel("chat"); if (!chatStarted) startChat(); }}
                  className={`h-full px-3 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest transition ${rightPanel === "chat" ? "text-violet-400 bg-violet-500/10" : "text-slate-600 dark:text-white/30 hover:text-slate-600 dark:text-white/60"
                    }`}
                >
                  <MessageCircle className="h-3 w-3" />
                  AI Troubleshoot
                </button>
                {rightPanel === "3d" && hotspots.length > 0 && (
                  <span className="ml-auto px-3 text-[9px] font-mono text-violet-400/60">{hotspots.length} sub-parts</span>
                )}
              </div>

              {/* 3D viewer */}
              {rightPanel === "3d" && (
                <div className="flex-1 min-h-0">
                  <GlbViewerDark
                    src={activeGlbSrc}
                    hotspots={hotspots}
                    canGoBack={glbHistory.length > 0}
                    onBack={handleGlbBack}
                    onAddActive={!!activeGlbNodeKey && selectedParts.has(activeGlbNodeKey) ? () => togglePartSelect(activeGlbNodeKey) : undefined}
                    isActiveAdded={true}
                  />
                </div>
              )}

              {/* AI Chat */}
              {rightPanel === "chat" && (
                <div className="flex-1 min-h-0 flex flex-col">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#08090e]">
                  {chatMessages.length === 0 && (
                    <div className="text-center text-slate-600 dark:text-white/20 text-xs font-mono mt-12">Starting session…</div>
                  )}
                  {chatMessages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] px-4 py-2.5 text-xs font-mono leading-relaxed rounded-2xl whitespace-pre-line ${msg.role === "user"
                          ? "bg-violet-600 text-slate-900 dark:text-white rounded-br-sm"
                          : "bg-slate-100 dark:bg-white/8 text-slate-600 dark:text-white/70 border border-slate-200 dark:border-white/8 rounded-bl-sm"
                        }`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-slate-100 dark:bg-white/8 border border-slate-200 dark:border-white/8 px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-100 dark:bg-white/30 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-100 dark:bg-white/30 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-100 dark:bg-white/30 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Raise ticket bar */}
                <div className="px-4 py-2 border-t border-slate-200 dark:border-white/5 flex items-center justify-between bg-slate-50 dark:bg-[#090b10]">
                  <span className="text-[9px] font-mono text-slate-600 dark:text-white/20">
                    AI · {products.find(p => p.id === selectedProductId)?.product_name ?? "Product"}
                  </span>
                  <button
                    onClick={() => setAddTicketOpen(true)}
                    className="flex items-center gap-1.5 text-[10px] font-mono text-amber-400 hover:text-amber-300 transition"
                  >
                    <Ticket className="h-3 w-3" />
                    Raise Ticket
                  </button>
                </div>

                {/* Yes / No input */}
                <div className="border-t border-slate-200 dark:border-white/5 px-3 py-2.5 flex items-center justify-end gap-2 bg-slate-50 dark:bg-[#090b10]">
                  {chatNeedsTicket ? (
                    <button
                      onClick={() => setAddTicketOpen(true)}
                      className="rounded bg-amber-500 px-3 py-2 text-xs font-mono font-semibold text-black transition hover:bg-amber-400"
                    >
                      Raise Ticket
                    </button>
                  ) : chatResolved ? (
                    <span className="text-xs font-mono text-emerald-300">Resolved</span>
                  ) : (
                    <>
                      <button onClick={() => handleChatResponse("No")} disabled={chatLoading} className="rounded border border-slate-200 dark:border-white/10 px-4 py-2 text-xs font-mono text-slate-600 dark:text-white/55 transition hover:bg-slate-100 dark:bg-white/5 disabled:opacity-40">No</button>
                      <button onClick={() => handleChatResponse("Yes")} disabled={chatLoading} className="rounded bg-violet-600 px-4 py-2 text-xs font-mono font-semibold text-slate-900 dark:text-white transition hover:bg-violet-500 disabled:opacity-40">Yes</button>
                    </>
                  )}
                </div>
              </div>
            )}
            </Panel>
          </Group>

        </div>
      )} {/* end hasContext */}

      <AddTicketDrawer
        isOpen={addTicketOpen}
        onClose={() => setAddTicketOpen(false)}
        onCreated={() => setAddTicketOpen(false)}
        initialClientId={selectedOrderCtx?.client_id ?? queryClientId}
        initialOrderId={selectedOrderCtx?.id ?? queryOrderId ?? orderRef}
        initialProductId={selectedProductId}
        initialOrderLabel={selectedOrderCtx?.order_id ?? orderRef ?? undefined}
        initialProductLabel={selectedProduct?.product_name ?? undefined}
        selectedPartNodes={selectedPartNodes}
      />
    </div>
  );
}
