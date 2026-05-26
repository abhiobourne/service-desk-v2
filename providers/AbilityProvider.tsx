"use client";

import { createContext, useContext, useMemo, ReactNode } from "react";
import { useAuth } from "./AuthProvider";

// ---------------------------------------------------------------------------
// Types — mirroring the backend's abilities.ts Actions / Subjects
// ---------------------------------------------------------------------------

export type BackendAction =
  | "manage"
  | "create"
  | "read"
  | "update"
  | "delete"
  | "browse"
  | "add"
  | "edit"
  | "approve"
  | "reject"
  | "hold"
  | "submit"
  | "assign"
  | "change_status"
  // UI-level aliases kept for page.tsx compatibility
  | "view"
  | "access";

export type BackendSubject =
  | "all"
  | "User"
  | "users"
  | "Role"
  | "roles"
  | "Permission"
  | "permissions"
  | "knowledgebases"
  | "KnowledgebaseItems"
  | "clients"
  | "client_users"
  | "locations"
  | "user_jurisdictions"
  | "jurisdiction_overrides"
  | "products"
  | "faqs"
  // UI-level subjects kept for page.tsx compatibility
  | "tickets"
  | "inspections"
  | "qa"
  | "inventory"
  | "settings"
  | "own_data"
  | "technicians";

interface AbilityContextType {
  /** CASL-style permission check */
  can: (action: BackendAction, subject: BackendSubject) => boolean;
  /** Primary display role name (from ViewRay roles or fallback) */
  roleName: string;
  /** All ViewRay roles assigned to this user */
  roleNames: string[];
  /** Whether the current user is an admin */
  isAdmin: boolean;
  /** Whether the current user is a client */
  isClient: boolean;
  /** Whether the current user is a technician */
  isTechnician: boolean;
}

const AbilityContext = createContext<AbilityContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Role slug / name normalisation helpers
// ---------------------------------------------------------------------------

function normalise(s: string | undefined | null): string {
  return (s || "").toLowerCase().trim().replace(/[\s_-]+/g, "");
}

const ADMIN_SLUGS = new Set(["admin", "administrator", "superadmin"]);
const CLIENT_SLUGS = new Set(["client", "clientuser", "clientadmin"]);
const TECHNICIAN_SLUGS = new Set(["technician", "tech", "fieldtech"]);
const SUPPORT_SLUGS = new Set(["supportengineer", "support", "supportstaff"]);
const OPERATIONS_SLUGS = new Set(["operations", "ops"]);
const QA_SLUGS = new Set(["qa", "qualityassurance", "qualityassuranceengineer"]);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AbilityProvider({ children }: { children: ReactNode }) {
  const { user, isClientUser, isUserTechnician } = useAuth();

  const { roleNames, isAdmin, isClient, isTechnician, isSupport, isOperations, isQA } =
    useMemo(() => {
      const viewRayRoles = user?.roles || [];
      const names = viewRayRoles.map((r) => r.name);

      const slugSet = new Set(
        viewRayRoles.flatMap((r) => [normalise(r.name), normalise(r.slug)]),
      );

      // Also factor in basic role
      const basicRoleId = user?.role?.id;

      const _isAdmin =
        slugSet.size > 0
          ? [...slugSet].some((s) => ADMIN_SLUGS.has(s))
          : basicRoleId === 1;

      const _isClient =
        isClientUser ||
        [...slugSet].some((s) => CLIENT_SLUGS.has(s)) ||
        basicRoleId === 3;

      const _isTechnician =
        isUserTechnician || [...slugSet].some((s) => TECHNICIAN_SLUGS.has(s));

      const _isSupport = [...slugSet].some((s) => SUPPORT_SLUGS.has(s));
      const _isOperations = [...slugSet].some((s) => OPERATIONS_SLUGS.has(s));
      const _isQA = [...slugSet].some((s) => QA_SLUGS.has(s));

      return {
        roleNames: names,
        isAdmin: _isAdmin,
        isClient: _isClient,
        isTechnician: _isTechnician,
        isSupport: _isSupport,
        isOperations: _isOperations,
        isQA: _isQA,
      };
    }, [user, isClientUser, isUserTechnician]);

  /** Primary display name for the role badge */
  const roleName = useMemo(() => {
    if (!user) return "Guest";
    if (roleNames.length > 0) return roleNames[0];
    return user.role?.name || "User";
  }, [user, roleNames]);

  /**
   * CASL-style ability check.
   * Priority: admin > granular permissions > role-based defaults > deny.
   */
  const can = useMemo(() => {
    return (action: BackendAction, subject: BackendSubject): boolean => {
      if (!user) return false;

      // Admin has unrestricted access
      if (isAdmin) return true;

      // --- Granular permission check ---
      // Permission labels are stored as "subject.action" e.g. "user.read", "tickets.create"
      const permissions = user.permissions || [];
      const subjectKey = subject.toLowerCase();
      const actionKey = action.toLowerCase();

      for (const perm of permissions) {
        const [permSubject, permAction] = perm.name.toLowerCase().split(".");
        if (!permSubject || !permAction) continue;
        const subjectMatch = permSubject === subjectKey || permSubject === "all";
        const actionMatch =
          permAction === actionKey ||
          permAction === "manage" ||
          // "edit" covers "update"
          (permAction === "edit" && actionKey === "update") ||
          // "add" covers "create"
          (permAction === "add" && actionKey === "create") ||
          // "browse" covers "read" and "view"
          (permAction === "browse" && (actionKey === "read" || actionKey === "view"));
        if (subjectMatch && actionMatch) return true;
      }

      // --- Role-based fallback rules ---

      if (isSupport) {
        if (subject === "users" || subject === "User") return false;
        if (action === "assign" && (subject === "technicians" || subject === "tickets")) return true;
        if (subject === "tickets" || subject === "inventory") return true;
        return ["read", "view", "create", "browse"].includes(action);
      }

      if (isTechnician) {
        if (subject === "users" || subject === "User" || subject === "technicians") return false;
        if (subject === "inspections") return true;
        if (subject === "tickets" && ["read", "view", "update", "change_status"].includes(action)) return true;
        return ["read", "view", "browse"].includes(action);
      }

      if (isOperations) {
        if (subject === "users" || subject === "User") return false;
        return ["read", "view", "browse", "access", "update"].includes(action);
      }

      if (isQA) {
        if (subject === "qa") return true;
        if (subject === "users" || subject === "User" || subject === "technicians") return false;
        return ["read", "view", "browse"].includes(action);
      }

      if (isClient) {
        if (["users", "User", "technicians", "qa"].includes(subject)) return false;
        if (subject === "own_data") return true;
        if (subject === "tickets" && ["read", "create", "view"].includes(action)) return true;
        return ["read", "view"].includes(action);
      }

      // Unknown / no role — deny everything sensitive
      return ["read", "view", "browse"].includes(action);
    };
  }, [user, isAdmin, isSupport, isTechnician, isOperations, isQA, isClient]);

  return (
    <AbilityContext.Provider
      value={{ can, roleName, roleNames, isAdmin, isClient, isTechnician }}
    >
      {children}
    </AbilityContext.Provider>
  );
}

export function useAbility() {
  const context = useContext(AbilityContext);
  if (context === undefined) {
    throw new Error("useAbility must be nested within an AbilityProvider");
  }
  return context;
}
