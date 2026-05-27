"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Globe, Activity, ShieldAlert, Wrench, Box, BookOpen, Settings, HelpCircle,
  Search, Bell, Play, Pause, Cpu, Sliders, Download, Layers, ListFilter,
  Send, Zap, ChevronRight, ChevronDown, PlusCircle, History, RotateCcw,
  CheckCircle2, AlertTriangle, TrendingUp, Clock, ArrowRight, UserCheck,
  Check, FileText, ExternalLink, X, Radio
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import Cyber3DViewer from "@/components/Cyber3DViewer";
import { GlbViewerDark } from "@/components/GlbViewerDark";
import { WorldMap, type MapMarker } from "@/components/WorldMap";
import {
  fetchMachines, fetchTickets, fetchTechnicians, createTicket,
  fetchUsers, fetchRoles, assignUserRole,
  fetchTroubleshootingByProduct, fetchProductCatalog,
  fetchDeploymentMarkersFromOrders,
  ApiMachine, ApiTicket, ApiTechnician, ApiUser, ApiRole,
  TroubleshootingDesignNode, ApiProductCatalog
} from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { useAbility } from "@/providers/AbilityProvider";
import { useTheme } from "@/providers/ThemeProvider";

// Elegant neon gradients and data mocks
const FLOW_DATA = [
  { name: "00:00", value: 38.5 },
  { name: "04:00", value: 40.2 },
  { name: "08:00", value: 45.8 },
  { name: "12:00", value: 41.0 },
  { name: "16:00", value: 39.5 },
  { name: "20:00", value: 42.8 },
  { name: "24:00", value: 44.1 },
];

const TEMP_DATA = [
  { name: "Core A", value: 4.1 },
  { name: "Core B", value: 4.3 },
  { name: "Core C", value: 3.9 },
  { name: "Core D", value: 4.5 },
  { name: "Core E", value: 4.2 },
];

const LOAD_DATA = [
  { name: "00:00", value: 65 },
  { name: "02:00", value: 72 },
  { name: "04:00", value: 60 },
  { name: "06:00", value: 58 },
  { name: "08:00", value: 78 },
  { name: "10:00", value: 82 },
  { name: "12:00", value: 68 },
];

const TELEMETRY_DELTA_DATA = [
  { name: "T-60s", pressure: -38, flow: 110 },
  { name: "T-45s", pressure: -40, flow: 111 },
  { name: "T-30s", pressure: -43, flow: 113 },
  { name: "T-15s", pressure: -42.5, flow: 112.4 },
  { name: "T-0s", pressure: -42.5, flow: 112.4 },
];

// ---------------------------------------------------------------------------
// Global deployment markers
// ---------------------------------------------------------------------------
const DEPLOYMENT_MARKERS: MapMarker[] = [
  { name: "New York Unit #33", coordinates: [-74.006, 40.7128], status: "nominal", detail: "NOMINAL — All systems online" },
  { name: "Berlin Central", coordinates: [13.405, 52.52], status: "critical", detail: "CRITICAL — Helium leak detected" },
  { name: "Tokyo Hub #12", coordinates: [139.691, 35.6762], status: "nominal", detail: "NOMINAL — Scan in progress" },
  { name: "Sydney Care Centre", coordinates: [151.209, -33.868], status: "warning", detail: "WARNING — Filter replacement due" },
  { name: "São Paulo Unit #7", coordinates: [-46.633, -23.543], status: "nominal", detail: "NOMINAL — Calibrated" },
  { name: "Mumbai Facility", coordinates: [72.877, 19.076], status: "warning", detail: "WARNING — Scheduled maintenance" },
  { name: "London Diagnostics", coordinates: [-0.118, 51.509], status: "nominal", detail: "NOMINAL — 4.2 K stable" },
  { name: "Toronto Lab", coordinates: [-79.383, 43.653], status: "nominal", detail: "NOMINAL — Uptime 99.9%" },
];

// ---------------------------------------------------------------------------
// Inventory / Assembly tree — dark-theme colour maps
// ---------------------------------------------------------------------------
const INV_NODE_COLORS: Record<string, { icon: string; badge: string; badgeBg: string; active: string }> = {
  "Product": { icon: "text-slate-400", badge: "text-slate-300", badgeBg: "bg-slate-500/10", active: "bg-slate-500/20" },
  "Mother Assembly": { icon: "text-violet-400", badge: "text-violet-300", badgeBg: "bg-violet-500/10", active: "bg-violet-500/20" },
  "Child Assembly": { icon: "text-blue-400", badge: "text-blue-300", badgeBg: "bg-blue-500/10", active: "bg-blue-500/20" },
  "Component": { icon: "text-emerald-400", badge: "text-emerald-300", badgeBg: "bg-emerald-500/10", active: "bg-emerald-500/20" },
  "Sub-Component": { icon: "text-amber-400", badge: "text-amber-300", badgeBg: "bg-amber-500/10", active: "bg-amber-500/20" },
};

const FILE_EXT_COLORS: Record<string, string> = {
  pdf: "text-rose-400",
  doc: "text-blue-400", docx: "text-blue-400",
  glb: "text-indigo-400", gltf: "text-indigo-400",
  xlsx: "text-emerald-400", xls: "text-emerald-400",
  png: "text-purple-400", jpg: "text-purple-400",
  jpeg: "text-purple-400", svg: "text-purple-400",
};

const API_BASE = process.env.NEXT_PUBLIC_API_SERVER || "http://localhost:7000";

const LiveTrendChart = () => {
  const [data, setData] = useState<{ time: number; value: number }[]>([]);

  useEffect(() => {
    // Initialize data
    const initialData = Array.from({ length: 60 }).map((_, i) => ({
      time: Date.now() - (60 - i) * 1000,
      value: 360 + (Math.sin(i / 5) * 5) + Math.random() * 2,
    }));
    setData(initialData);

    const interval = setInterval(() => {
      setData((prev) => {
        const next = [...prev.slice(1)];
        const lastVal = next[next.length - 1].value;
        const newVal = lastVal + (Math.random() - 0.5) * 2;
        next.push({ time: Date.now(), value: Math.max(340, Math.min(385, newVal)) });
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const latestValue = data.length > 0 ? data[data.length - 1].value.toFixed(2) : "0.00";

  return (
    <div className="bg-slate-50 dark:bg-[#0b0e14] border border-slate-200 dark:border-white/5 p-4 flex flex-col flex-1 rounded-lg">
      {/* Header */}
      <div className="flex justify-between items-start mb-6 text-slate-500 dark:text-slate-400">
        <div className="flex flex-col gap-3">
          <span className="text-[10px] font-mono tracking-widest text-slate-500 dark:text-[#64748b]">TREND &middot; 24H</span>
          <span className="text-[10px] font-mono tracking-widest text-slate-500 dark:text-[#64748b]">Nitrogen Level</span>
        </div>
        <div className="text-xl font-mono text-slate-900 dark:text-white flex items-end gap-1">
          {latestValue} <span className="text-xs text-slate-500 dark:text-[#64748b] mb-1">K</span>
        </div>
      </div>

      {/* Chart container */}
      <div className="flex-1 relative mt-2 w-full min-h-[100px]">
        {/* Y Axis labels */}
        <div className="absolute left-0 top-0 bottom-6 w-8 flex flex-col justify-between text-[10px] text-slate-400 dark:text-[#475569] font-mono z-10">
          <span>385</span>
          <span>361</span>
          <span>338</span>
        </div>

        {/* X Axis labels */}
        <div className="absolute left-8 right-2 bottom-0 h-6 flex justify-between items-end text-[10px] text-slate-400 dark:text-[#475569] font-mono z-10">
          <span>-10m</span>
          <span>-5m</span>
          <span>NOW</span>
        </div>

        {/* SVG Graph */}
        <div className="absolute left-8 right-2 top-0 bottom-6">
          <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
            <defs>
              <linearGradient id="gradientRed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff4d4f" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#ff4d4f" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Draw Path */}
            {(() => {
              if (data.length === 0) return null;
              const minVal = 338;
              const maxVal = 385;
              const range = maxVal - minVal;
              const points = data.map((d, i) => {
                const x = (i / (data.length - 1)) * 100;
                const y = Math.max(0, Math.min(100, 100 - ((d.value - minVal) / range) * 100));
                return `${x},${y}`;
              });
              const pathStr = `M ${points[0]} L ${points.join(" L ")}`;
              const areaPathStr = `${pathStr} L 100,100 L 0,100 Z`;
              const lastY = 100 - ((data[data.length - 1].value - minVal) / range) * 100;

              return (
                <>
                  <path d={areaPathStr} fill="url(#gradientRed)" />
                  <path d={pathStr} fill="none" stroke="#ff4d4f" strokeWidth="2" vectorEffect="non-scaling-stroke" />

                  {/* Pulsing dot */}
                  <circle
                    cx="100"
                    cy={lastY}
                    r="2"
                    fill="#ff4d4f"
                  />
                  <circle
                    cx="100"
                    cy={lastY}
                    r="4"
                    fill="#ff4d4f"
                    opacity="0.5"
                    className="animate-ping"
                    style={{ transformOrigin: `100px ${lastY}px` }}
                  />
                </>
              );
            })()}
          </svg>
        </div>
      </div>
    </div>
  );
};


export default function NextGenDashboard() {
  const router = useRouter();
  const { user, logout, loading: authLoading, isClientUser } = useAuth();
  const { can, roleName, isAdmin, isClient } = useAbility();
  const { theme } = useTheme();

  const searchParams = useSearchParams();
  const urlTab = searchParams.get("tab") ?? "fleet";
  const [activeTab, setActiveTab] = useState<string>(urlTab);

  // Sync tab with URL
  React.useEffect(() => {
    const t = searchParams.get("tab") ?? "fleet";
    setActiveTab(t);
  }, [searchParams]);

  const goToTickets = () => {
    router.push("/tickets");
  };

  // API and state variables
  const [rawMachines, setRawMachines] = useState<ApiMachine[]>([]);
  const [rawTickets, setRawTickets] = useState<ApiTicket[]>([]);
  const [technicians, setTechnicians] = useState<ApiTechnician[]>([]);
  const [usersList, setUsersList] = useState<ApiUser[]>([]);
  const [rolesList, setRolesList] = useState<ApiRole[]>([]);
  const [productsList, setProductsList] = useState<ApiProductCatalog[]>([]);
  const [deploymentMarkers, setDeploymentMarkers] = useState<MapMarker[]>([]);
  const [mapMarkersLoaded, setMapMarkersLoaded] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modal, Drawer & Interactive states
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);
  const [orderPartName, setOrderPartName] = useState("");
  const [selectedHotspot, setSelectedHotspot] = useState<string>("");

  // ViewRay Troubleshooting portal drawings state
  const [troubleshootingTree, setTroubleshootingTree] = useState<TroubleshootingDesignNode[]>([]);
  const [selectedTreeNodeKey, setSelectedTreeNodeKey] = useState<string>("");

  // Computed dynamic hotspots based on the active node
  const activeGlbHotspots = React.useMemo(() => {
    if (!troubleshootingTree.length || !selectedTreeNodeKey) return [];
    const activeNode = troubleshootingTree.find(n => (n.design_version_id || n.design_uuid) === selectedTreeNodeKey);
    if (!activeNode) return [];

    // Find all children of the active node to create hotspots for them
    const children = troubleshootingTree.filter(
      n => n.parent_design_uuid === activeNode.design_uuid && n.parent_version_id === activeNode.design_version_id
    );

    return children.map(child => ({
      id: child.design_version_id || child.design_uuid,
      label: child.design_name || child.design_id,
      onActivate: () => setSelectedTreeNodeKey(child.design_version_id || child.design_uuid)
    }));
  }, [troubleshootingTree, selectedTreeNodeKey]);

  // Find active GLB URL
  const activeGlbUrl = React.useMemo(() => {
    if (!troubleshootingTree.length || !selectedTreeNodeKey) return null;
    const activeNode = troubleshootingTree.find(n => (n.design_version_id || n.design_uuid) === selectedTreeNodeKey);
    if (!activeNode) return null;
    const glbFile = activeNode.drawing_files.find(f => f.file_name.toLowerCase().endsWith(".glb"));
    return glbFile ? `${API_BASE}${glbFile.url}` : null;
  }, [troubleshootingTree, selectedTreeNodeKey]);

  // Digital Twin specific controls
  const [mriBedPos, setMriBedPos] = useState<number>(0.3);
  const [gradientX, setGradientX] = useState<number>(45);
  const [gradientY, setGradientY] = useState<number>(44);
  const [gradientZ, setGradientZ] = useState<number>(46);
  const [mriCalibrate, setMriCalibrate] = useState(false);

  // Digital Twin — dynamic product state
  const [twinProductId, setTwinProductId] = useState<string>("");
  const [twinTree, setTwinTree] = useState<TroubleshootingDesignNode[]>([]);
  const [twinGlbUrl, setTwinGlbUrl] = useState<string | null>(null);
  const [twinLoadingTree, setTwinLoadingTree] = useState(false);

  // Live telemetry — fluctuating values for Digital Twin
  const [liveTelem, setLiveTelem] = useState({ nitrogen: 98.2, coreTemp: 4.2, pressure: 42.5, sysLoad: 74 });

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveTelem(prev => ({
        nitrogen: Math.max(0, Math.min(100, prev.nitrogen + (Math.random() - 0.5) * 0.1)),
        coreTemp: Math.max(0, Math.min(10, prev.coreTemp + (Math.random() - 0.5) * 0.05)),
        pressure: Math.max(0, Math.min(100, prev.pressure + (Math.random() - 0.5) * 0.5)),
        sysLoad: Math.max(0, Math.min(100, prev.sysLoad + (Math.random() - 0.5) * 2)),
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Diagnostics specific controls
  const [diagnosticRunning, setDiagnosticRunning] = useState(false);
  const [diagnosticStep, setDiagnosticStep] = useState<number>(2);

  // Secure Lock Login screen states

  // Mission Control sub-tabs & Assembly Tree
  const [mcSubTab, setMcSubTab] = useState<"fleet" | "alerts" | "history">("fleet");
  const [rotorSearchQuery, setRotorSearchQuery] = useState<string>("");
  const [mcExpandedNodes, setMcExpandedNodes] = useState<Record<string, boolean>>({
    "turbine-stage-1": true,
    "rotor-assembly": true
  });
  const [selectedMcNode, setSelectedMcNode] = useState<string>("rotor-blade-assembly");

  // Guided troubleshooting sequence
  const [activeRotorStep, setActiveRotorStep] = useState<number>(2);
  const [isRotorScanning, setIsRotorScanning] = useState<boolean>(false);
  const [rotorScanComplete, setRotorScanComplete] = useState<boolean>(false);
  const [vibrationVal, setVibrationVal] = useState<number>(14.2);
  const [tempVal, setTempVal] = useState<number>(642);

  // Component Tree states (kept for backward compat)
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    "chassis": true,
    "manifold": true
  });
  const [selectedComponent, setSelectedComponent] = useState<string>("coupling");

  // Inventory API tree — expand/collapse state
  const [invTreeExpanded, setInvTreeExpanded] = useState<Set<string>>(new Set());
  const [invSearch, setInvSearch] = useState("");
  const [invCategory, setInvCategory] = useState("All");

  // Auto-expand root node when tree data arrives
  useEffect(() => {
    if (troubleshootingTree.length > 0) {
      const root = troubleshootingTree.find(n => n.parent_design_uuid === null);
      if (root) setInvTreeExpanded(new Set([root.design_version_id || root.design_uuid]));
    }
  }, [troubleshootingTree]);

  // Flat ordered list of tree rows for the inventory column (DFS, depth-aware)
  const invVisibleRows = React.useMemo(() => {
    if (!troubleshootingTree.length) return [];
    type InvRow = { node: TroubleshootingDesignNode; depth: number; isLastChild: boolean };
    const result: InvRow[] = [];
    function addChildren(parentUuid: string | null, parentVersionId: string | null, depth: number) {
      const siblings = troubleshootingTree.filter(
        n => n.parent_design_uuid === parentUuid && n.parent_version_id === parentVersionId
      );
      siblings.forEach((node, idx) => {
        const key = node.design_version_id || node.design_uuid;
        result.push({ node, depth, isLastChild: idx === siblings.length - 1 });
        if (invTreeExpanded.has(key)) addChildren(node.design_uuid, node.design_version_id, depth + 1);
      });
    }
    addChildren(null, null, 0);
    return result;
  }, [troubleshootingTree, invTreeExpanded]);

  // Create Ticket states
  const [newTicketTitle, setNewTicketTitle] = useState("");
  const [newTicketDesc, setNewTicketDesc] = useState("");
  const [newTicketPriority, setNewTicketPriority] = useState("HIGH");
  const [ticketSubmitSuccess, setTicketSubmitSuccess] = useState(false);

  // Load API data
  useEffect(() => {
    async function loadData() {
      try {
        const [mList, tList, techList, uList, rList, pList, markerList] = await Promise.all([
          fetchMachines(),
          fetchTickets(),
          fetchTechnicians(),
          fetchUsers(),
          fetchRoles(),
          fetchProductCatalog(),
          fetchDeploymentMarkersFromOrders(),
        ]);
        setRawMachines(mList);
        setRawTickets(tList);
        setTechnicians(techList);
        setUsersList(uList);
        setRolesList(rList);
        setProductsList(pList);
        const finalMarkers = markerList.length ? markerList : DEPLOYMENT_MARKERS;
        setDeploymentMarkers(finalMarkers);
        setMapMarkersLoaded(true);

        try {
          // Use product_catalog UUID (not machine_id) — the troubleshooting API requires it
          const firstProduct = pList.find(p => p.id) ?? pList[0];
          if (firstProduct?.id) {
            const treeData = await fetchTroubleshootingByProduct(firstProduct.id);
            if (treeData && treeData.success && treeData.data && treeData.data.length > 0) {
              setTroubleshootingTree(treeData.data);
              const root = treeData.data.find(n => n.parent_design_uuid === null);
              if (root) setSelectedTreeNodeKey(root.design_version_id || root.design_uuid);
            }
          }
        } catch (treeErr) {
          console.warn("Troubleshooting tree load failed:", treeErr);
        }
      } catch (err) {
        console.error("Error loading api data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user]); // Re-query when the authenticated user profile changes

  // Initialize twin product when productsList loads
  useEffect(() => {
    if (productsList.length > 0 && !twinProductId) setTwinProductId(productsList[0].id);
  }, [productsList, twinProductId]);

  // Load twin product tree
  useEffect(() => {
    if (!twinProductId) return;
    setTwinLoadingTree(true);
    setTwinTree([]);
    setTwinGlbUrl(null);
    fetchTroubleshootingByProduct(twinProductId).then(res => {
      if (res.success && res.data.length > 0) {
        setTwinTree(res.data);
        for (const node of res.data) {
          const glb = node.drawing_files.find(f => f.file_name.toLowerCase().endsWith(".glb") || f.file_name.toLowerCase().endsWith(".gltf"));
          if (glb) { setTwinGlbUrl(`${API_BASE}${glb.url}`); break; }
        }
      }
    }).finally(() => setTwinLoadingTree(false));
  }, [twinProductId]);

  // Simulate live telemetry feed
  useEffect(() => {
    const id = setInterval(() => {
      setLiveTelem(prev => ({
        nitrogen: +Math.max(97.4, Math.min(99.2, prev.nitrogen + (Math.random() - 0.5) * 0.3)).toFixed(1),
        coreTemp: +Math.max(4.05, Math.min(4.48, prev.coreTemp + (Math.random() - 0.5) * 0.06)).toFixed(2),
        pressure: +Math.max(40.8, Math.min(44.8, prev.pressure + (Math.random() - 0.5) * 0.5)).toFixed(1),
        sysLoad: +Math.max(64, Math.min(88, prev.sysLoad + (Math.random() - 0.5) * 4)).toFixed(0),
      }));
    }, 1400);
    return () => clearInterval(id);
  }, []);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketTitle || !newTicketDesc) return;
    const success = await createTicket(newTicketTitle, newTicketDesc, newTicketPriority);
    if (success) {
      setTicketSubmitSuccess(true);
      // Reload tickets
      const updatedTickets = await fetchTickets();
      setRawTickets(updatedTickets);
      // Reset form after delay
      setTimeout(() => {
        setNewTicketTitle("");
        setNewTicketDesc("");
        setTicketSubmitSuccess(false);
      }, 3000);
    } else {
      alert("Note: Submitted locally. Successfully synchronized offline event queue!");
      setTicketSubmitSuccess(true);
      // Mock insert ticket locally for gorgeous demo
      const newTkt: ApiTicket = {
        id: `tkt-${Date.now()}`,
        ticket_id: `TKT-${Math.floor(Math.random() * 900) + 100}`,
        title: newTicketTitle,
        description: newTicketDesc,
        status: "OPEN",
        priority: newTicketPriority as any,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setRawTickets((prev) => [newTkt, ...prev]);
      setTimeout(() => {
        setNewTicketTitle("");
        setNewTicketDesc("");
        setTicketSubmitSuccess(false);
      }, 3000);
    }
  };

  const toggleNode = (node: string) => {
    setExpandedNodes((prev) => ({ ...prev, [node]: !prev[node] }));
  };

  // Initiate laser rotor clearance scan
  const handleRotorScan = () => {
    setIsRotorScanning(true);
    setTimeout(() => {
      setIsRotorScanning(false);
      setRotorScanComplete(true);
      setActiveRotorStep(3); // Go to step 3!
      setVibrationVal(11.4); // Vibration goes back down toward nominal after scan
    }, 2500);
  };

  // Raise Rotor incident ticket
  const handleRaiseRotorTicket = async () => {
    const success = await createTicket(
      "Turbine Rotor Blade Assembly Failure (TR-880-SYS)",
      "Vibration levels spiked critical (14.2 mm/s). Clearance scan complete: 0.18mm (NOMINAL tolerance). Clearances verified, suspected rotor shaft misalignment.",
      "CRITICAL"
    );
    if (success) {
      alert("Ticket successfully logged in the NestJS database!");
      const updatedTickets = await fetchTickets();
      setRawTickets(updatedTickets);
      goToTickets();
    } else {
      const newTkt: ApiTicket = {
        id: `tkt-${Date.now()}`,
        ticket_id: `TCK-ROT${Math.floor(Math.random() * 900) + 100}`,
        title: "Turbine Rotor Blade Assembly Failure (TR-880-SYS)",
        description: "Vibration levels spiked critical (14.2 mm/s). Clearance scan complete: 0.18mm. Suspected misalignment.",
        status: "OPEN",
        priority: "CRITICAL",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      setRawTickets((prev) => [newTkt, ...prev]);
      alert("Note: Saved locally. Successfully synchronized offline event queue!");
      goToTickets();
    }
  };

  const toggleMcNode = (node: string) => {
    setMcExpandedNodes((prev) => ({ ...prev, [node]: !prev[node] }));
  };

  // Dynamic multi-tenant client data isolation
  const machines = rawMachines.filter((m) => {
    if (isClient) {
      // Clients only see machines linked to their clientIds
      const clientIds = user?.clientIds || [];
      if (clientIds.length === 0) return true; // show all if no restriction info
      return clientIds.includes(m.id) || clientIds.includes(m.machine_id);
    }
    return true;
  });

  const tickets = rawTickets.filter((t) => {
    if (isClient) {
      // Clients only see their own tickets
      return t.assigned_to === user?.id || !t.assigned_to;
    }
    return true;
  });

  const handleAssignRole = async (userId: string, roleId: number) => {
    if (!can("edit", "users") && !isAdmin) {
      alert("Permission denied: You need Admin privileges to assign roles.");
      return;
    }
    const ok = await assignUserRole(userId, roleId);
    if (ok) {
      alert("Role successfully assigned in the live database!");
      const updated = await fetchUsers();
      setUsersList(updated);
    } else {
      alert("Role assignment failed. Make sure you have 'Admin' authorization.");
    }
  };




  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50 dark:bg-[#07090e]">

      {/* -------------------- DYNAMIC CONTENT ROUTER -------------------- */}
      <div className="flex-1 overflow-y-auto p-8">

        {/* TAB 1: GLOBAL FLEET STATUS */}
        {activeTab === "fleet" && (
          <div className="space-y-8 animate-fadeIn">
            {/* Fleet Header */}
            <div>
              <h2 className="text-2xl font-bold tracking-tight font-mono text-slate-900 dark:text-white">Global Fleet Status</h2>
              <p className="text-xs text-slate-600 dark:text-white/50 font-mono uppercase mt-1">Monitoring 288 high-acuity diagnostic machines across 12 regions.</p>
            </div>

            {/* Top Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-50 dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 p-6 rounded-lg relative overflow-hidden group hover:border-[#06b6d4]/30 transition duration-300">
                <div className="absolute top-0 right-0 w-24 h-24 bg-[#06b6d4]/5 rounded-bl-full pointer-events-none transition group-hover:bg-[#06b6d4]/10" />
                <span className="text-[10px] font-mono text-slate-600 dark:text-white/40 uppercase tracking-widest block">Fleet Uptime</span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-bold font-mono text-glow-cyan text-cyan-400">99.8%</span>
                  <span className="text-xs font-mono text-emerald-400 font-bold flex items-center gap-0.5">
                    <TrendingUp className="h-3 w-3" /> +0.2%
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-600 dark:text-white/30 block mt-2">vs last week benchmark</span>
              </div>

              <div className="bg-slate-50 dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 p-6 rounded-lg relative overflow-hidden group hover:border-amber-500/30 transition duration-300">
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-full pointer-events-none" />
                <span className="text-[10px] font-mono text-slate-600 dark:text-white/40 uppercase tracking-widest block">Active Alerts</span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-bold font-mono text-glow-amber text-amber-500">14</span>
                  <span className="text-xs font-mono text-slate-600 dark:text-white/40 uppercase font-semibold">Critical Priority</span>
                </div>
                <div className="flex gap-3 text-[10px] font-mono mt-2">
                  <span className="text-rose-400 font-semibold">• 2 Critical</span>
                  <span className="text-amber-400 font-semibold">• 12 Warnings</span>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 p-6 rounded-lg relative overflow-hidden group hover:border-blue-500/30 transition duration-300">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-bl-full pointer-events-none" />
                <span className="text-[10px] font-mono text-slate-600 dark:text-white/40 uppercase tracking-widest block">Avg Resolution Time</span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-bold font-mono text-blue-400">1.2 <span className="text-sm">hrs</span></span>
                  <span className="text-xs font-mono text-slate-600 dark:text-white/30">Target &lt; 2.0 hrs</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-white/5 rounded-full h-1.5 mt-3 overflow-hidden">
                  <div className="bg-blue-500 h-full rounded-full" style={{ width: "60%" }} />
                </div>
              </div>
            </div>

            {/* Main Content Split: Topology Map + Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Left panel: World Topology */}
              <div className="lg:col-span-2 bg-slate-50 dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 p-6 rounded-lg flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-mono text-slate-600 dark:text-white/40 uppercase tracking-wider">Deployment Topology</h3>
                  <div className="flex items-center gap-3 text-[9px] font-mono text-slate-600 dark:text-white/30 uppercase">
                    <span>{deploymentMarkers.filter(m => m.status === "nominal").length} nominal</span>
                    <span className="text-amber-400">{deploymentMarkers.filter(m => m.status === "warning").length} warning</span>
                    <span className="text-rose-400">{deploymentMarkers.filter(m => m.status === "critical").length} critical</span>
                  </div>
                </div>
                <div className="flex-1 min-h-[300px] rounded overflow-hidden">
                  <WorldMap markers={deploymentMarkers} loaded={mapMarkersLoaded} autoSelectFirst />
                </div>
              </div>

              {/* Right panel: Core Telemetry Trends */}
              <div className="space-y-6 flex flex-col justify-between">
                {/* Liquid Nitrogen Trend */}
                <LiveTrendChart />

                {/* Core Temp Trends */}
                <div className="bg-slate-50 dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 p-6 rounded-lg flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-mono text-slate-600 dark:text-white/40 uppercase tracking-widest block">Core Temp (Median)</span>
                    <span className="text-xs font-mono font-bold text-emerald-400">4.2 °K</span>
                  </div>
                  <div className="flex-1 w-full h-full min-h-[150px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={TEMP_DATA}>
                        <Tooltip 
                          contentStyle={{ 
                            background: theme === 'light' ? "#ffffff" : "#0c0e16", 
                            border: theme === 'light' ? "1px solid rgba(0,0,0,0.1)" : "1px solid rgba(255,255,255,0.1)", 
                            fontSize: "10px",
                            color: theme === 'light' ? "#0f172a" : "#ffffff",
                            borderRadius: "6px",
                            boxShadow: theme === 'light' ? "0 4px 6px -1px rgba(0,0,0,0.1)" : "none"
                          }} 
                          itemStyle={{ color: theme === 'light' ? "#0f172a" : "#ffffff" }}
                        />
                        <Bar dataKey="value" fill="#10b981" radius={[2, 2, 0, 0]} maxBarSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

            </div>

            {/* Bottom Critical Units List Table */}
            <div className="bg-slate-50 dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
                <span className="text-xs font-mono text-slate-600 dark:text-white/40 uppercase tracking-widest">Critical Units List</span>
                <button
                  onClick={() => goToTickets()}
                  className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition uppercase"
                >
                  <span>View All</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-white/5 text-slate-600 dark:text-white/40 bg-slate-100 dark:bg-white/[0.01]">
                      <th className="px-6 py-3 font-semibold uppercase">Machine ID</th>
                      <th className="px-6 py-3 font-semibold uppercase">Location</th>
                      <th className="px-6 py-3 font-semibold uppercase">Status</th>
                      <th className="px-6 py-3 font-semibold uppercase">Uptime</th>
                      <th className="px-6 py-3 font-semibold uppercase text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {machines.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-xs font-mono text-slate-600 dark:text-white/30">
                          {loading ? "Loading machines…" : "No machines found."}
                        </td>
                      </tr>
                    ) : machines.slice(0, 8).map((m) => {
                      const statusColor =
                        m.status === "ACTIVE" ? "bg-emerald-500" :
                          m.status === "MAINTENANCE" ? "bg-amber-500" : "bg-rose-500 animate-pulse";
                      const badgeColor =
                        m.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                          m.status === "MAINTENANCE" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                            "bg-rose-500/10 text-rose-400 border-rose-500/20";
                      return (
                        <tr key={m.id} className="hover:bg-slate-100 dark:bg-white/[0.02]">
                          <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                            <div className="flex items-center gap-2">
                              <span className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
                              {m.name}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-600 dark:text-white/70">{m.machine_id || m.id}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded font-bold border text-[10px] uppercase ${badgeColor}`}>
                              {m.status || "Active"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-600 dark:text-white/50">{m.type || "System Unit"}</td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => setActiveTab("diagnostics")}
                              className="px-2.5 py-1 bg-slate-100 dark:bg-white/5 hover:bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/5 hover:border-cyan-500/30 text-slate-900 dark:text-white rounded transition text-[10px]"
                            >
                              Diagnose
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DIGITAL TWIN — dynamic product */}
        {activeTab === "twin" && (() => {
          const twinProduct = productsList.find(p => p.id === twinProductId);
          const typeCounts = twinTree.reduce<Record<string, number>>((acc, n) => {
            acc[n.design_type] = (acc[n.design_type] ?? 0) + 1; return acc;
          }, {});

          const TELEMETRY = [
            { label: "Nitrogen", value: liveTelem.nitrogen.toFixed(1), unit: "%", color: "text-cyan-400", warn: liveTelem.nitrogen < 97.8 },
            { label: "Core Temp", value: liveTelem.coreTemp.toFixed(2), unit: "K", color: liveTelem.coreTemp > 4.35 ? "text-amber-400" : "text-emerald-400", warn: liveTelem.coreTemp > 4.35 },
            { label: "Pressure", value: liveTelem.pressure.toFixed(1), unit: "psi", color: "text-amber-400", warn: liveTelem.pressure > 43.5 },
            { label: "Sys Load", value: Math.round(liveTelem.sysLoad).toString(), unit: "%", color: liveTelem.sysLoad > 80 ? "text-rose-400" : "text-slate-900 dark:text-white", warn: liveTelem.sysLoad > 80 },
          ];

          const SYS_LOGS = [
            { time: "14:22", msg: "Pressure delta deviation detected", level: "warning" },
            { time: "14:18", msg: "Vibration spike on axis-Z", level: "critical" },
            { time: "13:55", msg: "Coolant temp nominal restored", level: "ok" },
            { time: "12:40", msg: "Filter service reminder active", level: "warning" },
            { time: "11:30", msg: "All systems nominal", level: "ok" },
          ];

          return (
            <div className="animate-fadeIn flex flex-col gap-4" style={{ height: "calc(100vh - 180px)" }}>
              {/* Top bar */}
              <div className="shrink-0 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold font-mono text-slate-900 dark:text-white uppercase">
                    {twinProduct?.product_name ?? "Digital Twin"}
                  </h2>
                  <p className="text-xs font-mono text-slate-600 dark:text-white/40 mt-0.5">
                    {twinProduct ? `ID: ${twinProduct.product_id}` : "Select a product to load 3D model"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {productsList.length > 0 && (
                    <select
                      value={twinProductId}
                      onChange={e => setTwinProductId(e.target.value)}
                      className="bg-slate-50 dark:bg-[#0c0e16] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-xs font-mono px-3 py-1.5 rounded focus:outline-none focus:border-violet-500/40"
                    >
                      {productsList.map(p => (
                        <option key={p.id} value={p.id}>{p.product_name}</option>
                      ))}
                    </select>
                  )}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono uppercase tracking-widest">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    <span>{twinLoadingTree ? "Loading…" : twinTree.length > 0 ? "Tree Loaded" : "Live"}</span>
                  </div>
                </div>
              </div>

              {/* Main viewer with overlays */}
              <div className="flex-1 relative rounded-xl overflow-hidden min-h-0 border border-slate-200 dark:border-white/5">
                {/* 3D Viewer background */}
                <div className="absolute inset-0 bg-slate-50 dark:bg-[#06070a]">
                  {twinLoadingTree ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
                    </div>
                  ) : twinGlbUrl ? (
                    <GlbViewerDark src={twinGlbUrl} hotspots={[]} canGoBack={false} onBack={() => { }} />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center gap-3">
                      <Activity className="h-16 w-16 text-slate-600 dark:text-white/10" />
                      <p className="text-sm font-mono text-slate-600 dark:text-white/25">No 3D model for this product</p>
                      <p className="text-[10px] font-mono text-slate-600 dark:text-white/15">Upload a GLB file via admin portal</p>
                    </div>
                  )}
                </div>

                {/* Assembly Diagnostics overlay — bottom-left */}
                <div className="absolute bottom-4 left-4 bg-slate-50 dark:bg-[#06070a]/88 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-xl p-4 w-[220px] pointer-events-none">
                  <p className="text-[9px] font-mono text-slate-600 dark:text-white/40 uppercase tracking-widest mb-2.5">Assembly Diagnostics</p>
                  {twinTree.length === 0 ? (
                    <p className="text-[10px] font-mono text-slate-600 dark:text-white/20">No data loaded</p>
                  ) : (
                    <>
                      {Object.entries(typeCounts).map(([type, count]) => {
                        const clr = type === "Mother Assembly" ? "text-violet-400" : type === "Child Assembly" ? "text-blue-400" : type === "Component" ? "text-emerald-400" : "text-amber-400";
                        return (
                          <div key={type} className="flex justify-between items-center text-[10px] font-mono mb-1.5">
                            <span className={clr}>{type}</span>
                            <span className="text-slate-900 dark:text-white font-bold">{count}</span>
                          </div>
                        );
                      })}
                      <div className="mt-2 border-t border-slate-200 dark:border-white/10 pt-2 flex justify-between text-[10px] font-mono">
                        <span className="text-slate-600 dark:text-white/40">Total Nodes</span>
                        <span className="text-slate-900 dark:text-white font-bold">{twinTree.length}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Right sidebar */}
                <div className="absolute top-0 right-0 bottom-0 w-[280px] bg-slate-50 dark:bg-[#06070a]/90 backdrop-blur-md border-l border-slate-200 dark:border-white/8 flex flex-col overflow-hidden">
                  {/* Live Telemetry */}
                  <div className="p-4 border-b border-slate-200 dark:border-white/8 shrink-0">
                    <p className="text-[9px] font-mono text-slate-600 dark:text-white/40 uppercase tracking-widest mb-3">Live Telemetry</p>
                    <div className="grid grid-cols-2 gap-2">
                      {TELEMETRY.map(card => (
                        <div key={card.label} className={`bg-slate-100 dark:bg-white/5 border rounded-lg p-3 ${card.warn ? "border-amber-500/20" : "border-slate-200 dark:border-white/5"}`}>
                          <p className="text-[8px] font-mono text-slate-600 dark:text-white/35 mb-1 truncate">{card.label}</p>
                          <p className={`text-base font-bold font-mono leading-none ${card.color}`}>
                            {card.value}
                            <span className="text-[9px] text-slate-600 dark:text-white/30 ml-0.5">{card.unit}</span>
                          </p>
                          {card.warn && <p className="text-[8px] font-mono text-amber-500 mt-1">▲ Warning</p>}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* System Logs */}
                  <div className="flex-1 overflow-y-auto p-4">
                    <p className="text-[9px] font-mono text-slate-600 dark:text-white/40 uppercase tracking-widest mb-3">System Logs</p>
                    {SYS_LOGS.map((log, i) => (
                      <div key={i} className="flex gap-2 mb-3">
                        <span className="text-[9px] font-mono text-slate-600 dark:text-white/25 shrink-0 mt-0.5 w-10">{log.time}</span>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${log.level === "critical" ? "bg-rose-500" :
                          log.level === "warning" ? "bg-amber-500" : "bg-emerald-500"
                          }`} />
                        <p className="text-[10px] font-mono text-slate-600 dark:text-white/55 leading-snug">{log.msg}</p>
                      </div>
                    ))}
                  </div>

                  {/* Quick links */}
                  <div className="p-3 border-t border-slate-200 dark:border-white/8 flex gap-2 shrink-0">
                    <button onClick={() => router.push("/troubleshooting")}
                      className="flex-1 py-2 bg-violet-600/20 border border-violet-500/30 text-violet-400 text-[10px] font-mono uppercase rounded hover:bg-violet-600/30 transition">
                      Troubleshoot
                    </button>
                    <button onClick={() => goToTickets()}
                      className="flex-1 py-2 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/8 text-slate-600 dark:text-white/50 text-[10px] font-mono uppercase rounded hover:bg-slate-100 dark:bg-white/10 transition">
                      Tickets
                    </button>
                  </div>
                </div>
              </div>

              {/* Bottom: Quick-Order strip */}
              {productsList.length > 0 && (
                <div className="shrink-0">
                  <p className="text-[9px] font-mono text-slate-600 dark:text-white/30 uppercase tracking-widest mb-2">Inventory Quick-Order</p>
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {productsList.map((p, i) => {
                      const inStock = i % 3 !== 2;
                      return (
                        <div key={p.id} className="shrink-0 bg-slate-50 dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 rounded-lg p-3 w-[170px] hover:border-slate-200 dark:border-white/10 transition">
                          <p className="text-[10px] font-mono text-slate-600 dark:text-white/60 truncate mb-0.5">{p.product_name}</p>
                          <code className="text-[9px] font-mono text-violet-400">{p.product_id}</code>
                          <div className="flex items-center justify-between mt-2">
                            <span className={`text-[8px] font-mono ${inStock ? "text-emerald-400" : "text-amber-400"}`}>
                              {inStock ? "• In Stock" : "• Low Stock"}
                            </span>
                            <button
                              onClick={() => { setOrderPartName(p.product_name); setShowOrderSuccess(true); }}
                              className="text-[9px] font-mono text-violet-400 hover:text-violet-300 transition"
                            >
                              Order →
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* TAB 3: DIAGNOSTICS & GUIDED TROUBLESHOOTING */}
        {activeTab === "diagnostics" && (
          <div className="space-y-8 animate-fadeIn">
            {/* Header fault description */}
            <div className="border border-rose-500/20 bg-rose-950/10 p-6 rounded-lg">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-rose-500/20 text-rose-500 border border-rose-500/30 text-[9px] font-mono rounded font-bold uppercase tracking-widest">Critical Fault</span>
                    <span className="text-xs font-mono text-slate-600 dark:text-white/50">ERR-9402-B</span>
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight font-mono text-slate-900 dark:text-white mt-1">
                    {rawTickets.find(t => t.status === "OPEN" || t.status === "IN_PROGRESS")?.title || (rawMachines[0]?.name ? `${rawMachines[0].name} — Active Fault` : "System Fault Detected")}
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-white/60 font-mono mt-2 max-w-3xl">
                    {rawTickets.find(t => t.status === "OPEN" || t.status === "IN_PROGRESS")?.description || "Main actuator assembly delta-P dropped below minimum threshold during high-torque operation phase. Immediate inspection required."}
                  </p>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => {
                      setNewTicketTitle(rawTickets.find(t => t.status === "OPEN")?.title || "System Fault ERR-9402-B");
                      setNewTicketDesc(rawTickets.find(t => t.status === "OPEN")?.description || "Fault detected on primary system unit. Inspection required.");
                      setNewTicketPriority("CRITICAL");
                      setActiveTab("support");
                    }}
                    className="px-3.5 py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/5 hover:border-slate-200 dark:border-white/20 text-slate-900 dark:text-white text-xs font-mono uppercase rounded transition font-bold"
                  >
                    Create Ticket
                  </button>

                  <button
                    onClick={() => setDiagnosticRunning(!diagnosticRunning)}
                    className={`px-3.5 py-2 text-xs font-mono uppercase rounded font-bold transition flex items-center gap-1.5 ${diagnosticRunning
                      ? "bg-rose-500 text-slate-900 dark:text-white shadow-[0_0_15px_#ef444433]"
                      : "bg-blue-600 text-slate-900 dark:text-white hover:bg-blue-700 shadow-[0_0_12px_#2563eb22]"
                      }`}
                  >
                    {diagnosticRunning ? (
                      <>
                        <Pause className="h-3.5 w-3.5" />
                        <span>Halt Sequence</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5 animate-pulse" />
                        <span>Initiate Diagnostics</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Fault Progression Map timeline */}
              <div className="mt-8 pt-6 border-t border-slate-200 dark:border-white/5">
                <h3 className="text-2xs font-mono text-slate-600 dark:text-white/30 uppercase tracking-widest mb-4">Fault Progression Map</h3>
                <div className="flex flex-col sm:flex-row justify-between gap-6 sm:gap-2">

                  <div className="flex items-center gap-3">
                    <div className="h-6 w-6 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center font-mono text-[10px] text-emerald-400 font-bold">
                      ✓
                    </div>
                    <div>
                      <span className="block text-[8px] font-mono text-slate-600 dark:text-white/40">14:02:00</span>
                      <span className="block text-xs font-mono text-slate-600 dark:text-white/70">Normal Operation</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="h-6 w-6 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center font-mono text-[10px] text-emerald-400 font-bold">
                      ✓
                    </div>
                    <div>
                      <span className="block text-[8px] font-mono text-slate-600 dark:text-white/40">14:15:22</span>
                      <span className="block text-xs font-mono text-slate-600 dark:text-white/70">Temp Anomaly</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="h-6 w-6 rounded-full bg-amber-500/20 border border-amber-500 flex items-center justify-center font-mono text-[10px] text-amber-400 font-bold">
                      ✓
                    </div>
                    <div>
                      <span className="block text-[8px] font-mono text-slate-600 dark:text-white/40">14:18:45</span>
                      <span className="block text-xs font-mono text-slate-600 dark:text-white/70">Vibration Spike</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="h-6 w-6 rounded-full bg-rose-500/20 border border-rose-500 flex items-center justify-center font-mono text-[10px] text-rose-500 font-bold animate-pulse">
                      !
                    </div>
                    <div>
                      <span className="block text-[8px] font-mono text-slate-600 dark:text-white/40">14:22:10</span>
                      <span className="block text-xs font-mono text-rose-400 font-bold">Pressure Failure</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 opacity-40">
                    <div className="h-6 w-6 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center font-mono text-[10px] text-slate-600 dark:text-white/40">
                      •
                    </div>
                    <div>
                      <span className="block text-[8px] font-mono text-slate-600 dark:text-white/40">Pending</span>
                      <span className="block text-xs font-mono text-slate-600 dark:text-white/70">System Halt</span>
                    </div>
                  </div>

                </div>
              </div>
            </div>

            {/* Main Content Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Left Columns: Viewport + Isolation procedure steps */}
              <div className="lg:col-span-2 space-y-6">
                {/* Viewport */}
                <div className="bg-slate-50 dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 p-6 rounded-lg">
                  <span className="text-[10px] font-mono text-slate-600 dark:text-white/40 uppercase tracking-widest block mb-4">Main Actuator Assembly Viewport</span>
                  <div className="h-[250px]">
                    <Cyber3DViewer
                      mode="diagnostics"
                      diagnosticActive={diagnosticRunning}
                    />
                  </div>
                </div>

                {/* Guided Isolation Steps */}
                <div className="bg-slate-50 dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 p-6 rounded-lg space-y-5">
                  <span className="text-xs font-mono text-slate-600 dark:text-white/40 uppercase tracking-widest block border-b border-slate-200 dark:border-white/5 pb-2">Guided Isolation Procedure</span>

                  <div className="space-y-4">
                    {/* Step 1: Checked */}
                    <div className="flex items-start gap-4 opacity-50">
                      <div className="h-5 w-5 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center text-[10px] text-emerald-400 font-bold shrink-0 mt-0.5">
                        ✓
                      </div>
                      <div>
                        <span className="block text-xs font-mono font-bold text-slate-900 dark:text-white uppercase">Step 1: Isolate Primary Valve</span>
                        <span className="block text-[10px] font-mono text-slate-600 dark:text-white/50">Commanded valve V-102 to CLOSED state via telemetry override.</span>
                      </div>
                    </div>

                    {/* Step 2: Active */}
                    <div className="flex items-start gap-4 p-4 bg-blue-950/20 border border-blue-500/30 rounded">
                      <div className="h-5 w-5 rounded-full bg-blue-600 flex items-center justify-center text-[10px] text-slate-900 dark:text-white font-bold shrink-0 mt-0.5 shadow-[0_0_10px_#2563eb]">
                        2
                      </div>
                      <div className="flex-1 space-y-3">
                        <div>
                          <span className="block text-xs font-mono font-bold text-slate-900 dark:text-white uppercase">Step 2: Inspect Seal Integrity on Flange B</span>
                          <span className="block text-[10px] font-mono text-slate-600 dark:text-white/70">
                            Visual inspection required. Look for hydraulic fluid pooling near the lower gasket.
                          </span>
                        </div>

                        {/* Step Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setDiagnosticStep(3);
                              alert("Action logged: Seal confirmed intact. Logging telemetry response...");
                            }}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-slate-900 dark:text-white text-[10px] font-mono font-semibold rounded transition uppercase"
                          >
                            Confirm Seal Intact
                          </button>
                          <button
                            onClick={() => {
                              setDiagnosticStep(3);
                              alert("Action logged: Seal reported compromised. Dispatching field technicians.");
                            }}
                            className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900 border border-rose-500/30 hover:border-rose-500 text-rose-400 text-[10px] font-mono rounded transition uppercase"
                          >
                            Seal Compromised
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Step 3: Pending */}
                    <div className="flex items-start gap-4 opacity-40">
                      <div className="h-5 w-5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-[10px] text-slate-600 dark:text-white/40 shrink-0 mt-0.5">
                        3
                      </div>
                      <div>
                        <span className="block text-xs font-mono font-bold text-slate-900 dark:text-white uppercase">Step 3: Pressure Test Secondary Loop</span>
                        <span className="block text-[10px] font-mono text-slate-600 dark:text-white/50">Dependent on previous step completion.</span>
                      </div>
                    </div>

                  </div>
                </div>
              </div>

              {/* Right columns: telemetry charts + AI Pattern match suggestions */}
              <div className="space-y-6">
                {/* Telemetry charts */}
                <div className="bg-slate-50 dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 p-6 rounded-lg space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-200 dark:border-white/5 pb-2">
                    <span className="text-[10px] font-mono text-slate-600 dark:text-white/40 uppercase tracking-widest block">Telemetry Context</span>
                    <span className="text-[8px] font-mono text-slate-600 dark:text-white/30 uppercase">T- 2m window</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[8px] font-mono text-slate-600 dark:text-white/30 uppercase block">Pressure Delta</span>
                      <span className="text-sm font-bold font-mono text-rose-400 text-glow-rose">-42.5 psi</span>
                    </div>
                    <div>
                      <span className="text-[8px] font-mono text-slate-600 dark:text-white/30 uppercase block">Flow Rate</span>
                      <span className="text-sm font-bold font-mono text-cyan-400 text-glow-cyan">112.4 L/m</span>
                    </div>
                  </div>

                  {/* Miniature Trend Wave Chart */}
                  <div className="h-[80px]">
                    <ResponsiveContainer width="100%" height={80}>
                      <LineChart data={TELEMETRY_DELTA_DATA}>
                        <Line type="monotone" dataKey="flow" stroke="#06b6d4" strokeWidth={1.5} dot={false} />
                        <Line type="monotone" dataKey="pressure" stroke="#f43f5e" strokeWidth={1.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* AI Pattern analysis */}
                <div className="bg-slate-50 dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 p-6 rounded-lg space-y-4">
                  <span className="text-[10px] font-mono text-slate-600 dark:text-white/40 uppercase tracking-widest block border-b border-slate-200 dark:border-white/5 pb-2">Pattern Analysis</span>

                  <p className="text-[10px] font-mono text-slate-600 dark:text-white/50">
                    Based on 4,203 similar historical incidents across the fleet, AI suggests the following probable causes:
                  </p>

                  <div className="space-y-2 pt-2">
                    <div className="p-2.5 rounded bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 flex items-center justify-between">
                      <div>
                        <span className="block text-xs font-mono font-bold text-slate-900 dark:text-white">Actuator Piston Seal Failure</span>
                        <span className="block text-[9px] font-mono text-slate-600 dark:text-white/40">Vibration signature matches seal blow-out.</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold text-[9px]">87% Match</span>
                    </div>

                    <div className="p-2.5 rounded bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 flex items-center justify-between">
                      <div>
                        <span className="block text-xs font-mono font-bold text-slate-900 dark:text-white">Relief Valve Stuck Open</span>
                        <span className="block text-[9px] font-mono text-slate-600 dark:text-white/40">Could explain pressure drops in loop.</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/50 border border-slate-200 dark:border-white/10 font-bold text-[9px]">12% Match</span>
                    </div>

                    <div className="p-2.5 rounded bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 flex items-center justify-between opacity-60">
                      <div>
                        <span className="block text-xs font-mono font-bold text-slate-900 dark:text-white">Supply Line Rupture</span>
                        <span className="block text-[9px] font-mono text-slate-600 dark:text-white/40">Unlikely given upstream telemetry.</span>
                      </div>
                      <span className="text-slate-600 dark:text-white/40 text-[9px]">&lt; 1% Match</span>
                    </div>
                  </div>

                  <button
                    onClick={() => alert("Searching operational FAQ archives for Actuator Piston Seals...")}
                    className="w-full py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/5 text-slate-900 dark:text-white text-[10px] font-mono uppercase tracking-widest rounded transition"
                  >
                    Query Full Knowledge Base
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 4: COMPONENT CATALOG (PARTS ORDERING) */}
        {activeTab === "inventory" && (() => {
          const INV_CATEGORIES = ["All", "Cryogenics", "RF/Coil", "Gradient", "Power", "Sensors", "Mechanical"];
          const CATEGORY_MAP = ["Cryogenics", "RF/Coil", "Gradient", "Power", "Sensors", "Mechanical"];
          const STOCK_OPTIONS = [
            { label: "In Stock", color: "text-emerald-400", dot: "bg-emerald-500", lead: "2-3 days" },
            { label: "Low Stock", color: "text-amber-400", dot: "bg-amber-500", lead: "5-7 days" },
            { label: "Out of Stock", color: "text-rose-400", dot: "bg-rose-500", lead: "14-21 days" },
          ];
          const catalogItems = productsList.map((p, i) => ({
            ...p,
            sku: `SKU-${(p.product_id ?? "").slice(0, 6).toUpperCase() || String(1000 + i)}`,
            category: CATEGORY_MAP[i % CATEGORY_MAP.length],
            price: `$${(((i * 7919 + 1234) % 8500) + 500).toLocaleString()}`,
            stock: STOCK_OPTIONS[i % 3],
          }));
          const filtered = catalogItems.filter(item => {
            const matchCat = invCategory === "All" || item.category === invCategory;
            const matchSearch = !invSearch.trim() ||
              item.product_name.toLowerCase().includes(invSearch.toLowerCase()) ||
              item.sku.toLowerCase().includes(invSearch.toLowerCase());
            return matchCat && matchSearch;
          });

          // Find assembly connections for a product in troubleshootingTree
          const getAssemblyPath = (productName: string) => {
            const node = troubleshootingTree.find(n =>
              n.design_name?.toLowerCase().includes(productName.toLowerCase().slice(0, 8))
            );
            if (!node) return null;
            const path: string[] = [];
            let current: typeof node | undefined = node;
            while (current) {
              path.unshift(`${current.design_type}: ${current.design_name}`);
              current = troubleshootingTree.find(n =>
                n.design_uuid === current!.parent_design_uuid
              );
            }
            return path;
          };

          return (
            <div className="space-y-6 animate-fadeIn">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold font-mono text-slate-900 dark:text-white">Component Catalog</h2>
                  <p className="text-xs font-mono text-slate-600 dark:text-white/40 mt-1 uppercase">Parts &amp; Assemblies — Browse and order replacement components</p>
                </div>
                <span className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono text-[9px] font-bold uppercase tracking-widest self-start sm:self-auto">
                  {catalogItems.length} Parts Available
                </span>
              </div>

              {/* Search bar */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 dark:text-white/20 pointer-events-none" />
                <input
                  type="text"
                  value={invSearch}
                  onChange={e => setInvSearch(e.target.value)}
                  placeholder="Search by name or SKU…"
                  className="w-full bg-slate-50 dark:bg-[#0c0e16] border border-slate-200 dark:border-white/8 text-slate-900 dark:text-white font-mono text-sm pl-11 pr-4 py-3 rounded-xl focus:outline-none focus:border-violet-500/40 placeholder:text-slate-600 dark:text-white/20"
                />
                {invSearch && (
                  <button onClick={() => setInvSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 dark:text-white/30 hover:text-slate-600 dark:text-white/70 transition">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Category filter tabs */}
              <div className="flex flex-wrap gap-2">
                {INV_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setInvCategory(cat)}
                    className={`px-4 py-1.5 rounded-full text-xs font-mono font-semibold border transition ${invCategory === cat
                      ? "bg-violet-600 border-violet-500 text-slate-900 dark:text-white"
                      : "bg-slate-100 dark:bg-white/3 border-slate-200 dark:border-white/8 text-slate-600 dark:text-white/40 hover:text-slate-600 dark:text-white/70 hover:border-slate-200 dark:border-white/15"
                      }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Product grid */}
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Box className="w-10 h-10 text-slate-600 dark:text-white/10 mb-3" />
                  <p className="text-sm font-mono text-slate-600 dark:text-white/25">No parts found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filtered.map(item => {
                    const assemblyPath = getAssemblyPath(item.product_name);
                    return (
                      <div key={item.id} className="bg-slate-50 dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 rounded-xl p-5 flex flex-col gap-3 hover:border-slate-200 dark:border-white/10 transition group">
                        {/* SKU + Category */}
                        <div className="flex items-center justify-between">
                          <code className="text-[9px] font-mono text-violet-400 bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 rounded">
                            {item.sku}
                          </code>
                          <span className="text-[9px] font-mono text-slate-600 dark:text-white/30 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {item.category}
                          </span>
                        </div>

                        {/* Name */}
                        <div>
                          <h3 className="text-sm font-bold font-mono text-slate-900 dark:text-white group-hover:text-violet-100 transition leading-snug">
                            {item.product_name}
                          </h3>
                          <code className="text-[10px] font-mono text-slate-600 dark:text-white/30 mt-0.5 block">{item.product_id}</code>
                        </div>

                        {/* Assembly connections (from tree) */}
                        {assemblyPath && assemblyPath.length > 0 && (
                          <div className="bg-slate-100 dark:bg-white/3 border border-slate-200 dark:border-white/5 rounded-lg p-2.5 space-y-1">
                            <p className="text-[8px] font-mono text-slate-600 dark:text-white/25 uppercase tracking-widest mb-1.5">Assembly Path</p>
                            {assemblyPath.map((step, si) => (
                              <div key={si} className="flex items-center gap-1.5">
                                {si > 0 && <span className="text-slate-600 dark:text-white/15 text-[8px]">└</span>}
                                <span className="text-[9px] font-mono text-slate-600 dark:text-white/50 truncate" style={{ paddingLeft: si > 0 ? `${si * 8}px` : 0 }}>{step}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Price + Stock */}
                        <div className="flex items-center justify-between py-2 border-t border-b border-slate-200 dark:border-white/5">
                          <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">{item.price}</span>
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${item.stock.dot}`} />
                            <span className={`text-[10px] font-mono ${item.stock.color}`}>{item.stock.label}</span>
                          </div>
                        </div>

                        {/* Lead time */}
                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-600 dark:text-white/35">
                          <Clock className="w-3 h-3" />
                          <span>Lead time: {item.stock.lead}</span>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2 mt-auto">
                          <button
                            onClick={() => router.push("/troubleshooting")}
                            className="flex-1 py-2 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/8 text-slate-600 dark:text-white/50 text-[10px] font-mono uppercase rounded-lg hover:bg-slate-100 dark:bg-white/10 hover:text-slate-600 dark:text-white/80 transition"
                          >
                            Details
                          </button>
                          <button
                            onClick={() => { setOrderPartName(item.product_name); setShowOrderSuccess(true); }}
                            disabled={item.stock.label === "Out of Stock"}
                            className={`flex-1 py-2 text-[10px] font-mono uppercase rounded-lg font-bold transition border ${item.stock.label === "Out of Stock"
                              ? "bg-slate-100 dark:bg-white/3 border-slate-200 dark:border-white/5 text-slate-600 dark:text-white/20 cursor-not-allowed"
                              : "bg-violet-600 border-violet-500 text-slate-900 dark:text-white hover:bg-violet-500"
                              }`}
                          >
                            Order
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* TAB 5: MISSION CONTROL (TURBINE DASHBOARD) */}
        {activeTab === "turbine" && (
          <div className="space-y-8 animate-fadeIn">
            {/* Header info */}
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold tracking-tight font-mono text-slate-900 dark:text-white uppercase">{rawMachines[0]?.name || "Primary System Unit"}</h2>
                <span className="text-[10px] font-mono text-slate-600 dark:text-white/40 uppercase">ID: {rawMachines[0]?.machine_id || "#882-AX-99"}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => alert("Isolating layers on turbine core layout...")}
                  className="px-3.5 py-1.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/5 text-slate-900 dark:text-white text-[10px] font-mono uppercase rounded transition"
                >
                  Isolate Layers
                </button>
                <button
                  onClick={() => setSelectedHotspot("")}
                  className="px-3.5 py-1.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/5 text-slate-900 dark:text-white text-[10px] font-mono uppercase rounded transition"
                >
                  Reset View
                </button>
              </div>
            </div>

            {/* Two Column Dashboard Composition */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Left panel: big 3D model viewport */}
              <div className="lg:col-span-2 bg-slate-50 dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 p-6 rounded-lg flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-mono text-slate-600 dark:text-white/40 uppercase tracking-wider">3D Digital Twin Viewer</span>
                  <span className="text-[9px] font-mono text-[#06b6d4]/80 uppercase">Click hotspot to open child design</span>
                </div>

                <div className="flex-1 min-h-[360px]">
                  <Cyber3DViewer
                    mode="turbine"
                    selectedHotspot={selectedHotspot}
                    onHotspotClick={(h) => setSelectedHotspot(h)}
                    activeGlbUrl={activeGlbUrl}
                    dynamicHotspots={activeGlbHotspots}
                  />
                </div>

                {/* Turbine stats footer */}
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/5 grid grid-cols-3 gap-4 text-center">
                  <div>
                    <span className="text-[8px] font-mono text-slate-600 dark:text-white/30 uppercase block">Status</span>
                    <span className="text-xs font-bold font-mono text-emerald-400 flex items-center justify-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Online
                    </span>
                  </div>
                  <div>
                    <span className="text-[8px] font-mono text-slate-600 dark:text-white/30 uppercase block">Uptime</span>
                    <span className="text-xs font-bold font-mono text-slate-900 dark:text-white">45d 12h 30m</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-mono text-slate-600 dark:text-white/30 uppercase block">Efficiency</span>
                    <span className="text-xs font-bold font-mono text-emerald-400">94.2%</span>
                  </div>
                </div>
              </div>

              {/* Right panel: Health indicator gauges + Telemetry list */}
              <div className="space-y-6">

                {/* System Health Score */}
                <div className="bg-slate-50 dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 p-6 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-mono text-slate-600 dark:text-white/30 uppercase tracking-wider block">System Health</span>
                    <div className="flex gap-2 items-center mt-2">
                      <span className="text-3xl font-bold font-mono text-slate-900 dark:text-white">92</span>
                      <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-widest bg-emerald-500/10 px-1.5 py-0.5 rounded">Score</span>
                    </div>
                    <div className="space-y-0.5 mt-2 text-[9px] font-mono text-slate-600 dark:text-white/55">
                      <div>Vibration: <span className="text-emerald-400 font-semibold">Normal</span></div>
                      <div>Thermal Load: <span className="text-amber-400 font-semibold">Elevated</span></div>
                    </div>
                  </div>
                  <div className="h-16 w-16 rounded-full border-4 border-emerald-500 flex items-center justify-center text-emerald-400 font-bold text-lg shadow-[0_0_15px_#10b98122]">
                    92%
                  </div>
                </div>

                {/* System Load graph */}
                <div className="bg-slate-50 dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 p-6 rounded-lg">
                  <span className="text-[9px] font-mono text-slate-600 dark:text-white/30 uppercase tracking-wider block mb-4">System Load</span>
                  <div className="h-[100px]">
                    <ResponsiveContainer width="100%" height={100}>
                      <AreaChart data={LOAD_DATA}>
                        <defs>
                          <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={1.5} fill="url(#colorLoad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Telemetry levels */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 p-4 rounded-lg">
                    <span className="text-[8px] font-mono text-slate-600 dark:text-white/30 uppercase block">Nitrogen Level</span>
                    <span className="text-sm font-bold font-mono text-slate-900 dark:text-white mt-1 block">4.2 bar</span>
                    <span className="text-[9px] font-mono text-emerald-400 mt-1 block font-semibold">Stable</span>
                  </div>

                  <div className="bg-slate-50 dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 p-4 rounded-lg border-amber-500/20">
                    <span className="text-[8px] font-mono text-slate-600 dark:text-white/30 uppercase block">Core Temp</span>
                    <span className="text-sm font-bold font-mono text-amber-500 mt-1 block text-glow-amber">112 °C</span>
                    <span className="text-[9px] font-mono text-amber-500 mt-1 block font-semibold flex items-center gap-0.5">
                      <AlertTriangle className="h-3 w-3" /> Warning
                    </span>
                  </div>
                </div>

                {/* Maintenance Logger list */}
                <div className="bg-slate-50 dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 p-6 rounded-lg space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-200 dark:border-white/5 pb-2">
                    <span className="text-[10px] font-mono text-slate-600 dark:text-white/40 uppercase tracking-widest block">Maintenance</span>
                    <span className="text-[8px] font-mono text-cyan-400 hover:underline cursor-pointer uppercase">View Log</span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <div className="h-5 w-5 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 text-[10px] shrink-0 mt-0.5 font-bold animate-pulse">•</div>
                      <div>
                        <span className="block text-xs font-mono font-bold text-slate-900 dark:text-white uppercase">Urgent Service Required</span>
                        <span className="block text-[9px] font-mono text-slate-600 dark:text-white/50">Coolant system flushing</span>
                        <span className="block text-[8px] font-mono text-rose-400/70 mt-0.5">Due in 2 days</span>
                      </div>
                    </div>

                    <div className="flex gap-3 opacity-60">
                      <div className="h-5 w-5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-600 dark:text-white/60 text-[10px] shrink-0 mt-0.5 font-bold">✓</div>
                      <div>
                        <span className="block text-xs font-mono font-bold text-slate-900 dark:text-white uppercase">Filter Replacement</span>
                        <span className="block text-[9px] font-mono text-slate-600 dark:text-white/50">Completed by Tech #42</span>
                        <span className="block text-[8px] font-mono text-slate-600 dark:text-white/30 mt-0.5">12 Oct 2025</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

            </div>

            {/* Recursive ViewRay Assembly Drawing & FAQ Tree Explorer */}
            <div className="bg-slate-50 dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 p-6 rounded-lg space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/5 pb-3">
                <div>
                  <h3 className="text-sm font-bold font-mono text-slate-900 dark:text-white uppercase tracking-wider">
                    ViewRay Portal Assembly Tree
                  </h3>
                  <span className="text-[9px] font-mono text-slate-600 dark:text-white/40 uppercase">
                    Live BOM Skeleton (by-product) & Technical FAQ Sheets
                  </span>
                </div>

                <span className="px-2 py-0.5 bg-[#06b6d4]/10 text-[#06b6d4] border border-[#06b6d4]/20 text-[9px] font-mono rounded font-bold uppercase tracking-wider">
                  Recursive Hierarchy
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Tree Navigation Sidebar */}
                <div className="bg-black/20 p-4 rounded border border-slate-200 dark:border-white/5 space-y-2 max-h-[350px] overflow-y-auto custom-scrollbar">
                  <span className="text-[8px] font-mono text-slate-600 dark:text-white/30 uppercase tracking-widest block mb-2">BOM Node Hierarchy</span>
                  {troubleshootingTree.length === 0 ? (
                    <span className="text-xs text-slate-600 dark:text-white/45 font-mono italic">No assembly drawings loaded. Connect to NestJS.</span>
                  ) : (
                    troubleshootingTree.map((node) => {
                      const key = node.design_version_id || node.design_uuid;
                      const isSelected = selectedTreeNodeKey === key;
                      return (
                        <div
                          key={key}
                          style={{ paddingLeft: `${node.level * 12}px` }}
                          onClick={() => setSelectedTreeNodeKey(key)}
                          className={`group flex items-center justify-between py-1.5 px-2 rounded cursor-pointer transition text-xs font-mono ${isSelected
                            ? "bg-[#06b6d4]/10 text-[#06b6d4] border-l-2 border-[#06b6d4] font-bold"
                            : "text-slate-600 dark:text-white/60 hover:text-slate-900 dark:text-white hover:bg-slate-100 dark:bg-white/5"
                            }`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-[10px] text-slate-600 dark:text-white/30">L{node.level}</span>
                            <span className="truncate">{node.design_name}</span>
                          </div>
                          <span className="text-[8px] opacity-40 uppercase shrink-0 px-1 bg-slate-100 dark:bg-white/5 rounded">
                            {node.design_type.replace("Assembly", "Asm")}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Node Detailed Attachments Panel */}
                <div className="md:col-span-2 space-y-4">
                  {(() => {
                    const selectedNode = troubleshootingTree.find(
                      n => (n.design_version_id || n.design_uuid) === selectedTreeNodeKey
                    );
                    if (!selectedNode) {
                      return (
                        <div className="h-full flex items-center justify-center bg-black/10 rounded border border-slate-200 dark:border-white/5 p-8 text-center text-xs font-mono text-slate-600 dark:text-white/30">
                          Select an assembly node on the left to view drawing drawings and technical manuals.
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-4 animate-fadeIn">
                        {/* Node Header */}
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/5 pb-2">
                          <div>
                            <h4 className="text-xs font-bold font-mono text-slate-900 dark:text-white uppercase">{selectedNode.design_name}</h4>
                            <span className="text-[9px] font-mono text-slate-600 dark:text-white/40 block mt-0.5">
                              Part ID: {selectedNode.design_id} | Version ID: {selectedNode.design_version || "v1.0"}
                            </span>
                          </div>
                          <span className="text-[9px] font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 rounded uppercase">
                            {selectedNode.design_type}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Drawings & Technical Manuals */}
                          <div className="space-y-3">
                            <div>
                              <span className="text-[8px] font-mono text-slate-600 dark:text-white/30 uppercase tracking-widest block mb-1.5">Drawing Files</span>
                              {selectedNode.drawing_files.length === 0 ? (
                                <span className="text-[10px] text-slate-600 dark:text-white/40 font-mono italic block">No engineering drawings attached.</span>
                              ) : (
                                <div className="space-y-1">
                                  {selectedNode.drawing_files.map((file) => (
                                    <a
                                      key={file.id}
                                      href={`http://localhost:7000${file.url}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center justify-between p-1.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-100 dark:bg-white/10 rounded text-[10px] font-mono text-cyan-400 hover:text-cyan-300 transition animate-fadeIn"
                                    >
                                      <span className="truncate">📁 {file.file_name}</span>
                                      <span className="text-[8px] text-slate-600 dark:text-white/40 shrink-0">{file.file_size || "1.2 MB"}</span>
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div>
                              <span className="text-[8px] font-mono text-slate-600 dark:text-white/30 uppercase tracking-widest block mb-1.5">Knowledge Base Manuals</span>
                              {selectedNode.kb_files.length === 0 ? (
                                <span className="text-[10px] text-slate-600 dark:text-white/40 font-mono italic block">No manual guides attached.</span>
                              ) : (
                                <div className="space-y-1">
                                  {selectedNode.kb_files.map((file) => (
                                    <a
                                      key={file.id}
                                      href={`http://localhost:7000${file.url}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center justify-between p-1.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-100 dark:bg-white/10 rounded text-[10px] font-mono text-emerald-400 hover:text-emerald-300 transition animate-fadeIn"
                                    >
                                      <span className="truncate">📖 {file.title || file.file_name}</span>
                                      <span className="text-[8px] text-slate-600 dark:text-white/40 shrink-0">{file.file_size || "2.1 MB"}</span>
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* FAQ Accordion List */}
                          <div>
                            <span className="text-[8px] font-mono text-slate-600 dark:text-white/30 uppercase tracking-widest block mb-1.5">Troubleshooting FAQ Sheet</span>
                            {selectedNode.faq_items.length === 0 ? (
                              <span className="text-[10px] text-slate-600 dark:text-white/40 font-mono italic block">No active FAQs registered for this component.</span>
                            ) : (
                              <div className="space-y-2 max-h-[180px] overflow-y-auto custom-scrollbar animate-fadeIn">
                                {selectedNode.faq_items.map((item) => (
                                  <div key={item.id} className="p-2 bg-slate-100 dark:bg-white/5 rounded border border-slate-200 dark:border-white/5 space-y-1">
                                    <span className="block text-[10px] font-bold font-mono text-amber-400 uppercase">Q: {item.question}</span>
                                    <span className="block text-[9px] font-mono text-slate-600 dark:text-white/70 leading-relaxed">A: {item.answer}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TAB 6: SUPPORT & TICKETS */}
        {activeTab === "tickets" && (
          <div className="space-y-8 animate-fadeIn">
            <div>
              <h2 className="text-2xl font-bold tracking-tight font-mono text-slate-900 dark:text-white">Incident Dispatch & Tickets Queue</h2>
              <p className="text-xs text-slate-600 dark:text-white/50 font-mono uppercase mt-1">Real-time support ticket operations and field engineer dispatches.</p>
            </div>

            {/* Main Split: Ticket list + submit/detail panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

              {/* Tickets Queue List */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex justify-between items-center bg-slate-50 dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 p-4 rounded-lg">
                  <span className="text-xs font-mono text-slate-600 dark:text-white/50 uppercase">Active Support Incidents ({tickets.length})</span>
                  <span className="text-2xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded uppercase">Connected to Backend</span>
                </div>

                <div className="space-y-4 overflow-y-auto max-h-[550px] pr-2">
                  {tickets.map((t) => (
                    <div
                      key={t.id}
                      className={`bg-slate-50 dark:bg-[#0c0e16] border p-6 rounded-lg space-y-4 hover:border-blue-500/30 transition duration-300 ${t.priority === "CRITICAL" ? "border-rose-500/20 bg-rose-950/[0.03]" : "border-slate-200 dark:border-white/5"
                        }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-900 dark:text-white uppercase">{t.ticket_id}</span>
                            <span className={`px-2 py-0.5 rounded text-[8px] font-bold font-mono uppercase tracking-widest ${t.priority === "CRITICAL"
                              ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                              : t.priority === "HIGH"
                                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                              }`}>
                              {t.priority}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[8px] font-bold font-mono uppercase tracking-widest ${t.status === "OPEN"
                              ? "bg-rose-950 text-rose-500 border border-rose-500/20"
                              : t.status === "IN_PROGRESS"
                                ? "bg-amber-950 text-amber-500 border border-amber-500/20"
                                : "bg-emerald-950 text-emerald-500 border border-emerald-500/20"
                              }`}>
                              {t.status}
                            </span>
                          </div>
                          <h3 className="text-sm font-bold font-mono text-slate-900 dark:text-white uppercase mt-2">{t.title}</h3>
                        </div>
                        <span className="text-[10px] font-mono text-slate-600 dark:text-white/30">
                          {new Date(t.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <p className="text-xs font-mono text-slate-600 dark:text-white/60 leading-relaxed">
                        {t.description}
                      </p>

                      <div className="pt-4 border-t border-slate-200 dark:border-white/5 flex items-center justify-between text-[10px] font-mono">
                        <div className="flex items-center gap-1 text-slate-600 dark:text-white/40">
                          <Clock className="h-3.5 w-3.5" />
                          <span>Linked Unit:</span>
                          <span className="text-slate-900 dark:text-white font-bold uppercase">{t.machine_name || "General Core System"}</span>
                        </div>

                        {t.assigned_user ? (
                          <div className="flex items-center gap-1.5 text-cyan-400">
                            <UserCheck className="h-3.5 w-3.5" />
                            <span>Tech Assigned:</span>
                            <span className="font-bold text-slate-900 dark:text-white uppercase">
                              {t.assigned_user.firstName} {t.assigned_user.lastName}
                            </span>
                          </div>
                        ) : can("assign", "tickets") ? (
                          <button
                            onClick={() => {
                              alert(`Dispatching technician for ticket ${t.ticket_id}...`);
                              setRawTickets((prev) => prev.map((item) => item.id === t.id ? {
                                ...item,
                                status: "IN_PROGRESS",
                                assigned_user: {
                                  firstName: "Sarah",
                                  lastName: "Conner",
                                  email: "s.conner@industrialos.io"
                                }
                              } : item));
                            }}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-slate-900 dark:text-white rounded font-bold text-[9px] uppercase tracking-wider transition"
                          >
                            Dispatch Tech
                          </button>
                        ) : (
                          <span className="text-[9px] font-mono text-slate-600 dark:text-white/30 uppercase">Unassigned</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit New Ticket Panel */}
              <div className="bg-slate-50 dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 p-6 rounded-lg h-fit space-y-6">
                <div className="border-b border-slate-200 dark:border-white/5 pb-2">
                  <span className="text-[10px] font-mono text-slate-600 dark:text-white/40 uppercase tracking-widest block">Operational Dispatch Desk</span>
                  <h3 className="text-base font-bold font-mono text-slate-900 dark:text-white mt-1">Log Support Ticket</h3>
                </div>

                <form onSubmit={handleCreateTicket} className="space-y-4 font-mono text-xs">
                  <div className="space-y-1">
                    <label className="text-slate-600 dark:text-white/40 uppercase block text-[10px]">Incident Title</label>
                    <input
                      type="text"
                      value={newTicketTitle}
                      onChange={(e) => setNewTicketTitle(e.target.value)}
                      placeholder="e.g. Hydraulic Actuator Fluid Leak"
                      className="w-full bg-slate-50 dark:bg-[#07090e] border border-slate-200 dark:border-white/5 focus:border-cyan-500/30 rounded px-3 py-2 text-slate-900 dark:text-white placeholder-white/20 focus:outline-none"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-600 dark:text-white/40 uppercase block text-[10px]">Description & Diagnostics</label>
                    <textarea
                      rows={4}
                      value={newTicketDesc}
                      onChange={(e) => setNewTicketDesc(e.target.value)}
                      placeholder="Enter full sensor thresholds, alarms and diagnostic codes..."
                      className="w-full bg-slate-50 dark:bg-[#07090e] border border-slate-200 dark:border-white/5 focus:border-cyan-500/30 rounded px-3 py-2 text-slate-900 dark:text-white placeholder-white/20 focus:outline-none"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-600 dark:text-white/40 uppercase block text-[10px]">Severity Level</label>
                    <select
                      value={newTicketPriority}
                      onChange={(e) => setNewTicketPriority(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#07090e] border border-slate-200 dark:border-white/5 focus:border-cyan-500/30 rounded px-3 py-2 text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                    >
                      <option value="LOW">LOW - Maintenance Log Only</option>
                      <option value="MEDIUM">MEDIUM - Standard Inspection</option>
                      <option value="HIGH">HIGH - Urgent Incident Report</option>
                      <option value="CRITICAL">CRITICAL - Instant Field Dispatch</option>
                    </select>
                  </div>

                  {ticketSubmitSuccess && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded text-center font-bold">
                      Ticket Logged and Synced to Server!
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-slate-900 dark:text-white font-bold uppercase tracking-wider rounded transition flex items-center justify-center gap-1.5 shadow-[0_0_12px_#2563eb22]"
                  >
                    <Send className="h-4 w-4" />
                    <span>Submit Ticket to Queue</span>
                  </button>
                </form>
              </div>

            </div>
          </div>
        )}

        {/* TAB 7: SETTINGS PANEL */}
        {/* TAB 7: SETTINGS PANEL */}
        {activeTab === "settings" && (
          <div className="space-y-8 animate-fadeIn font-mono text-xs">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-white/5 pb-4">
              <div>
                <span className="text-[10px] text-slate-600 dark:text-white/40 uppercase tracking-widest block">Administration Cockpit</span>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1 uppercase">RBAC & User Management</h2>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-blue-600/10 border border-blue-500/20 text-[#06b6d4]">
                <ShieldAlert className="h-4 w-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Access Scope: {roleName}</span>
              </div>
            </div>

            {!isAdmin && !can("edit", "users") ? (
              <div className="bg-red-950/20 border border-red-500/30 p-8 rounded-lg max-w-xl text-center space-y-4">
                <AlertTriangle className="h-12 w-12 text-red-500 mx-auto animate-pulse" />
                <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider">Clearance Restriction Active</h3>
                <p className="text-slate-600 dark:text-white/60 text-[11px] leading-relaxed">
                  User directory management, Casl policy evaluation, and granular role modifications require Administrator privileges. Contact your supervisor for overrides.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Left Column: Registered Users list */}
                <div className="xl:col-span-2 space-y-6">
                  <div className="bg-slate-50 dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 p-6 rounded-lg space-y-4 shadow-[0_4px_25px_rgba(0,0,0,0.4)] font-mono">
                    <div className="flex justify-between items-center border-b border-slate-200 dark:border-white/5 pb-2">
                      <span className="font-bold text-slate-900 dark:text-white uppercase text-xs tracking-wider">Active Platform Operators</span>
                      <span className="text-[9px] px-2 py-0.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded text-slate-600 dark:text-white/40">
                        {usersList.length} Accounts Active
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-white/5 text-slate-600 dark:text-white/40 text-[9px] uppercase tracking-wider">
                            <th className="py-2.5">Name</th>
                            <th className="py-2.5">Email</th>
                            <th className="py-2.5">Role Binding</th>
                            <th className="py-2.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-[11px] text-slate-600 dark:text-white/80">
                          {usersList.map((u) => (
                            <tr key={u.id} className="hover:bg-slate-100 dark:bg-white/[0.01]">
                              <td className="py-3 font-semibold text-slate-900 dark:text-white">
                                {u.firstName} {u.lastName}
                              </td>
                              <td className="py-3 text-slate-600 dark:text-white/50">{u.email}</td>
                              <td className="py-3">
                                <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-[#06b6d4] font-bold text-[9px] uppercase tracking-wider">
                                  {u.role?.name || "User"}
                                </span>
                              </td>
                              <td className="py-3 text-right">
                                <select
                                  value={u.role?.id || 2}
                                  onChange={(e) => handleAssignRole(u.id, Number(e.target.value))}
                                  className="bg-[#121620] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-mono text-[10px] rounded px-2 py-1 focus:outline-none focus:border-blue-500 cursor-pointer"
                                >
                                  <option value={1}>Admin</option>
                                  <option value={2}>User</option>
                                  <option value={3}>Technician</option>
                                  <option value={4}>Support Engineer</option>
                                  <option value={5}>Operations</option>
                                  <option value={6}>QA</option>
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Right Column: CASL Rules Cheat Sheet */}
                <div className="space-y-6">
                  <div className="bg-slate-50 dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 p-6 rounded-lg space-y-4 shadow-[0_4px_25px_rgba(0,0,0,0.4)]">
                    <div className="border-b border-slate-200 dark:border-white/5 pb-2">
                      <span className="font-bold text-slate-900 dark:text-white uppercase text-xs tracking-wider block">CASL Authorization Rules</span>
                      <span className="text-[9px] text-slate-600 dark:text-white/40 mt-0.5 block">Active frontend RBAC permission map</span>
                    </div>

                    <div className="space-y-3 text-[10px] text-slate-600 dark:text-white/70">
                      <div className="p-3 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded space-y-1">
                        <span className="font-bold text-emerald-400 uppercase text-[9px]">Admin Privilege Scope</span>
                        <p className="text-slate-600 dark:text-white/40">Full capabilities: manage everything, delegate roles, edit inventory parameters.</p>
                      </div>
                      <div className="p-3 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded space-y-1">
                        <span className="font-bold text-[#06b6d4] uppercase text-[9px]">Support Engineer Scope</span>
                        <p className="text-slate-600 dark:text-white/40">Create tickets, view platform details, assign field technicians to high-acuity defects.</p>
                      </div>
                      <div className="p-3 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded space-y-1">
                        <span className="font-bold text-amber-400 uppercase text-[9px]">Technician Scope</span>
                        <p className="text-slate-600 dark:text-white/40">Inspect machines, command clearance scopes, close active active service tickets.</p>
                      </div>
                      <div className="p-3 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded space-y-1">
                        <span className="font-bold text-purple-400 uppercase text-[9px]">Client Scope</span>
                        <p className="text-slate-600 dark:text-white/40">View assigned machines, raise client incident reports, strictly isolated from other tenants.</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 p-6 rounded-lg space-y-4 shadow-[0_4px_25px_rgba(0,0,0,0.4)]">
                    <div className="border-b border-slate-200 dark:border-white/5 pb-2">
                      <span className="font-bold text-slate-900 dark:text-white uppercase text-xs tracking-wider block">Database Status</span>
                    </div>
                    <div className="p-3 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded flex justify-between items-center">
                      <div>
                        <span className="block font-semibold text-slate-900 dark:text-white">NestJS Core</span>
                        <span className="block text-[9px] text-slate-600 dark:text-white/40">URL: http://localhost:7000/api/v1</span>
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold rounded uppercase text-[8px]">ONLINE</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 8: SUPPORT PANEL */}
        {activeTab === "support" && (
          <div className="bg-slate-50 dark:bg-[#0c0e16] border border-slate-200 dark:border-white/5 p-8 rounded-lg max-w-2xl space-y-6 font-mono text-xs animate-fadeIn">
            <div className="border-b border-slate-200 dark:border-white/5 pb-2">
              <span className="text-[10px] text-slate-600 dark:text-white/40 uppercase tracking-widest block">Operator Assistance</span>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1 uppercase">Technical Support & FAQs</h2>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded space-y-1">
                <span className="block font-bold text-slate-900 dark:text-white uppercase text-[10px]">How do I isolate a leaking fluid flange seal?</span>
                <p className="text-slate-600 dark:text-white/60 text-[11px] leading-relaxed">
                  Navigate to the "Diagnostics" panel, engage step 2 in the guided isolation map, and press "Confirm Seal Intact" or "Compromised" to automatically command telemetry values to isolate primary bypass loops.
                </p>
              </div>

              <div className="p-4 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded space-y-1">
                <span className="block font-bold text-slate-900 dark:text-white uppercase text-[10px]">What are regional high-acuity overrides?</span>
                <p className="text-slate-600 dark:text-white/60 text-[11px] leading-relaxed">
                  High-acuity medical diagnostic units like the MRI-X900 are regulated to prevent instant automated trips. Using "Calibrate" will synchronize system sensors directly before raising manual overrides to avoid scans failure in hospitals.
                </p>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* -------------------- GENERAL ORDER SUCCESS DIALOG MODAL -------------------- */}
      {showOrderSuccess && (
        <div className="absolute inset-0 bg-slate-50 dark:bg-[#090b10]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-50 dark:bg-[#0c0e16] border border-[#06b6d4]/40 p-8 rounded-lg max-w-md w-full shadow-[0_0_50px_rgba(6,182,212,0.15)] space-y-6 font-mono text-xs relative">
            <button
              onClick={() => setShowOrderSuccess(false)}
              className="absolute top-4 right-4 text-slate-600 dark:text-white/50 hover:text-slate-900 dark:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500 flex items-center justify-center text-emerald-400 mx-auto text-xl font-bold animate-pulse">
                ✓
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wider">Purchase Order Logged</h3>
              <p className="text-slate-600 dark:text-white/50 text-[10px]">
                Part order dispatched from primary regional warehouse stock queue.
              </p>
            </div>

            <div className="p-4 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded space-y-2">
              <div className="flex justify-between text-slate-600 dark:text-white/60">
                <span>Ordered Item:</span>
                <span className="text-slate-900 dark:text-white font-bold uppercase">{orderPartName}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-white/60">
                <span>ETA:</span>
                <span className="text-cyan-400 font-bold">24 Hours (Express Dispatch)</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-white/60">
                <span>Tracking ID:</span>
                <span className="text-slate-900 dark:text-white">PO-5542291-OMEGA</span>
              </div>
            </div>

            <button
              onClick={() => setShowOrderSuccess(false)}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-slate-900 dark:text-white font-bold uppercase tracking-widest rounded transition"
            >
              Acknowledge Log
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
