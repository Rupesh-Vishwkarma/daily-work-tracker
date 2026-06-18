export type Role = 'manager' | 'employee'
export type Workload = 'light' | 'medium' | 'heavy'

export interface Employee {
  id: string
  username: string
  name: string
  password: string
  role: Role
  created_at?: string
}

export interface Entry {
  id: string
  employee_id: string
  employee_name: string
  date: string
  work: string
  blockers: string
  workload: Workload
  timestamp: string
}

export interface Session {
  id: string
  username: string
  name: string
  role: Role
}
