# Blog Post Planner

Vue 3 + Supabase blog/social post planning web app.

## Stack
- Vue 3 + Vite
- Vue Router
- Tailwind CSS
- Supabase (Auth, PostgREST, Realtime)

## Setup

1. Install dependencies:
   ```
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in your Supabase project URL and anon key (Project Settings > API in your Supabase dashboard):
   ```
   cp .env.example .env
   ```
3. Run the dev server:
   ```
   npm run dev
   ```
4. Open http://localhost:5173 — you should see a "Supabase client initialized successfully" check screen. That confirms Phase 1 is wired up correctly.

## Build Phases
1. **Scaffold** (this phase) — Vite + Vue 3 + Tailwind + Supabase client
2. Auth — Login, Signup, session handling, route guards
3. App shell — sidebar nav, responsive layout
4. Posts dashboard — list, search, status actions
5. Post Composer — create/edit posts
6. Status pages — History, Archived, Failed, Drafts
7. Account page — profile, password, time zone
8. Realtime + polish
