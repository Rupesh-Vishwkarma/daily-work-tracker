export type Role = 'manager' | 'employee'
export type Workload = 'light' | 'medium' | 'heavy'
export type TaskStatus = 'in_progress' | 'completed' | 'blocked'

export interface Employee {
  id: string
  username: string
  name: string
  password?: string
  role: Role
  created_at?: string
}

export type AttachmentType = 'image' | 'file' | 'link'

export interface Attachment {
  type: AttachmentType
  url: string
  name: string
}

export interface ProjectTask {
  project_id: string
  task: string
  time: string
  status: TaskStatus
  blockers: string
  what_changed?: string
  attachments?: Attachment[]
}

export type CommitmentHorizon = 'day' | 'week'
export type CommitmentStatus = 'open' | 'done' | 'partial' | 'missed'

export interface Commitment {
  id: string
  employee_id: string
  employee_name: string
  project_id: string | null
  horizon: CommitmentHorizon
  text: string
  due_date: string
  created_in_entry_id: string | null
  status: CommitmentStatus
  outcome_note: string | null
  resolved_at: string | null
  carry_count: number
  created_at: string
}

export interface Entry {
  id: string
  employee_id: string
  employee_name: string
  date: string
  workload: Workload
  timestamp: string
  submit_count: number
  is_absent: boolean
  submitted_by_manager: boolean
  project_tasks: ProjectTask[]
  absence_note?: string | null
}

export interface Project {
  id: string
  name: string
  color: string
  lead: string
  members: string[]
  start_date: string
  deadline: string | null
  end_date: string | null
  status: 'active' | 'closed'
  previous_deadlines: string[]
  created_at: string
}

export interface Comment {
  id: string
  entry_id: string
  text: string
  author: string
  timestamp: string
}

export interface Broadcast {
  id: number
  message: string
  active: boolean
  updated_at: string
}

export interface Session {
  id: string
  username: string
  name: string
  role: Role
}

// ---- Weekly summary (spec: docs/superpowers/specs/2026-07-18-weekly-summary-email-design.md) ----

export interface ProjectWork {
  project_name: string
  tasks: { title: string; what_changed: string; status: TaskStatus }[]
  blockers: string[]
}

export interface EmployeeBrief {
  employee_id: string
  employee_name: string
  days_submitted: number
  absences: number
  tasks_completed: number
  tasks_in_progress: number
  tasks_blocked: number
  commitments_delivered: number
  commitments_carried: number
  weekly_commitment_outcome: 'completed' | 'carried' | 'none'
  projects: ProjectWork[]
}

export interface AttentionItem {
  kind: 'stalled' | 'blocker' | 'missed_days' | 'zero_activity'
  employee_name: string
  detail: string
}

export interface TeamStats {
  working_days: number
  members: number
  submission_rate: number            // 0–100
  commitments_completed: number
  commitments_carried: number
  on_time_delivery_pct: number | null // null when nothing completed
  open_blockers: number
}

export interface WeeklySummaryPayload {
  week_start: string
  week_end: string
  team: TeamStats
  attention: AttentionItem[]
  employees: EmployeeBrief[]
}

/** The ONLY shape ever sent to Gemini. Rebuilt key-by-key in toAiInput() (spec §4a). */
export type AiInput = WeeklySummaryPayload

export interface WeeklySummary {
  id: string
  week_start: string
  week_end: string
  payload: WeeklySummaryPayload
  narrative: string | null
  generated_at: string
  sent_at: string | null
  sent_to: string[] | null
  send_error: string | null
  created_at: string
}
