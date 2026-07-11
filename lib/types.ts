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
