import nodemailer from 'nodemailer'
import type { WeeklySummaryPayload, EmployeeBrief, AttentionItem } from './types'
import { BRAND, fmtDate } from './ui'

// Spec §2 — recipients default to the manager, overridable via env for safe
// testing (set WEEKLY_TO / WEEKLY_CC on Vercel; unset to use production defaults).
export const RECIPIENTS = {
  to: process.env.WEEKLY_TO || 'shorya.shriwastav@merillife.com',
  cc: process.env.WEEKLY_CC ?? 'ai.merillife@gmail.com',
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

const FONT_STACK = `'Manrope', 'Segoe UI', Helvetica, Arial, sans-serif`

function statCell(label: string, value: string): string {
  return `<td style="padding:12px 16px;background:#f6f7fb;border-radius:10px;text-align:center;">
    <div style="font-size:20px;font-weight:700;color:${BRAND.navy};">${value}</div>
    <div style="font-size:11px;color:#6E6E73;margin-top:2px;">${label}</div>
  </td><td style="width:8px;"></td>`
}

function attentionHtml(items: AttentionItem[], appUrl: string | undefined): string {
  if (items.length === 0) return ''
  const rows = items.map(a =>
    `<li style="margin:6px 0;font-size:13px;color:#3a3a3c;">
      <strong>${escapeHtml(a.employee_name)}</strong>: ${escapeHtml(a.detail)}
      ${appUrl ? ` — <a href="${appUrl}" style="color:${BRAND.navy};">review on the dashboard</a>` : ' — review on the dashboard'}
    </li>`).join('')
  return `<div style="margin:20px 0;padding:14px 18px;background:#fff8e6;border:1px solid ${BRAND.gold};border-radius:12px;">
    <div style="font-size:14px;font-weight:700;color:${BRAND.navyDark};">Needs attention</div>
    <ul style="margin:8px 0 0;padding-left:18px;">${rows}</ul>
  </div>`
}

function employeeHtml(e: EmployeeBrief, workingDays: number): string {
  const weekly = e.weekly_commitment_outcome === 'completed' ? '✅ weekly goal completed'
    : e.weekly_commitment_outcome === 'carried' ? '↻ weekly goal carried' : 'no weekly goal'
  const projects = e.projects.map(p => {
    const tasks = p.tasks.map(t => {
      const mark = t.status === 'completed' ? '✅' : t.status === 'blocked' ? '⛔' : '🔄'
      const changed = t.what_changed ? ` — <span style="color:#6E6E73;">${escapeHtml(t.what_changed)}</span>` : ''
      return `<li style="font-size:12px;margin:3px 0;">${mark} ${escapeHtml(t.title)}${changed}</li>`
    }).join('')
    const blockers = p.blockers.length
      ? `<div style="font-size:12px;color:#b3261e;margin-top:4px;">Blocked: ${p.blockers.map(escapeHtml).join('; ')}</div>` : ''
    return `<div style="margin:8px 0;">
      <div style="font-size:12px;font-weight:700;color:${BRAND.purple};">${escapeHtml(p.project_name)}</div>
      <ul style="margin:4px 0 0;padding-left:16px;">${tasks}</ul>${blockers}
    </div>`
  }).join('')
  return `<div style="margin:14px 0;padding:14px 18px;background:white;border:1px solid #eef0f6;border-radius:12px;">
    <div style="font-size:14px;font-weight:700;color:${BRAND.ink};">${escapeHtml(e.employee_name)}
      <span style="font-weight:400;font-size:12px;color:#6E6E73;"> — ${e.days_submitted}/${workingDays} days${e.absences ? `, ${e.absences} absent` : ''} · ${e.tasks_completed} done / ${e.tasks_in_progress} in progress / ${e.tasks_blocked} blocked · commitments ${e.commitments_delivered} delivered, ${e.commitments_carried} carried · ${weekly}</span>
    </div>
    ${projects || '<div style="font-size:12px;color:#6E6E73;margin-top:6px;">No work logged this week.</div>'}
  </div>`
}

export function renderWeeklyEmail(payload: WeeklySummaryPayload, narrative: string | null): { subject: string; html: string } {
  const appUrl = process.env.APP_URL
  const subject = `Weekly Team Summary — ${fmtDate(payload.week_start)} to ${fmtDate(payload.week_end)}`
  const t = payload.team
  const quiet = payload.employees.every(e => e.days_submitted === 0)

  const narrativeBlock = narrative
    ? `<div style="margin:20px 0;padding:16px 18px;background:#f6f7fb;border-left:4px solid ${BRAND.navy};border-radius:8px;font-size:13px;line-height:1.6;color:#3a3a3c;white-space:pre-wrap;">${escapeHtml(narrative)}</div>`
    : ''

  const body = quiet
    ? `<p style="font-size:13px;color:#3a3a3c;">It was a quiet week — no updates were logged.</p>`
    : payload.employees.map(e => employeeHtml(e, t.working_days)).join('')

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f6f7fb;">
  <div style="max-width:640px;margin:0 auto;padding:24px 16px;font-family:${FONT_STACK};">
    <div style="background:${BRAND.navy};border-radius:14px;padding:20px 24px;">
      <div style="color:white;font-size:18px;font-weight:800;">Weekly Team Summary</div>
      <div style="color:${BRAND.gold};font-size:13px;margin-top:4px;">${fmtDate(payload.week_start)} – ${fmtDate(payload.week_end)}</div>
      ${appUrl ? `<a href="${appUrl}" style="display:inline-block;margin-top:12px;padding:8px 16px;background:${BRAND.gold};color:${BRAND.navyDark};font-size:12px;font-weight:700;border-radius:8px;text-decoration:none;">Open the dashboard</a>` : ''}
    </div>
    ${narrativeBlock}
    <table role="presentation" style="width:100%;border-collapse:collapse;margin:16px 0;"><tr>
      ${statCell('Submission rate', `${t.submission_rate}%`)}
      ${statCell('Commitments done', String(t.commitments_completed))}
      ${statCell('Carried', String(t.commitments_carried))}
      ${statCell('On-time %', t.on_time_delivery_pct === null ? '—' : `${t.on_time_delivery_pct}%`)}
      ${statCell('Open blockers', String(t.open_blockers))}
    </tr></table>
    ${attentionHtml(payload.attention, appUrl)}
    ${body}
    <div style="margin-top:20px;font-size:11px;color:#9a9aa0;text-align:center;">
      Meril Daily Work Tracker · automated weekly summary${appUrl ? ` · <a href="${appUrl}" style="color:${BRAND.navy};">open the dashboard</a>` : ''}
    </div>
  </div></body></html>`
  return { subject, html }
}

export async function sendWeeklyEmail(
  payload: WeeklySummaryPayload,
  narrative: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  if (!user || !pass) return { ok: false, error: 'GMAIL_USER / GMAIL_APP_PASSWORD not configured' }
  try {
    // Use STARTTLS on 587 — many networks block the secure 465 port that the
    // 'gmail' service preset uses (symptom: connect ETIMEDOUT …:465).
    const transport = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user, pass },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
    })
    const { subject, html } = renderWeeklyEmail(payload, narrative)
    await transport.sendMail({
      from: `"Daily Work Tracker" <${user}>`,
      to: RECIPIENTS.to,
      // Skip cc when it duplicates the primary recipient (avoids a dup-address error).
      ...(RECIPIENTS.cc && RECIPIENTS.cc !== RECIPIENTS.to ? { cc: RECIPIENTS.cc } : {}),
      subject,
      html,
    })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
