# Northwind Coffee — Ops Dashboard (workshop project)

This is the starter project for **[Building productivity superpowers with Claude Code](https://luma.com/i0dkufzc)** — the Generalist World "Summer School of Generalist Skills" workshop, led by Sawyer Middeleer (Revi Systems). Beginners welcome — you do not need to know how to code.

You are helping the ops team at **Northwind Coffee Co.**, a direct-to-consumer coffee roaster. Everything you need is already in this folder.

## What we're building (in order)

1. **A dashboard** — a small web app that turns the spreadsheets in `data/` into something the team can actually use: filter, sort, and drill into the numbers.
2. **A briefing** — a short written report that pulls the key metrics out of the data and recommends what to do next.
3. **A routine** — a scheduled job that regenerates the briefing on its own, every day.

## Where things are

- `context/` — **read this first.** Who the team is and what they care about.
  - `team-context.md` — the team, their roles, what they need from a dashboard.
  - `2026-06-04-leadership-sync.md` — notes from last week's leadership sync. These call out the **priority metrics** the dashboard and briefing should center on. Anchor your work to this.
- `data/` — the raw data, as the team actually keeps it (messy spreadsheets, multiple tables per sheet).
  - `sales.xlsx` — orders and returns. This becomes the **Sales** tab.
  - `inventory.xlsx` — stock on hand and inbound purchase orders. This becomes the **Inventory** tab.

## How to work

- Start by reading `context/` and previewing `data/` so you understand the project before building anything.
- Use **plan mode** to lay out the dashboard before writing code.
- Build it as a **Vite** web app backed by a **SQLite** database (load the spreadsheets into the database first).
- Two tabs: **Sales** and **Inventory**. Highlight the priority metrics from the leadership sync.
- Use the **frontend design skill** for the UI.
- When it works locally, deploy it to **Vercel**.
- Build incrementally and check your work — write a test that confirms the data loaded correctly, and open the app in the browser to see it.
