"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MaintType =
  | "Preventive"
  | "Inspection"
  | "Emergency"
  | "Calibration"
  | "Replacement"
  | "Diagnostic";

export type MaintPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type MaintStatus = "upcoming" | "in-progress" | "completed" | "overdue";

export interface MaintenanceEvent {
  id: string;
  title: string;
  type: MaintType;
  category: string;
  technician: string;
  priority: MaintPriority;
  description?: string;
  scheduledDate: string; // "YYYY-MM-DD"
  duration: number;       // hours
  module?: string;
  status: MaintStatus;
  createdAt: string;      // ISO timestamp
}

// ─── Seed data (matches reference image for May 2026) ────────────────────────

const SEED_EVENTS: MaintenanceEvent[] = [
  {
    id: "seed-001",
    title: "Infusion Pump routine",
    type: "Preventive",
    category: "Fluid Management",
    technician: "D. Sharma",
    priority: "LOW",
    description: "Regular preventive maintenance for BD Alaris infusion pump. Tubing inspection and flow rate verification.",
    scheduledDate: "2026-05-02",
    duration: 2,
    module: "Pump Assembly",
    status: "completed",
    createdAt: "2026-04-15T09:00:00Z",
  },
  {
    id: "seed-002",
    title: "ECG calibration",
    type: "Calibration",
    category: "Cardiology Equipment",
    technician: "A. Mehta",
    priority: "MEDIUM",
    description: "Annual ECG machine calibration and lead integrity check.",
    scheduledDate: "2026-05-05",
    duration: 3,
    module: "ECG Unit",
    status: "completed",
    createdAt: "2026-04-20T10:00:00Z",
  },
  {
    id: "seed-003",
    title: "X-Ray PM",
    type: "Preventive",
    category: "Radiology",
    technician: "R. Patel",
    priority: "HIGH",
    description: "Preventive maintenance for Siemens Ysio X-Ray unit. Detector calibration and exposure verification.",
    scheduledDate: "2026-05-10",
    duration: 4,
    module: "X-Ray Generator",
    status: "completed",
    createdAt: "2026-04-20T10:00:00Z",
  },
  {
    id: "seed-004",
    title: "Defib inspection",
    type: "Inspection",
    category: "Emergency Equipment",
    technician: "S. Kumar",
    priority: "HIGH",
    description: "Quarterly defibrillator inspection and battery load test.",
    scheduledDate: "2026-05-12",
    duration: 2,
    module: "Defibrillator Unit",
    status: "completed",
    createdAt: "2026-04-25T10:00:00Z",
  },
  {
    id: "seed-005",
    title: "MRI Annual Service",
    type: "Preventive",
    category: "Cryogenic System",
    technician: "D. Sharma",
    priority: "CRITICAL",
    description: "Annual coil inspection overdue since April 2026. RF coil impedance and SNR verification required.",
    scheduledDate: "2026-05-15",
    duration: 8,
    module: "RF Coil Assembly",
    status: "overdue",
    createdAt: "2026-04-01T10:00:00Z",
  },
  {
    id: "seed-006",
    title: "CT overdue",
    type: "Calibration",
    category: "Radiology",
    technician: "A. Mehta",
    priority: "CRITICAL",
    description: "CT scanner calibration overdue. Gantry tilt and HU calibration required.",
    scheduledDate: "2026-05-20",
    duration: 6,
    module: "Gantry Assembly",
    status: "overdue",
    createdAt: "2026-04-01T10:00:00Z",
  },
  {
    id: "seed-007",
    title: "Gradient coil check",
    type: "Inspection",
    category: "Gradient System",
    technician: "R. Patel",
    priority: "HIGH",
    description: "Pre-maintenance gradient coil eddy current and linearity inspection.",
    scheduledDate: "2026-05-27",
    duration: 3,
    module: "Gradient Coils",
    status: "in-progress",
    createdAt: "2026-05-20T10:00:00Z",
  },
  {
    id: "seed-008",
    title: "Helium refill",
    type: "Replacement",
    category: "Cryogenic System",
    technician: "D. Sharma",
    priority: "CRITICAL",
    description: "Scheduled liquid helium refill. Cryo level dropped to 68% — refill to ≥95% required.",
    scheduledDate: "2026-05-27",
    duration: 4,
    module: "Cryostat",
    status: "in-progress",
    createdAt: "2026-05-20T10:00:00Z",
  },
  {
    id: "seed-009",
    title: "RF system diagnostic",
    type: "Diagnostic",
    category: "RF System",
    technician: "A. Mehta",
    priority: "MEDIUM",
    description: "Full RF amplifier and transmitter chain diagnostic scan.",
    scheduledDate: "2026-05-27",
    duration: 2,
    module: "RF Transmitter",
    status: "upcoming",
    createdAt: "2026-05-20T10:00:00Z",
  },
  {
    id: "seed-010",
    title: "Ventilator PM",
    type: "Preventive",
    category: "ICU Equipment",
    technician: "S. Kumar",
    priority: "HIGH",
    description: "Filter replacement and flow sensor calibration for Dräger Evita V800.",
    scheduledDate: "2026-05-28",
    duration: 3,
    module: "Ventilator Assembly",
    status: "upcoming",
    createdAt: "2026-05-20T10:00:00Z",
  },
  {
    id: "seed-011",
    title: "Magnet room safety",
    type: "Inspection",
    category: "Safety Systems",
    technician: "D. Sharma",
    priority: "MEDIUM",
    description: "Monthly MRI room quench pipe and safety zone inspection.",
    scheduledDate: "2026-06-05",
    duration: 2,
    module: "Magnet Room",
    status: "upcoming",
    createdAt: "2026-05-20T10:00:00Z",
  },
  {
    id: "seed-012",
    title: "Cooling circuit PM",
    type: "Preventive",
    category: "Cooling Circuit",
    technician: "R. Patel",
    priority: "HIGH",
    description: "Chiller unit maintenance: coolant flush and pump bearing check.",
    scheduledDate: "2026-06-12",
    duration: 4,
    module: "Cooling System",
    status: "upcoming",
    createdAt: "2026-05-20T10:00:00Z",
  },
  {
    id: "seed-013",
    title: "Power supply audit",
    type: "Inspection",
    category: "Power Supply",
    technician: "S. Kumar",
    priority: "MEDIUM",
    description: "UPS and gradient power supply voltage rail audit.",
    scheduledDate: "2026-06-18",
    duration: 3,
    module: "Power Distribution",
    status: "upcoming",
    createdAt: "2026-05-20T10:00:00Z",
  },
  {
    id: "seed-014",
    title: "Patient table service",
    type: "Preventive",
    category: "Patient Table",
    technician: "A. Mehta",
    priority: "LOW",
    description: "Patient table drive motor and limit switch maintenance.",
    scheduledDate: "2026-06-25",
    duration: 2,
    module: "Patient Table",
    status: "upcoming",
    createdAt: "2026-05-20T10:00:00Z",
  },
];

const STORAGE_KEY = "maintenance_events_v1";

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMaintenanceStorage() {
  const [events, setEvents] = useState<MaintenanceEvent[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: MaintenanceEvent[] = JSON.parse(raw);
        setEvents(parsed.length ? parsed : SEED_EVENTS);
      } else {
        setEvents(SEED_EVENTS);
      }
    } catch {
      setEvents(SEED_EVENTS);
    }
    setHydrated(true);
  }, []);

  const persist = useCallback((next: MaintenanceEvent[]) => {
    setEvents(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const addEvent = useCallback((ev: Omit<MaintenanceEvent, "id" | "createdAt">) => {
    const full: MaintenanceEvent = {
      ...ev,
      id: `maint-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    persist([...events, full]);
    return full;
  }, [events, persist]);

  const updateEvent = useCallback((id: string, patch: Partial<MaintenanceEvent>) => {
    persist(events.map(e => e.id === id ? { ...e, ...patch } : e));
  }, [events, persist]);

  const deleteEvent = useCallback((id: string) => {
    persist(events.filter(e => e.id !== id));
  }, [events, persist]);

  const resetToSeed = useCallback(() => {
    persist(SEED_EVENTS);
  }, [persist]);

  return { events, hydrated, addEvent, updateEvent, deleteEvent, resetToSeed };
}
