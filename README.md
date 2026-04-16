# MPMATCH - Full-Stack Matching Platform

A modern full-stack web application built with **Next.js 14**, **TypeScript**, **Tailwind CSS**, and **Prisma**.

## 🚀 Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS with custom color palette
- **Database**: Prisma ORM with SQLite (development)
- **Authentication**: next-auth (optional)
- **Validation**: Zod
- **State Management**: TanStack React Query
- **UI Components**: Lucide React icons
- **Maps**: Leaflet & react-leaflet
- **Charts**: Recharts
- **Notifications**: react-hot-toast
- **HTTP Client**: Axios

## 📋 Project Structure

```
MPMATCH_New/
├── app/                    # Next.js App Router
│   ├── api/               # API route handlers
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles & Tailwind
├── components/            # Reusable React components
├── hooks/                 # Custom React hooks
├── lib/                   # Shared utilities (db, auth, sms, geo, audit)
├── prisma/                # Prisma schema & migrations
│   └── schema.prisma      # Database schema
├── public/                # Static assets
├── services/              # Business logic (SMS, alerts, reminders)
├── types/                 # Shared TypeScript types & enums
├── .env.example           # Environment variables template
├── .gitignore             # Git exclusions
├── next.config.js         # Next.js configuration
├── tailwind.config.ts     # Tailwind CSS custom palette
├── tsconfig.json          # TypeScript configuration
├── postcss.config.js      # PostCSS with Tailwind plugin
├── prettier.config.js     # Code formatting rules
└── package.json           # Dependencies & scripts
```

## 🎨 Custom Color Palette

- **Primary Dark Navy**: `#1a1a2e`
- **Accent Orange**: `#e67e22`
- **Warning Amber**: `#f39c12`
- **Danger Red**: `#e74c3c`
- **Success Green**: `#27ae60`
- **Neutral Gray**: `#ecf0f1`

Use these colors with Tailwind classes: `bg-primary`, `text-accent`, `border-danger`, etc.

## 🔧 Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Required environment variables:
- `DATABASE_URL` - SQLite file path (e.g., `file:./dev.db`)
- `JWT_SECRET` - JWT signing secret (min 32 characters)
- `NEXTAUTH_SECRET` - NextAuth secret
- `AFRICASTALKING_API_KEY` & `AFRICASTALKING_USERNAME` - SMS provider
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` - Alternative SMS
- `OPENAI_API_KEY` - AI/LLM integration
- `STORAGE_*` - Cloud storage credentials

### 3. Set Up Database

Initialize Prisma and create the SQLite database:

```bash
npm run prisma:migrate
```

Or generate Prisma client:

```bash
npm run prisma:generate
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📦 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Create and apply database migrations
- `npm run prisma:studio` - Open Prisma Studio UI

## 🌍 Environment Setup Details

### Database

This project uses **SQLite** by default for local development. Change `DATABASE_URL` in `.env.local` to use PostgreSQL or other databases:

```
DATABASE_URL="postgresql://user:password@localhost:5432/mpmatch"
```

### SMS Providers

Configure either **Africa's Talking** or **Twilio** for SMS notifications:

**Africa's Talking:**
- `AFRICASTALKING_API_KEY`
- `AFRICASTALKING_USERNAME`

**Twilio:**
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`

### Cloud Storage

Set up storage credentials for file uploads:
- `STORAGE_BUCKET`
- `STORAGE_ENDPOINT`
- `STORAGE_KEY`
- `STORAGE_SECRET`

## 📚 API Routes

- `GET /api/hello` - Test endpoint
- `POST /api/hello` - Post data example

## 🤝 Contributing

Contributions are welcome! Please follow the coding standards defined in `prettier.config.js`.

## 📄 License

MIT License - see LICENSE file for details

## 📞 Support

For issues or questions, create an issue in the repository.
