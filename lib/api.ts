/**
 * API Client — Industrial OS Frontend V2
 * Connects to NestJS backend. All auth uses JWT from AuthProvider.
 * No auto-login: token must be set via loginEmail() or session hydration.
 */

const API_BASE_URL = "http://localhost:7000/api/v1";

// ---------------------------------------------------------------------------
// Token management — module-level cache kept in sync by AuthProvider
// ---------------------------------------------------------------------------

let _memoryToken: string | null = null;

export function setApiToken(token: string | null): void {
  _memoryToken = token;
  if (typeof window !== "undefined") {
    if (token) {
      window.localStorage.setItem("industrial_os_token", token);
    } else {
      window.localStorage.removeItem("industrial_os_token");
      window.localStorage.removeItem("industrial_os_refresh");
      window.localStorage.removeItem("industrial_os_user");
    }
  }
}

export function getApiToken(): string | null {
  if (_memoryToken) return _memoryToken;
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem("industrial_os_token");
    if (stored) {
      _memoryToken = stored;
      return stored;
    }
  }
  return null;
}

export function getStoredRefreshToken(): string | null {
  if (typeof window !== "undefined") {
    return window.localStorage.getItem("industrial_os_refresh");
  }
  return null;
}

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export interface ApiUserRole {
  id: string;
  name: string;
  slug?: string;
  description?: string;
}

export interface ApiUserPermission {
  id: string;
  name: string; // "subject.action" format, e.g. "user.read", "tickets.create"
}

export interface ApiClientCard {
  id: string;
  name: string;
  logo?: string;
  email?: string;
}

export interface ApiClientOption {
  id: string;
  name: string;
  email?: string;
  status?: string;
}

export interface ApiUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  /** Basic RoleEnum role (admin=1, user=2, client=3) */
  role?: { id: number; name: string };
  status?: { id: number; name: string } | string;
  client?: { id: string; name: string };
  /** ViewRay granular RBAC roles */
  roles?: ApiUserRole[];
  /** Granular permissions in "subject.action" format */
  permissions?: ApiUserPermission[];
  clientIds?: string[];
}

export interface ApiLoginResponse {
  token: string;
  refreshToken: string;
  tokenExpires: number;
  user: ApiUser;
  isClientUser: boolean;
  isUserTechnician: boolean;
  clients: ApiClientCard[];
  mfa_enabled?: boolean;
  mfaSessionToken?: string;
}

export interface ApiMachine {
  id: string;
  name: string;
  machine_id: string;
  type: string;
  status: string;
  last_maintenance_date: string;
  next_maintenance_date: string;
}

export interface ApiTicket {
  id: string;
  ticket_id: string;
  title: string;
  description: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  machine_id?: string;
  machine_name?: string;
  assigned_to?: string;
  assigned_user?: {
    firstName: string;
    lastName: string;
    email: string;
  };
  created_at: string;
  updated_at: string;
}

export interface ApiTechnician {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  tickets_solved: number;
  active_tickets: number;
  mode?: "Remote" | "On-site" | "Both";
  avatar?: string;
}

export interface ApiRole {
  id: string | number;
  name: string;
  slug?: string;
  description?: string;
}

export interface TroubleshootingDesignNode {
  design_id: string;
  design_uuid: string;
  design_name: string;
  design_type: string;
  design_version_id: string;
  design_version: string;
  level: number;
  parent_design_uuid: string | null;
  parent_version_id: string | null;
  root_design_id: string;
  root_design_name: string;
  drawing_files: Array<{
    id: string;
    file_name: string;
    file_type: string;
    file_size: string;
    path: string;
    url: string;
  }>;
  kb_files: Array<{
    id: string;
    file_name: string;
    file_type: string;
    file_size: string;
    title: string;
    path: string;
    url: string;
  }>;
  faq_items: Array<{
    id: string;
    question: string;
    answer: string;
  }>;
}

export interface TroubleshootingByProductResponse {
  success: boolean;
  product_glb?: string | null;
  data: TroubleshootingDesignNode[];
}

export interface ApiProductCatalog {
  id: string;           // UUID — what troubleshooting/by-product needs
  product_id: string;   // PROD-XXXXXX display identifier
  product_name: string;
  status?: string;
}

export interface ApiPartCatalogItem {
  id: string;
  part_number: string;
  name: string;
  type: string;
  product_id: string;
  product_name: string;
  version?: string | null;
  status: string;
  stock: number;
  reorder_point: number;
  location: string;
  supplier: string;
  unit_cost: number;
  lead_time_days: number;
  last_ordered?: string | null;
}

export interface ApiPartOrderHistoryItem {
  id: string;
  order_id: string;
  part_id: string;
  part_name: string;
  status: string;
  quantity: number;
  ordered_at: string;
  client_name?: string | null;
}

export interface ApiDeploymentMarker {
  name: string;
  coordinates: [number, number];
  status: "nominal" | "critical" | "warning";
  detail?: string;
  address?: string;
  client_name?: string | null;
  order_id?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function authHeaders(): Record<string, string> {
  const token = getApiToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

function stripHtml(html: string): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "").trim();
}

// ---------------------------------------------------------------------------
// Auth APIs
// ---------------------------------------------------------------------------

/**
 * Login with email/password. Persists tokens to localStorage and module cache.
 */
export async function loginEmail(email: string, password: string): Promise<ApiLoginResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/email/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();

  if (!res.ok || !data.token) {
    const message =
      data?.message ||
      data?.error ||
      "Invalid credentials or login service offline.";
    throw new Error(message);
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem("industrial_os_token", data.token);
    window.localStorage.setItem("industrial_os_refresh", data.refreshToken);
    window.localStorage.setItem("industrial_os_user", JSON.stringify(data.user));
  }
  _memoryToken = data.token;
  return data as ApiLoginResponse;
}

/**
 * Logout — clears server session and local tokens.
 */
export async function logoutEmail(): Promise<void> {
  try {
    const token = getApiToken();
    if (token) {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
    }
  } catch {
    // offline logout is fine
  }
  setApiToken(null);
}

/**
 * Fetch the currently authenticated user's full profile.
 * Optionally scoped to a specific client via clientId.
 */
export async function fetchMe(clientId?: string): Promise<ApiUser> {
  const url = clientId
    ? `${API_BASE_URL}/auth/me?clientId=${encodeURIComponent(clientId)}`
    : `${API_BASE_URL}/auth/me`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error("Unauthorized or expired session.");
  return res.json();
}

/**
 * Refresh access token using stored refresh token.
 */
export async function refreshTokenAction(refreshToken: string): Promise<{
  token: string;
  tokenExpires: number;
  refreshToken: string;
}> {
  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${refreshToken}`,
    },
  });
  if (!res.ok) throw new Error("Failed to refresh session token.");
  const data = await res.json();
  setApiToken(data.token);
  if (typeof window !== "undefined") {
    window.localStorage.setItem("industrial_os_refresh", data.refreshToken);
  }
  return data;
}

// ---------------------------------------------------------------------------
// Machines
// ---------------------------------------------------------------------------

export async function fetchMachines(): Promise<ApiMachine[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/machines`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data && Array.isArray(data.items)) {
      return data.items.map((m: any) => ({
        id: m.id,
        name: m.name,
        machine_id: m.machine_id || m.id,
        type: m.type || "System Unit",
        status: m.status || "ACTIVE",
        last_maintenance_date: m.last_maintenance_date || new Date().toISOString(),
        next_maintenance_date: m.next_maintenance_date || new Date().toISOString(),
      }));
    }
    return [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

export async function fetchTickets(): Promise<ApiTicket[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/ticketing`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data && Array.isArray(data.items)) {
      return data.items.map((t: any) => ({
        id: t.id,
        ticket_id: t.ticket_id || t.id,
        title: stripHtml(t.reason || t.title || "Incident Report"),
        description: stripHtml(t.description || "System anomaly detected."),
        status: (t.status || "OPEN").toUpperCase() as ApiTicket["status"],
        priority: (t.priority || "HIGH").toUpperCase() as ApiTicket["priority"],
        machine_id: t.product_uuid || t.machine_id,
        machine_name: t.product_name || t.parts?.[0]?.part_name || "Industrial Unit",
        assigned_to: t.assignee || t.user_id,
        assigned_user: t.user_details
          ? {
              firstName: t.user_details.firstName || "Super",
              lastName: t.user_details.lastName || "Admin",
              email: t.user_details.email || "admin@industrialos.io",
            }
          : undefined,
        created_at: t.createdAt || t.created_at || new Date().toISOString(),
        updated_at: t.updatedAt || t.updated_at || new Date().toISOString(),
      }));
    }
    return [];
  } catch {
    return [];
  }
}

export async function createTicket(
  title: string,
  description: string,
  priority: string,
  _machineId?: string,
): Promise<boolean> {
  try {
    const token = getApiToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const formData = new FormData();
    formData.append("reason", `<p>${title}</p>`);
    formData.append("description", `<p>${description}</p>`);
    formData.append("priority", priority.toLowerCase());
    formData.append("client_uuid", "f355a7db-000e-4c64-adca-76843acb548c");
    formData.append("product_uuid", "04c16bd4-eb70-49a9-a5d9-5c8de77665ec");
    formData.append("billing_address", "Local Operations Terminal, 160053");
    formData.append("shipping_address", "Local Operations Terminal, 160053");

    const res = await fetch(`${API_BASE_URL}/ticketing`, {
      method: "POST",
      headers,
      body: formData,
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Technicians
// ---------------------------------------------------------------------------

export async function fetchTechnicians(): Promise<ApiTechnician[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/ticketing/stats/technicians`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data?.success && Array.isArray(data.data)) {
      return data.data.map((tech: any) => ({
        id: tech.technician_id,
        firstName: tech.firstName,
        lastName: tech.lastName,
        email: tech.email,
        tickets_solved: tech.tickets_solved || 0,
        active_tickets: tech.active_tickets || 0,
        mode: tech.mode || "Both",
        avatar: `${tech.firstName?.[0] || "?"}${tech.lastName?.[0] || "?"}`,
      }));
    }
    return [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function fetchUsers(): Promise<ApiUser[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/users`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.items || [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Roles — ViewRay granular roles (used for CASL / RBAC)
// ---------------------------------------------------------------------------

export async function fetchRoles(): Promise<ApiRole[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/roles`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    // API returns { data: [...], meta: {...} } or plain array
    const items = Array.isArray(data) ? data : data?.data || data?.items || [];
    return items.map((r: any) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
    }));
  } catch {
    // Fallback to well-known role list for offline/demo use
    return [
      { id: "1", name: "Admin", slug: "admin" },
      { id: "2", name: "User", slug: "user" },
      { id: "3", name: "Technician", slug: "technician" },
      { id: "4", name: "Support Engineer", slug: "support-engineer" },
      { id: "5", name: "Operations", slug: "operations" },
      { id: "6", name: "QA", slug: "qa" },
      { id: "7", name: "Client", slug: "client" },
    ];
  }
}

/**
 * Fetch granular ViewRay roles assigned to a specific user.
 * Uses GET /api/v1/user/:id/roles
 */
export async function fetchUserRoles(userId: string): Promise<ApiUserRole[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/user/${userId}/roles`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data?.roles || [];
  } catch {
    return [];
  }
}

/**
 * Assign ViewRay roles to a user.
 * Uses POST /api/v1/assign/user/roles with role_id as JSON array string.
 */
export async function assignUserViewRayRoles(
  userId: string,
  roleIds: string[],
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/assign/user/roles`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        user_id: userId,
        role_id: JSON.stringify(roleIds),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Update user's basic role via PATCH /users/:id.
 * Used for legacy role dropdown in settings.
 */
export async function assignUserRole(userId: string, roleId: number): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/users/${userId}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ role: { id: roleId } }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export async function fetchClientsByUser(userId: string): Promise<ApiClientCard[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/clients/by-user/${userId}`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const items = Array.isArray(data) ? data : data?.data || data?.items || [];
    return items.map((c: any) => ({
      id: c.id,
      name: c.name,
      logo: c.logo,
      email: c.email,
    }));
  } catch {
    return [];
  }
}

export async function fetchClients(params?: { search?: string; limit?: number }): Promise<ApiClientOption[]> {
  try {
    const q = new URLSearchParams();
    q.set("limit", String(params?.limit ?? 100));
    if (params?.search) q.set("search", params.search);
    const res = await fetch(`${API_BASE_URL}/clients?${q}`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const items = Array.isArray(data) ? data : data?.items ?? data?.data ?? [];
    return items.map((c: any) => ({
      id: c.id,
      name: c.name || c.commercialName || c.company_name || c.email || c.id,
      email: c.email,
      status: c.status?.name || c.status,
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Troubleshooting / ViewRay Portal
// ---------------------------------------------------------------------------

export async function fetchTroubleshootingByProduct(
  productId: string,
): Promise<TroubleshootingByProductResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/troubleshooting/by-product/${productId}`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return { success: true, product_glb: null, data: [] };
  }
}

// ---------------------------------------------------------------------------
// Ticketing — full order ticket types
// ---------------------------------------------------------------------------

export interface OrderTicket {
  id: string;
  ticket_id: string;
  order_id: string;
  order_uuid?: string | null;
  client_id: string;
  client_name?: string | null;
  user_id: string | null;
  user_name?: string | null;
  reason?: string;
  description?: string | null;
  status: string;
  happy_code?: string | null;
  product_id?: string | null;
  product_uuid?: string | null;
  designs?: Array<{ design_id: string; design_uuid?: string; design_name?: string; tree_id?: string; quantity?: number }>;
  attachments_url?: string | string[] | null;
  parts?: Array<{
    design_uuid: string;
    part_name: string;
    part_type: string;
    part_version: string | null;
    troubleshooting_url?: string | null;
  }> | null;
  items: Array<{ id?: string; product_id: string; product_name: string; product_uuid?: string; quantity?: number }>;
  assignee_details?: { id: string; firstName?: string | null; lastName?: string | null } | null;
  createdAt: string;
  updatedAt?: string;
}

export interface OrderTicketMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface JurisdictionRecord {
  id: string;
  user_id: string;
  user?: { id?: string; firstName?: string; lastName?: string; email?: string };
  mode?: string | null;
  level_id?: string | null;
  level?: { id: string; name: string; rank: number } | null;
  location?: { id: string; name?: string; city?: string } | null;
  knowledge?: Array<{ product_id: string; product_name?: string; designs: Array<{ id: string; name: string }> }> | null;
}

export interface JurisdictionLevel {
  id: string;
  name: string;
  rank: number;
}

export interface InventoryOrder {
  id: string;
  order_id: string;
  status?: string;
  items?: Array<{ product_id: string; product_name: string; product_uuid?: string; quantity?: number }>;
  line_items?: Array<{ product_id: string; product_name: string; product_uuid?: string; quantity?: number }>;
}

export interface TicketInspectionRecord {
  id: string;
  ticket_id: string;
  inspected_by: string;
  inspector_name?: string | null;
  part_name?: string | null;
  inspection: string;
  result: string;
  action: string;
  notes: string | null;
  attachments_url: string[] | null;
  createdAt: string;
}

export interface DesignTreeNode {
  id: string;
  design_id: string;
  design_name: string;
  design_type?: string;
  children?: DesignTreeNode[];
}

function authHeadersNoContentType(): Record<string, string> {
  const token = getApiToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export async function fetchTicketsPaginated(params: {
  page?: number; limit?: number; search?: string;
  orderBy?: string; order?: string; client_id?: string;
}): Promise<{ items: OrderTicket[]; meta: OrderTicketMeta }> {
  try {
    const q = new URLSearchParams();
    if (params.page) q.set("page", String(params.page));
    if (params.limit) q.set("limit", String(params.limit));
    if (params.search) q.set("search", params.search);
    if (params.orderBy) q.set("orderBy", params.orderBy);
    if (params.order) q.set("order", params.order);
    if (params.client_id) q.set("client_id", params.client_id);
    const res = await fetch(`${API_BASE_URL}/ticketing?${q}`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const items: OrderTicket[] = (data.items ?? []).map((t: any) => ({ ...t }));
    const rawMeta = data.meta ?? {};
    const meta: OrderTicketMeta = {
      total: rawMeta.totalItems ?? rawMeta.total ?? items.length,
      page: rawMeta.currentPage ?? rawMeta.page ?? (params.page ?? 1),
      limit: rawMeta.limit ?? (params.limit ?? 10),
      totalPages: rawMeta.totalPages ?? Math.ceil((rawMeta.totalItems ?? items.length) / (params.limit ?? 10)),
    };
    return { items, meta };
  } catch {
    return { items: [], meta: { total: 0, page: 1, limit: 10, totalPages: 1 } };
  }
}

export async function fetchOrderTicketById(id: string): Promise<OrderTicket | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/ticketing/${id}`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.data ?? data ?? null;
  } catch { return null; }
}

export async function updateOrderTicketStatus(id: string, status: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/ticketing/${id}/status`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ status }),
    });
    return res.ok;
  } catch { return false; }
}

export async function assignOrderTicketToUser(id: string, userId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/ticketing/${id}/assign`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ user_id: userId }),
    });
    return res.ok;
  } catch { return false; }
}

export async function resolveOrderTicketWithCode(id: string, happyCode: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/ticketing/${id}/resolve`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ happy_code: happyCode }),
    });
    return res.ok;
  } catch { return false; }
}

export async function createOrderTicket(formData: FormData): Promise<OrderTicket | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/ticketing`, {
      method: "POST",
      headers: authHeadersNoContentType(),
      body: formData,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.data ?? data ?? null;
  } catch { return null; }
}

export async function fetchOrdersByClient(clientId: string, status?: string): Promise<InventoryOrder[]> {
  try {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    const res = await fetch(`${API_BASE_URL}/ticketing/orders/by-client/${clientId}?${q}`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.items ?? [];
  } catch { return []; }
}

export async function fetchTicketInspections(ticketId: string): Promise<TicketInspectionRecord[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/ticketing/${ticketId}/inspections`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.items ?? [];
  } catch { return []; }
}

export async function createTicketInspection(ticketId: string, formData: FormData): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/ticketing/${ticketId}/inspection`, {
      method: "POST",
      headers: authHeadersNoContentType(),
      body: formData,
    });
    return res.ok;
  } catch { return false; }
}

export async function fetchJurisdictions(params?: {
  page?: number; limit?: number; search?: string; location_id?: string;
}): Promise<JurisdictionRecord[]> {
  try {
    const q = new URLSearchParams();
    q.set("limit", String(params?.limit ?? 100));
    if (params?.page) q.set("page", String(params.page));
    if (params?.search) q.set("search", params.search);
    if (params?.location_id) q.set("location_id", params.location_id);
    const res = await fetch(`${API_BASE_URL}/user-jurisdictions?${q}`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.items ?? [];
  } catch { return []; }
}

export async function fetchJurisdictionLevels(): Promise<JurisdictionLevel[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/user-jurisdictions/levels?limit=50`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return (data.items ?? []).map((l: any) => ({ id: l.id, name: l.name, rank: l.rank }));
  } catch { return []; }
}

export async function fetchProductById(productId: string): Promise<any | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/products/${productId}`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.data ?? data ?? null;
  } catch { return null; }
}

export async function fetchDesignTreeById(treeId: string): Promise<DesignTreeNode | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/designs/tree/${treeId}`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.data?.responseObj ?? data.responseObj ?? null;
  } catch { return null; }
}

export async function fetchTicketCommunications(ticketId?: string): Promise<any[]> {
  try {
    const url = ticketId
      ? `${API_BASE_URL}/ticket-communication?ticket_id=${ticketId}`
      : `${API_BASE_URL}/ticket-communication`;
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const all: any[] = data.items ?? [];
    if (ticketId) return all.filter((m: any) => m.ticket_id === ticketId);
    return all;
  } catch { return []; }
}

// ---------------------------------------------------------------------------
// Product Catalog
// ---------------------------------------------------------------------------

export async function fetchProductCatalog(): Promise<ApiProductCatalog[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/products?limit=100`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data && Array.isArray(data.items)) {
      return data.items.map((p: any) => ({
        id: p.id,
        product_id: p.product_id || p.id,
        product_name: p.product_name || p.name || "Unnamed Product",
        status: p.status,
      }));
    }
    return [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------

const DEMO_PARTS: ApiPartCatalogItem[] = [
  {
    id: "PART-24369",
    part_number: "24369-ASM-V3",
    name: "Side-1 Bogey Plate With Rollers Assembly",
    type: "Gantry Assembly",
    product_id: "PROD-DEMO-GNT",
    product_name: "Halcyon Gantry System",
    version: "3.0",
    status: "Available",
    stock: 10,
    reorder_point: 4,
    location: "Zone G-01 / Rack 02",
    supplier: "GantryParts Co.",
    unit_cost: 120,
    lead_time_days: 12,
    last_ordered: "2026-05-12T09:30:00.000Z",
  },
  {
    id: "PART-64069",
    part_number: "64069-WASHER-34",
    name: "Wedge Lock Washer, 3/4 Screw Size",
    type: "Off-shelf Item",
    product_id: "PROD-DEMO-GNT",
    product_name: "Halcyon Gantry System",
    version: "1.0",
    status: "Available",
    stock: 500,
    reorder_point: 120,
    location: "Zone B-02 / Bin 18",
    supplier: "FastenPro",
    unit_cost: 0.12,
    lead_time_days: 3,
    last_ordered: "2026-05-04T11:15:00.000Z",
  },
  {
    id: "PART-25086",
    part_number: "25086-PIVOT-G2",
    name: "Pivot Mount Press Fitted Assembly, Side-1",
    type: "Vendor Sub-Part",
    product_id: "PROD-DEMO-GNT",
    product_name: "Halcyon Gantry System",
    version: "2.0",
    status: "Low Stock",
    stock: 6,
    reorder_point: 8,
    location: "Zone G-02 / Rack 05",
    supplier: "GantryParts Co.",
    unit_cost: 85,
    lead_time_days: 10,
    last_ordered: "2026-04-28T14:05:00.000Z",
  },
  {
    id: "PART-CB1002",
    part_number: "CB-1002-MOD",
    name: "PCB Module - Control Board",
    type: "Electronics",
    product_id: "PROD-DEMO-CTL",
    product_name: "Control Cabinet",
    version: "4.1",
    status: "Available",
    stock: 120,
    reorder_point: 30,
    location: "Zone C-05 / ESD Shelf",
    supplier: "TechCircuits Ltd",
    unit_cost: 125,
    lead_time_days: 14,
    last_ordered: "2026-05-15T08:40:00.000Z",
  },
];

const DEMO_ORDER_HISTORY: ApiPartOrderHistoryItem[] = [
  {
    id: "hist-1001",
    order_id: "ORD-2026-0512",
    part_id: "PART-24369",
    part_name: "Side-1 Bogey Plate With Rollers Assembly",
    status: "Delivered",
    quantity: 4,
    ordered_at: "2026-05-12T09:30:00.000Z",
    client_name: "Mumbai Facility",
  },
  {
    id: "hist-1002",
    order_id: "ORD-2026-0504",
    part_id: "PART-64069",
    part_name: "Wedge Lock Washer, 3/4 Screw Size",
    status: "Delivered",
    quantity: 250,
    ordered_at: "2026-05-04T11:15:00.000Z",
    client_name: "Berlin Central",
  },
  {
    id: "hist-1003",
    order_id: "ORD-2026-0428",
    part_id: "PART-25086",
    part_name: "Pivot Mount Press Fitted Assembly, Side-1",
    status: "In Transit",
    quantity: 8,
    ordered_at: "2026-04-28T14:05:00.000Z",
    client_name: "Toronto Lab",
  },
];

function deterministicPartStock(seed: string): number {
  const total = seed.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return 3 + (total % 42);
}

export async function fetchPartsCatalog(): Promise<ApiPartCatalogItem[]> {
  try {
    const products = await fetchProductCatalog();
    const productSlice = products.slice(0, 6);
    const treeResults = await Promise.all(
      productSlice.map(async (product) => ({
        product,
        tree: await fetchTroubleshootingByProduct(product.id),
      })),
    );

    const parts = treeResults.flatMap(({ product, tree }) =>
      (tree.data ?? [])
        .map((node) => {
          const stock = deterministicPartStock(node.design_uuid || node.design_id);
          const reorderPoint = node.design_type?.toLowerCase().includes("assembly") ? 5 : 12;
          return {
            id: node.design_version_id || node.design_uuid,
            part_number: node.design_id,
            name: node.design_name,
            type: node.design_type || "Component",
            product_id: product.product_id,
            product_name: product.product_name,
            version: node.design_version,
            status: stock <= reorderPoint ? "Low Stock" : "Available",
            stock,
            reorder_point: reorderPoint,
            location: `Zone ${String.fromCharCode(65 + (stock % 7))}-${String(stock % 12).padStart(2, "0")}`,
            supplier: node.design_type?.toLowerCase().includes("assembly") ? "GantryParts Co." : "Approved Vendor",
            unit_cost: Number((25 + stock * 3.75).toFixed(2)),
            lead_time_days: 4 + (stock % 12),
            last_ordered: null,
          } satisfies ApiPartCatalogItem;
        }),
    );

    return parts.length ? parts : DEMO_PARTS;
  } catch {
    return DEMO_PARTS;
  }
}

export async function fetchPartOrderHistory(): Promise<ApiPartOrderHistoryItem[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/orders?limit=50&orderBy=createdAt&order=DESC`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const orders: any[] = data.items ?? [];
    const history = orders.flatMap((order: any) =>
      (order.design_parts ?? []).map((part: any) => ({
        id: `${order.id}-${part.design_uuid}`,
        order_id: order.order_id || order.id,
        part_id: part.design_uuid,
        part_name: part.design_name || part.part_name || part.design_uuid,
        status: order.status || "Pending",
        quantity: part.quantity ?? 1,
        ordered_at: order.createdAt || order.created_at || new Date().toISOString(),
        client_name: order.client_name || order.client_details?.commercialName || null,
      })),
    );
    return history.length ? history : DEMO_ORDER_HISTORY;
  } catch {
    return DEMO_ORDER_HISTORY;
  }
}

const CITY_COORDS: Array<{ keys: string[]; coordinates: [number, number]; label: string }> = [
  { keys: ["new york", "nyc", "10001"], coordinates: [-74.006, 40.7128], label: "New York" },
  { keys: ["berlin"], coordinates: [13.405, 52.52], label: "Berlin" },
  { keys: ["tokyo"], coordinates: [139.691, 35.6762], label: "Tokyo" },
  { keys: ["sydney"], coordinates: [151.209, -33.868], label: "Sydney" },
  { keys: ["sao paulo", "são paulo"], coordinates: [-46.633, -23.543], label: "Sao Paulo" },
  { keys: ["mumbai", "400"], coordinates: [72.877, 19.076], label: "Mumbai" },
  { keys: ["london"], coordinates: [-0.118, 51.509], label: "London" },
  { keys: ["toronto"], coordinates: [-79.383, 43.653], label: "Toronto" },
  { keys: ["chandigarh", "mohali", "160053", "160055", "160062"], coordinates: [76.7179, 30.7046], label: "Chandigarh / Mohali" },
  { keys: ["delhi", "new delhi", "110"], coordinates: [77.209, 28.6139], label: "New Delhi" },
  { keys: ["bengaluru", "bangalore", "560"], coordinates: [77.5946, 12.9716], label: "Bengaluru" },
  { keys: ["hyderabad", "500"], coordinates: [78.4867, 17.385], label: "Hyderabad" },
  { keys: ["pune", "411"], coordinates: [73.8567, 18.5204], label: "Pune" },
  { keys: ["chennai", "600"], coordinates: [80.2707, 13.0827], label: "Chennai" },
  { keys: ["kolkata", "700"], coordinates: [88.3639, 22.5726], label: "Kolkata" },
  { keys: ["ahmedabad", "380"], coordinates: [72.5714, 23.0225], label: "Ahmedabad" },
  { keys: ["jaipur", "302"], coordinates: [75.7873, 26.9124], label: "Jaipur" },
];

function resolveAddressCoordinates(address?: string | null): { coordinates: [number, number]; label: string } | null {
  if (!address) return null;
  const normalized = address.toLowerCase();
  return CITY_COORDS.find((entry) => entry.keys.some((key) => normalized.includes(key))) ?? null;
}

function markerStatusFromOrder(orderStatus?: string | null): ApiDeploymentMarker["status"] {
  const status = (orderStatus ?? "").toLowerCase();
  if (status.includes("cancel") || status.includes("return") || status.includes("hold")) return "critical";
  if (status.includes("pending") || status.includes("transit") || status.includes("shipped") || status.includes("confirm")) return "warning";
  return "nominal";
}

export async function fetchDeploymentMarkersFromOrders(): Promise<ApiDeploymentMarker[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/orders?limit=100&orderBy=createdAt&order=DESC`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const orders: any[] = data.items ?? [];
    const seen = new Set<string>();

    return orders.reduce<ApiDeploymentMarker[]>((markers, order: any) => {
      const address = order.shipping_address || order.billing_address;
      const resolved = resolveAddressCoordinates(address);
      if (!resolved) return markers;

      const product = (order.line_items ?? order.items ?? [])[0];
      const clientName = order.client_name || order.client_details?.commercialName || order.client_details?.name || null;
      const key = `${order.id}-${resolved.coordinates.join(",")}`;
      if (seen.has(key)) return markers;
      seen.add(key);

      markers.push({
        name: product?.product_name || order.order_id || clientName || resolved.label,
        coordinates: resolved.coordinates,
        status: markerStatusFromOrder(order.status),
        detail: `${clientName || "Client"} · ${order.order_id || "Order"} · ${address}`,
        address,
        client_name: clientName,
        order_id: order.order_id || order.id,
      });
      return markers;
    }, []);
  } catch {
    return [];
  }
}
