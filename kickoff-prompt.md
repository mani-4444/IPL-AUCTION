# Claude Code — IPL Auction App: Master Kickoff Prompt

> **How to use:** Copy everything inside the `---` block below and paste it as your first message to Claude Code inside the project folder. After that, just say "Start Phase 0" or "Start Phase 1" etc. to proceed phase by phase.

---

```
You are building a full-stack real-time IPL Auction Web App.

## Your Source of Truth
- Read CLAUDE.md first — it contains the full tech stack, data models,
  file structure, TypeScript types, Supabase schema, socket events,
  scoring logic, and all constraints.
- Read plan.md second — it contains the 7-phase build order with
  detailed steps. Always follow the phase order. Never skip ahead.

---

## Git Workflow Rules (Follow Every Time)

### Branching
- Each Phase = its own git branch
- Branch naming: `phase/0-setup`, `phase/1-data-layer`,
  `phase/2-backend`, `phase/3-frontend`, `phase/4-theme`,
  `phase/5-edge-cases`, `phase/6-testing`, `phase/7-deploy`
- Create the branch at the start of each phase:
  `git checkout -b phase/X-name`
- When a phase is fully verified and working, merge to main:
  `git checkout main && git merge phase/X-name`

### Committing
- Commit after EVERY completed step (not just phases)
- Commit message format: `[PhaseX.Y] Short description`
  Examples:
    [Phase0.1] Initialize monorepo with workspaces
    [Phase0.6] Add player import script for Excel
    [Phase2.4] Auction state machine with timer logic
    [Phase3.4] Live auction page with bid panel
- Never batch multiple steps into one commit
- Always run `git status` before committing to check what's staged
- Never commit .env files — add them to .gitignore immediately

---

## Verification Rules (Follow After EVERY Step)

After completing each step, you MUST verify before moving on:

### For Backend Steps
1. Run `npm run dev --workspace=apps/server`
2. Check for TypeScript compilation errors — fix all before proceeding
3. Test the specific feature:
   - Room handlers → use a Socket.io test client or curl to confirm events fire
   - Auction logic → write a small inline test and run it
   - Scoring service → run `npx ts-node scripts/test-scoring.ts` and assert results
4. Check Supabase via MCP to confirm DB rows were written correctly

### For Frontend Steps
1. Run `npm run dev --workspace=apps/web`
2. Check for TypeScript/ESLint errors in terminal
3. Open browser, navigate to the page you just built
4. Take a screenshot and confirm the UI looks correct
5. Test the user interaction (click, form, socket event)

### For Database Steps (Supabase)
1. Use the Supabase MCP tool to run a SELECT on the affected table
2. Confirm row count and schema match expected output
3. If seeding players — confirm count matches Excel row count

### For Each Phase Completion
- All steps in the phase must be committed and verified
- Run both frontend and backend together: `npm run dev` (root)
- Do one full end-to-end test of everything built so far
- Only then merge the phase branch to main

---

## Tools & Skills to Use

### When working with the Excel players file
- Use the `xlsx` skill (invoke it) to parse the Excel file
- Map columns: Name, Role, Rating, BasePrice, Nationality, IPLTeam
- Use Supabase MCP to bulk insert parsed players into the `players` table
- After insert, verify row count via Supabase MCP: `SELECT COUNT(*) FROM players`

### When working with Supabase
- Use the Supabase MCP for all DDL (CREATE TABLE, ALTER, etc.)
- Run `supabase/schema.sql` via MCP SQL editor to create all tables
- Use MCP to inspect rows, verify data, and debug queries
- Never hardcode Supabase credentials — always use .env variables

### When creating TypeScript files
- Always run `tsc --noEmit` after writing to catch type errors
- Fix all type errors before committing

### When building React components
- After writing a component, take a screenshot to visually verify
- If the component uses socket events, test with a second browser tab

### When writing socket event handlers
- Test both the emit AND the receive side
- Open two browser tabs to simulate two different users
- Verify the event reaches all clients in the room (not just sender)

---

## Quality Rules

1. Server-side validation always — never trust client input
2. All socket handlers must check if user is in the room before acting
3. Host-only actions (start auction, next player, pause) must verify
   `socket.data.userId === room.hostId` before executing
4. Budget deduction must be atomic — deduct and broadcast in same operation
5. Timer must live on the server only — client shows a synced display
6. Overseas limit (max 4) must be enforced at bid time on the server
7. If a step is uncertain, ask before implementing — don't guess

---

## Current Context
- Supabase: already set up and MCP access is available
- Players: Excel file is available in the project folder
- Supabase MCP, file system MCP, and skills are all accessible
- Target: dark IPL-themed UI (orange/gold/dark palette)

---

## How to Start
When I say "Start Phase X", you will:
1. Read the corresponding phase from plan.md
2. Create the git branch for that phase
3. Execute each step in order
4. Verify after each step
5. Commit after each verified step
6. Report back with a summary of what was built and verified

Ask me now: which phase should we start with?
```

---

## How to Run This Workflow in Claude Code

1. Open your terminal, `cd` into your project folder
2. Make sure `CLAUDE.md` and `plan.md` are in the project root
3. Run `claude` to open Claude Code
4. Paste the prompt above
5. Then say: **"Start Phase 0"** to begin

Claude Code will handle the rest — one phase at a time, with git commits and verification at every step.

---

## Phase-by-Phase Command Reference

Once Claude Code is running, use these messages to control the flow:

| Message | What happens |
|---|---|
| `Start Phase 0` | Monorepo setup, tooling, env files |
| `Start Phase 1` | Types, Supabase schema, import players Excel |
| `Start Phase 2` | Full backend: rooms, auction engine, scoring |
| `Start Phase 3` | All frontend pages and components |
| `Start Phase 4` | Dark IPL theme and animations |
| `Start Phase 5` | Reconnection, edge cases, validations |
| `Start Phase 6` | Testing and scoring verification |
| `Start Phase 7` | Deploy to Vercel (frontend) + Render (backend) |
| `Verify Phase X` | Re-run all checks for a specific phase |
| `Show git log` | See all commits made so far |
| `Fix Phase X errors` | Debug and fix issues in a phase |
