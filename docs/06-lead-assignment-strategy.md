# 06 · Lead Assignment Strategy

Implements locked decision **D5**: a CSR reviews every lead and assigns it.
Automatic assignment is fully built and runs as a fallback, not as the
primary path.

---

## 1 · Why both exist

Manual review produces better assignment. A CSR who has spoken to the
customer knows the job is a stair runner in a 1920s house and that Dana
handles those well. No rule captures that.

Manual review also fails predictably. It fails at 9pm, on Sundays, during a
Facebook campaign that produces forty leads in an hour, and when the CSR is
on holiday. Speed-to-lead is the single strongest predictor of conversion in
home services, and an unassigned lead sitting overnight is a lost lead.

So: **CSR review is primary, a timer is the safety net.** The automatic
strategy is not a lesser fallback bolted on later; it is built to the same
standard and is one settings change away from becoming primary if the client
changes their mind.

---

## 2 · The state machine

```
 Lead created (GHL webhook, CSR manual, or inbound endpoint)
        │
        │  assignedRepId = null
        │  slaStartedAt  = now()
        │  ScheduledTask "lead.sla.expire" queued for now() + SLA
        ▼
 ┌──────────────────────┐
 │  AWAITING ASSIGNMENT │   appears on the CSR intake board, flagged
 └──────────────────────┘
        │
        ├── CSR assigns ──────────────► ASSIGNED
        │     strategy = CSR_MANUAL          cancel the scheduled task
        │                                    clear slaStartedAt
        │
        ├── CSR disqualifies ─────────► LOST
        │                                    cancel the scheduled task
        │
        └── SLA timer fires ──────────► auto-assign
                                             strategy = SLA_FALLBACK
                                             slaBreachedAt = now()
                                             notify the CSR and Admin
                                             ► ASSIGNED
```

Reassignment is always available afterwards, by a CSR or an Admin, with a
required reason. Every assignment and reassignment appends a
`LeadAssignment` row; `Lead.assignedRepId` is the denormalised current value,
written in the same transaction (rule R6 in doc 03).

---

## 3 · Configuration

Held in `AppSetting`, editable by an Admin (FR-ADM-50).

| Key | Default | Meaning |
|---|---|---|
| `leads.assignment.mode` | `CSR_REVIEW` | `CSR_REVIEW` or `AUTO` |
| `leads.assignment.slaMinutes` | `30` | How long a lead may wait before fallback fires |
| `leads.assignment.slaBusinessHoursOnly` | `true` | If true, the timer pauses outside business hours |
| `leads.assignment.fallbackStrategy` | `AUTO_ROUND_ROBIN` | Which strategy the timer uses |
| `leads.assignment.notifyOnBreach` | `["csr","admin"]` | Who hears about a breach |
| `leads.assignment.perSourceOverrides` | `{}` | Per-source overrides, see below |

**Per-source override** lets high-intent sources skip the wait without
changing the default. Example:

```json
{
  "FACEBOOK_ADS":   { "mode": "AUTO", "strategy": "AUTO_ROUND_ROBIN" },
  "INBOUND_CALL":   { "mode": "CSR_REVIEW", "slaMinutes": 10 },
  "WEBSITE_FORM":   { "mode": "CSR_REVIEW", "slaMinutes": 30 }
}
```

The business-hours pause matters. Without it, every lead arriving at 6pm is
auto-assigned at 6:30pm to a rep who is not working, and lands in their queue
looking already-handled. With it, a 6pm lead's timer resumes at 8am and the
CSR gets the morning to triage.

---

## 4 · Automatic strategies

All four are implemented. `AssignmentRule` rows are evaluated in `priority`
order and the first match wins; if none match, the configured
`fallbackStrategy` runs.

### AUTO_ROUND_ROBIN
Ordered rotation across active reps holding the Sales Rep role. Pointer is
persisted so a restart does not reset it. Skips reps who are suspended, on
leave, or already at `maxOpenLeads`.

### AUTO_TERRITORY
Matches `Lead.postalCode` against `Territory.postalCodes`. Where a territory
has several reps, round-robin within it. No territory match falls through to
the next rule.

### AUTO_LOAD_BALANCED
Assigns to the rep with the fewest open leads, where "open" means stage not
in (WON, LOST). Ties broken by who was assigned least recently. Respects
`maxOpenLeads` and `workingHours`.

### AUTO_SOURCE_RULE
Explicit routing by source or by criteria in the rule's `criteria` JSON:
estimated value bands, postal code lists, tags from GHL. Used for cases like
"anything over $15,000 goes to the senior rep".

### Eligibility filter, applied to every strategy

A rep must:
- hold an active Sales Rep role (or a custom role with `lead.read.own`),
- have `status = ACTIVE`,
- be inside `workingHours` if the strategy is business-hours aware,
- be below `maxOpenLeads` if it is set.

**If no rep is eligible**, the lead is *not* assigned to an ineligible rep.
It stays unassigned, `slaBreachedAt` is set, and an Admin is alerted. Silently
dumping leads on someone who is on holiday is worse than leaving them visible
and unassigned.

### Strategy context is recorded

Every automatic assignment writes `LeadAssignment.strategyContext`:

```json
{
  "strategy": "AUTO_LOAD_BALANCED",
  "candidates": [
    { "userId": "u_rep_a", "openLeads": 12, "eligible": true },
    { "userId": "u_rep_b", "openLeads": 7,  "eligible": true },
    { "userId": "u_rep_c", "openLeads": 3,  "eligible": false,
      "reason": "outside working hours" }
  ],
  "selected": "u_rep_b",
  "ruleId": null,
  "slaBreachedAt": "2026-09-22T01:30:00Z"
}
```

Without this, "why did Dana get that lead" is unanswerable three weeks later.
With it, the question takes ten seconds.

---

## 5 · The CSR assignment interface

What the CSR sees when assigning (FR-CSR-07). The point is to make the good
decision the fast one.

| Column | Why it is there |
|---|---|
| Rep name | |
| Open leads | The load signal |
| Leads assigned today | Prevents dumping six in a row on one person |
| Close rate, last 90 days | Route the high-value lead to the closer |
| Territory match | Highlighted when the rep covers this postal code |
| Next availability | From the GHL calendar, so the CSR can book the measure in the same motion |
| Status | Available, outside hours, at capacity, on leave |

Plus:

- **Suggested rep**, computed by running the configured fallback strategy and showing its result with a one-line reason. The CSR accepts it with one click or overrides it. This is the highest-leverage element on the screen: it makes the common case one click while keeping judgement in the loop.
- **Assign and book** as a single action, creating the assignment and opening the appointment booking step, because those two things almost always happen together.
- **SLA countdown** on every card, colour-shifting as the deadline approaches.

---

## 6 · Notifications

| Event | Recipients | Channel |
|---|---|---|
| New lead awaiting assignment | CSRs on duty | In-app, plus SMS if it arrives inside business hours |
| SLA at 50% elapsed | CSRs | In-app |
| SLA breached, auto-assigned | CSRs, Admin | In-app and email |
| Lead assigned to you | The rep | In-app, plus SMS if configured |
| Lead reassigned away from you | The previous rep | In-app, with the reason |
| No eligible rep found | Admin | In-app and email, flagged urgent |

---

## 7 · Metrics

Tracked from day one; these are what tell you whether D5 is working.

| Metric | Definition | Why |
|---|---|---|
| Time to assignment | Lead created → first assignment | The core speed-to-lead number |
| SLA breach rate | Percentage auto-assigned by the timer | If this climbs above ~15%, CSR capacity is the problem, not the policy |
| Time to first contact | Lead created → first outbound activity | The number that actually predicts conversion |
| Reassignment rate | Percentage reassigned within 48 hours | High means the assignment criteria are wrong |
| Conversion by strategy | Win rate for CSR_MANUAL against SLA_FALLBACK | **The decisive experiment.** If manual does not beat automatic after 90 days, the client should consider flipping the default and redeploying CSR time to outreach. |
| Distribution fairness | Gini coefficient of leads per rep per month | Detects favouritism in manual assignment, which is common and corrosive |

Put the last two in front of the client at the 90-day review. Decision D5 is
locked for the build, not forever, and this is the evidence that should drive
any future change.

---

## 8 · Edge cases

| Case | Behaviour |
|---|---|
| Lead arrives for an existing contact (repeat customer) | Match on `ghlContactId`. If the previous rep is still active, offer them as the suggested assignee with "previous rep" as the reason. |
| Assigned rep is suspended | On suspension, all their open leads return to AWAITING ASSIGNMENT with a fresh SLA timer and an Admin notification listing them. |
| Assigned rep goes on leave | Leave is a capacity setting, not a status change. Existing assignments stay; new automatic assignment skips them. Bulk reassignment is available to an Admin. |
| Duplicate lead created | FR-CSR-14 offers a merge. Merging keeps the earliest `createdAt`, the union of notes and activities, and the existing assignment. |
| Lead disqualified then revived | Reviving clears `lostReason`, sets stage back to CONTACTED, and starts a new SLA timer only if it is unassigned. |
| SLA timer fires for an already-assigned lead | No-op. The task checks current state before acting; it never overwrites a CSR decision made in the last few seconds. |
| Mode switched to AUTO while leads are waiting | All currently-waiting leads are auto-assigned immediately, with `strategy = ADMIN_OVERRIDE` and the mode change recorded in the audit log. |
