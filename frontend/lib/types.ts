export type Role = 'EMPLOYEE' | 'TECHNICIAN' | 'ADMIN';
export type IncidentStatus = 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type IncidentCategory = 'APPLICATION' | 'NETWORK' | 'HARDWARE' | 'ACCESS' | 'OTHER';
export type Priority = 'P1' | 'P2' | 'P3' | 'P4';

export interface User { id: number; username: string; email: string; role: Role; }
export interface AuditEntry { id: number; action: string; actor_username: string; old_status?: string; new_status?: string; timestamp: string; metadata?: Record<string, unknown>; }
export interface AiAnalysis {
  category: IncidentCategory; suggested_priority: Priority;
  priority_reasoning: string; ai_summary: string;
  suggested_resolution_steps: string[];
}
export interface Incident {
  id: number; title: string; description: string;
  category: IncidentCategory; priority: Priority; status: IncidentStatus;
  created_by_id: number; assigned_to_id?: number;
  created_by_username?: string; assigned_to_username?: string;
  resolution_notes?: string; ai_summary?: string; ai_analysis?: AiAnalysis;
  sla_deadline?: string; sla_violated: boolean;
  created_at: string; updated_at: string; resolved_at?: string;
  audit_log?: AuditEntry[];
}
export interface Notification { id: number; message: string; is_read: boolean; created_at: string; }
export interface AdminStats {
  open_count: number; resolved_count: number; closed_count: number;
  by_category: Record<string, number>; sla_violations: number;
  technician_workload: Array<{ id: number; username: string; active_ticket_count: number }>;
}
