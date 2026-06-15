export type ScheduleStatus = "Scheduled" | "In Progress" | "Overdue" | "Completed";
export type MaintenanceType = "Preventive" | "Corrective" | "Predictive";
export type Priority = "High" | "Medium" | "Low";

export interface MaintenanceSchedule {
  id: string;
  equipment: string;
  type: MaintenanceType;
  priority: Priority;
  scheduledDate: string;
  scheduledTime: string;
  lastPerformed: string;
  status: ScheduleStatus;
  assignedTo: string;
  estimatedDuration: string;
}

export const mockSchedules: MaintenanceSchedule[] = [
  { id: "MS-001", equipment: "CNC Machine #3",          type: "Preventive", priority: "High",   scheduledDate: "2026-05-28", scheduledTime: "09:00", lastPerformed: "2026-02-28", status: "Scheduled",   assignedTo: "James Otieno",  estimatedDuration: "4h"   },
  { id: "MS-002", equipment: "Assembly Robot Arm B",     type: "Corrective", priority: "High",   scheduledDate: "2026-05-22", scheduledTime: "10:30", lastPerformed: "2026-04-10", status: "Overdue",     assignedTo: "Priya Sharma",  estimatedDuration: "6h"   },
  { id: "MS-003", equipment: "Conveyor Belt A1",         type: "Preventive", priority: "Medium", scheduledDate: "2026-06-01", scheduledTime: "08:30", lastPerformed: "2026-03-01", status: "Scheduled",   assignedTo: "Carlos Mendes", estimatedDuration: "2h"   },
  { id: "MS-004", equipment: "Injection Moulding Press", type: "Predictive", priority: "Medium", scheduledDate: "2026-05-20", scheduledTime: "14:00", lastPerformed: "2026-05-20", status: "Completed",   assignedTo: "Aisha Nkosi",   estimatedDuration: "3h"   },
  { id: "MS-005", equipment: "Hydraulic Press Unit 2",   type: "Corrective", priority: "High",   scheduledDate: "2026-05-27", scheduledTime: "08:00", lastPerformed: "2026-01-15", status: "In Progress", assignedTo: "James Otieno",  estimatedDuration: "8h"   },
  { id: "MS-006", equipment: "Laser Cutter LC-200",      type: "Preventive", priority: "Low",    scheduledDate: "2026-06-10", scheduledTime: "11:00", lastPerformed: "2026-03-10", status: "Scheduled",   assignedTo: "Carlos Mendes", estimatedDuration: "1.5h" },
  { id: "MS-007", equipment: "Welding Station W4",       type: "Predictive", priority: "Medium", scheduledDate: "2026-05-15", scheduledTime: "13:30", lastPerformed: "2026-05-15", status: "Completed",   assignedTo: "Priya Sharma",  estimatedDuration: "2h"   },
  { id: "MS-008", equipment: "Packaging Line P3",        type: "Preventive", priority: "Low",    scheduledDate: "2026-05-10", scheduledTime: "09:30", lastPerformed: "—",          status: "Overdue",     assignedTo: "Aisha Nkosi",   estimatedDuration: "3h"   },
  { id: "MS-009", equipment: "CNC Machine #3",          type: "Preventive", priority: "Medium", scheduledDate: "2026-05-25", scheduledTime: "08:30", lastPerformed: "2026-02-28", status: "Scheduled",   assignedTo: "James Otieno",  estimatedDuration: "2h"   },
  { id: "MS-010", equipment: "Packaging Line P3",        type: "Preventive", priority: "Low",    scheduledDate: "2026-05-25", scheduledTime: "10:00", lastPerformed: "2026-02-25", status: "Scheduled",   assignedTo: "Aisha Nkosi",   estimatedDuration: "3h"   },
  { id: "MS-011", equipment: "Conveyor Belt A1",         type: "Preventive", priority: "Medium", scheduledDate: "2026-05-26", scheduledTime: "09:00", lastPerformed: "2026-03-01", status: "Scheduled",   assignedTo: "Carlos Mendes", estimatedDuration: "2h"   },
  { id: "MS-012", equipment: "Welding Station W4",       type: "Predictive", priority: "Medium", scheduledDate: "2026-05-26", scheduledTime: "13:00", lastPerformed: "2026-05-15", status: "Scheduled",   assignedTo: "Priya Sharma",  estimatedDuration: "2h"   },
  { id: "MS-013", equipment: "Laser Cutter LC-200",      type: "Preventive", priority: "Low",    scheduledDate: "2026-05-27", scheduledTime: "11:30", lastPerformed: "2026-03-10", status: "Scheduled",   assignedTo: "Carlos Mendes", estimatedDuration: "1.5h" },
  { id: "MS-014", equipment: "Assembly Robot Arm B",     type: "Corrective", priority: "High",   scheduledDate: "2026-05-27", scheduledTime: "14:00", lastPerformed: "2026-04-10", status: "In Progress", assignedTo: "Priya Sharma",  estimatedDuration: "5h"   },
  { id: "MS-015", equipment: "Injection Moulding Press", type: "Predictive", priority: "Medium", scheduledDate: "2026-05-28", scheduledTime: "10:30", lastPerformed: "2026-05-20", status: "Scheduled",   assignedTo: "Aisha Nkosi",   estimatedDuration: "3h"   },
  { id: "MS-016", equipment: "Packaging Line P3",        type: "Preventive", priority: "Low",    scheduledDate: "2026-05-29", scheduledTime: "09:00", lastPerformed: "2026-02-25", status: "Scheduled",   assignedTo: "Aisha Nkosi",   estimatedDuration: "2.5h" },
  { id: "MS-017", equipment: "CNC Machine #3",          type: "Preventive", priority: "High",   scheduledDate: "2026-05-29", scheduledTime: "13:30", lastPerformed: "2026-02-28", status: "Scheduled",   assignedTo: "James Otieno",  estimatedDuration: "4h"   },
  { id: "MS-018", equipment: "Conveyor Belt A1",         type: "Preventive", priority: "Medium", scheduledDate: "2026-05-30", scheduledTime: "08:00", lastPerformed: "2026-03-01", status: "Scheduled",   assignedTo: "Carlos Mendes", estimatedDuration: "2h"   },
  { id: "MS-019", equipment: "Hydraulic Press Unit 2",   type: "Corrective", priority: "High",   scheduledDate: "2026-05-31", scheduledTime: "14:30", lastPerformed: "2026-01-15", status: "Scheduled",   assignedTo: "James Otieno",  estimatedDuration: "3h"   },
  { id: "MS-020", equipment: "Welding Station W4",       type: "Corrective", priority: "High",   scheduledDate: "2026-05-26", scheduledTime: "08:00", lastPerformed: "2026-04-20", status: "Overdue",     assignedTo: "Priya Sharma",  estimatedDuration: "4h"   },
  { id: "MS-021", equipment: "Laser Cutter LC-200",      type: "Predictive", priority: "Medium", scheduledDate: "2026-05-28", scheduledTime: "14:30", lastPerformed: "2026-03-10", status: "Scheduled",   assignedTo: "Carlos Mendes", estimatedDuration: "2h"   },
  { id: "MS-022", equipment: "Injection Moulding Press", type: "Corrective", priority: "High",   scheduledDate: "2026-05-25", scheduledTime: "13:00", lastPerformed: "2026-04-01", status: "Overdue",     assignedTo: "Aisha Nkosi",   estimatedDuration: "5h"   },
  { id: "MS-023", equipment: "CNC Machine #3",          type: "Preventive", priority: "High",   scheduledDate: "2026-06-15", scheduledTime: "09:00", lastPerformed: "2026-03-15", status: "Scheduled",   assignedTo: "James Otieno",  estimatedDuration: "4h"   },
  { id: "MS-024", equipment: "Assembly Robot Arm B",     type: "Preventive", priority: "Medium", scheduledDate: "2026-06-15", scheduledTime: "11:00", lastPerformed: "2026-04-15", status: "Scheduled",   assignedTo: "Priya Sharma",  estimatedDuration: "3h"   },
  { id: "MS-025", equipment: "Conveyor Belt A1",         type: "Predictive", priority: "Low",    scheduledDate: "2026-06-16", scheduledTime: "08:00", lastPerformed: "2026-04-01", status: "Scheduled",   assignedTo: "Carlos Mendes", estimatedDuration: "2h"   },
  { id: "MS-026", equipment: "Hydraulic Press Unit 2",   type: "Preventive", priority: "High",   scheduledDate: "2026-06-17", scheduledTime: "10:00", lastPerformed: "2026-03-17", status: "Scheduled",   assignedTo: "James Otieno",  estimatedDuration: "5h"   },
  { id: "MS-027", equipment: "Laser Cutter LC-200",      type: "Corrective", priority: "Medium", scheduledDate: "2026-06-18", scheduledTime: "13:00", lastPerformed: "2026-04-18", status: "Scheduled",   assignedTo: "Carlos Mendes", estimatedDuration: "2.5h" },
  { id: "MS-028", equipment: "Welding Station W4",       type: "Preventive", priority: "Low",    scheduledDate: "2026-06-19", scheduledTime: "09:30", lastPerformed: "2026-04-19", status: "Scheduled",   assignedTo: "Priya Sharma",  estimatedDuration: "1.5h" },
  { id: "MS-029", equipment: "Injection Moulding Press", type: "Preventive", priority: "Medium", scheduledDate: "2026-06-20", scheduledTime: "14:00", lastPerformed: "2026-04-20", status: "Scheduled",   assignedTo: "Aisha Nkosi",   estimatedDuration: "3h"   },
  { id: "MS-030", equipment: "Packaging Line P3",        type: "Predictive", priority: "Low",    scheduledDate: "2026-06-21", scheduledTime: "10:30", lastPerformed: "2026-04-21", status: "Scheduled",   assignedTo: "Aisha Nkosi",   estimatedDuration: "2h"   },
];
