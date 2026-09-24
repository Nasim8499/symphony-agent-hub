# Symphony · Browser Use Cloud Agent Hub

Production-ready Next.js 16 dashboard for running Browser Use cloud agents,
scheduled automations, skills and the INSUS Manpower visa/work-permit workflows.

## Deploy in one click

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Nasim8499/symphony-agent-hub)

1. Click **Deploy** and connect a Postgres database
   ([Neon](https://neon.tech) or [Supabase](https://supabase.com) both have free tiers).
2. Set `DATABASE_URL` in Vercel → Project → Settings → Environment Variables.
3. Open the deployed URL → **Settings → API Keys** → add your Browser Use key
   (or enable **Free / Fallback Agent Mode** to run without one).

Tables are created automatically on the first request — there is no migration step.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string (Neon / Supabase / self-hosted) |
| `NEXT_PUBLIC_SITE_URL` | recommended | Public origin for OAuth redirects and metadata |
| `BROWSER_USE_API_KEY` | no | Fallback Browser Use key when none is stored in the vault |
| `DEEPSEEK_API_KEY` | no | Fallback DeepSeek key for `deepseek-chat` / `deepseek-reasoner` planning |
| `OPENROUTER_API_KEY` | no | Key for Free / Fallback Agent Mode with OpenRouter |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | no | Google Workspace OAuth (also settable in the UI) |

## Features

- **Core Agent** — dispatch tasks to a stealth cloud browser with live view and takeover.
- **Key Vault** — up to 10 keys per provider, folder grouping, active-key rotation and balance health checks.
- **Free / Fallback Agent Mode** — keep automations running with OpenRouter, local Ollama or a mock executor.
- **DeepSeek routing** — `deepseek-chat` and `deepseek-reasoner` plan tasks; a Browser Use executor runs them.
- **Google Workspace** — Drive search, file fetching, document export and an in-dashboard PDF/Doc/Sheet viewer.
- **INSUS Custom Agent** — work permits for Australia, Serbia, Russia, Turkey, Singapore, Malaysia, Saudi Arabia and Bahrain,
  visitor visas, Serbia/Russia business residency, onboarding, flight tracking and automated email dispatch.
- **PWA** — installable on desktop, tablet and mobile with an offline app shell and custom install prompts.

## Local development

```bash
cp .env.example .env.local   # add DATABASE_URL
npm install
npm run dev
```

Useful scripts:

```bash
npm run build      # production build
npm run start      # serve the production build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
```

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Drizzle ORM + Postgres · PWA service worker.
