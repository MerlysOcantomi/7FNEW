# 7F Workspace

Business intelligence and operations platform for agencies, consultancies, and freelancers. Combines CRM, project management, invoicing, a smart multi-channel inbox, and an AI orchestrator (Mr. Forte) that adapts the system to each business.

## Stack

- **Framework**: Next.js 16 (App Router) + React 19
- **Database**: Prisma 7 + SQLite / LibSQL (Turso)
- **UI**: Tailwind CSS 4, shadcn/ui (New York), Radix UI, Lucide icons
- **AI**: OpenAI (gpt-4.1), DeepSeek (reasoner)
- **Auth**: Custom JWT (jose) + Google OAuth
- **Email**: Resend (transactional) + IMAP/SMTP (sync)
- **Storage**: Vercel Blob
- **Deploy**: Vercel

## Architecture

```
agents/          AI agent layer (Forte orchestrator, future agents)
engines/         Complex systems with internal pipelines (AI engine)
modules/         Business modules with CRUD + validation (13 modules)
core/            Shared infrastructure (db, auth, registry, i18n, storage)
tools/           Standalone utilities (OCR, QR, CSV export, scan)
components/      React components (ui/, forms/, inbox/, forte/, templates/)
hooks/           React hooks
app/             Next.js App Router (pages + API routes)
prisma/          Database schema and seeds
```

## Setup

### Prerequisites

- Node.js 20+
- npm 10+

### Installation

```bash
git clone <repo-url>
cd 7f
npm install
```

### Environment variables

Copy `.env.example` to `.env` and fill in the required values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_SECRET` | Yes | Secret for JWT signing (long random string) |
| `DATABASE_URL` | Yes | LibSQL / Turso database URL |
| `DATABASE_AUTH_TOKEN` | Yes | Database auth token |
| `OPENAI_API_KEY` | Yes | OpenAI API key for AI features |
| `GOOGLE_CLIENT_ID` | For auth | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | For auth | Google OAuth client secret |
| `BLOB_READ_WRITE_TOKEN` | For uploads | Vercel Blob storage token |
| `RESEND_API_KEY` | For email | Resend API key for inbox outbound |
| `INBOX_FROM_EMAIL` | For email | Sender email address |
| `DEEPSEEK_API_KEY` | Optional | DeepSeek API key for reasoning mode |
| `DISABLE_GOOGLE_AUTH` | Optional | Set to `true` for dev login mode |
| `INBOUND_EMAIL_FALLBACK_WORKSPACE_ID` | Optional | Fallback workspace for unresolved inbound emails |

### Database

Generate the Prisma client and push schema:

```bash
npx prisma generate
npx prisma db push
```

Seed with initial data (optional):

```bash
npx tsx prisma/seed.ts
```

### Development

```bash
npm run dev
```

The app runs at `http://localhost:3000`.

### Build

```bash
npm run build
npm start
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Generate Prisma client + build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run test:forte` | Run Forte agent tests |
| `npm run test:i18n` | Run i18n tests |

## Key concepts

- **Workspace**: Multi-tenant unit. Each workspace has its own clients, projects, invoices, and configuration.
- **Vertical**: Business type (agency, consultancy, freelance, etc.) that determines vocabulary, modules, and defaults.
- **Mr. Forte**: AI orchestrator that recommends system improvements based on business state. Uses a registry of module/engine manifests to discover capabilities.
- **Smart Inbox**: Multi-channel conversation system (email, web chat) with AI classification, smart handoff, and CRM conversion.
- **Portal**: Client-facing portal with separate auth, scoped to the authenticated client's data.

## Data models

The system has two user-like models (legacy):

- **`User`**: Authenticated platform user with workspace membership, roles, and sessions.
- **`Usuario`**: Domain-level team member used for task assignment. Correlated with `User` by email, not by foreign key. Unification is planned.
