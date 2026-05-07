# Dual Database Setup: SQLite + Supabase PostgreSQL

This guide explains how to run both SQLite (local) and Supabase (online) databases simultaneously during your migration.

## Overview

- **Primary Database**: Supabase PostgreSQL (production/online)
- **Secondary Database**: SQLite (local development reference)
- **Schema**: Single Prisma schema configured for PostgreSQL

## Setup Instructions

### 1. Install cross-env for Environment Switching

```bash
npm install --save-dev cross-env
```

This allows you to switch between databases easily.

### 2. Your Environment Files

#### `.env.local` (Primary - Supabase)
```
DATABASE_URL="postgresql://postgres:YOUR_SUPABASE_PASSWORD@db.awvghfpgqleqgoevcpoj.supabase.co:5432/postgres?schema=public"
DATABASE_URL_LOCAL="file:C:/Users/DELL/Desktop/MPMATCH_New/prisma/dev.db"
```

**Replace**: `YOUR_SUPABASE_PASSWORD` with your actual Supabase password

#### `.env.development` (Local - SQLite)
Use this when you want to work locally:
```bash
# Copy .env.local to .env.development and update DATABASE_URL to SQLite
DATABASE_URL="file:./prisma/dev.db"
```

### 3. Initialize Supabase Database

Run migrations to create your schema on Supabase:

```bash
# Generate Prisma client
npm run prisma:generate

# Create migrations on Supabase
npx prisma migrate dev --name init
```

This creates all tables on your Supabase PostgreSQL database.

### 4. Sync Data from SQLite to Supabase

If you have existing data in SQLite that you want to transfer:

```bash
# Verify both databases have matching record counts
npm run db:verify

# Export SQLite data to Supabase
npm run db:sync
```

### 5. Switch Between Development Modes

#### Option A: Use Supabase (Primary)
```bash
# Uses DATABASE_URL (Supabase)
npm run dev
```

#### Option B: Use Local SQLite (Development Reference)
```bash
# Temporarily switch to SQLite for local development
npm run db:local
```

This uses `.env.development` which points to local SQLite.

## Working with Both Databases

### Workflow During Migration

1. **New Features**: Develop and test with Supabase
   ```bash
   npm run dev
   ```

2. **Backup/Reference**: Keep SQLite synced
   ```bash
   npm run db:verify    # Check consistency
   npm run db:sync      # Update SQLite from Supabase (if needed)
   ```

3. **Local Testing**: Work offline with SQLite
   ```bash
   npm run db:local
   ```

### Database Sync Commands

```bash
# Export data from SQLite → Supabase
npm run db:sync

# Verify data consistency between both databases
npm run db:verify

# View database with Prisma Studio (connects to DATABASE_URL)
npm run prisma:studio
```

## Important Notes

⚠️ **Schema Changes**:
- Always edit `prisma/schema.prisma` (PostgreSQL version)
- Create migrations: `npx prisma migrate dev --name description`
- These apply to Supabase only

⚠️ **Switching Databases**:
- `.env.local` = Supabase (primary)
- `.env.development` = SQLite (local only)
- Use `npm run db:local` to switch environments

⚠️ **Data Loss**:
- Syncing clears existing records before importing
- Always backup before syncing production data
- Test with sample data first

## Troubleshooting

### Connection String Format

Supabase connection string should be:
```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public
```

Example:
```
postgresql://postgres:mypassword@db.abc123.supabase.co:5432/postgres?schema=public
```

### Verify Connection

```bash
# Test Supabase connection
npm run prisma:studio

# This should open Prisma Studio connected to Supabase
```

### Reset Supabase Database

```bash
# Drop all tables and recreate schema
npx prisma migrate reset

# Choose 'yes' to confirm
```

## Migration Checklist

- [ ] Update `.env.local` with Supabase password
- [ ] Run `npm run prisma:generate`
- [ ] Run `npx prisma migrate dev --name init`
- [ ] Verify connection with `npm run prisma:studio`
- [ ] If you have existing data: `npm run db:verify` and `npm run db:sync`
- [ ] Update `.env.development` for local SQLite
- [ ] Test with `npm run dev` (uses Supabase)
- [ ] Test with `npm run db:local` (uses SQLite)

## Next Steps

1. **Add Supabase password** to `.env.local`
2. **Run initial migration**: `npx prisma migrate dev --name init`
3. **Sync your data**: `npm run db:sync`
4. **Verify success**: `npm run db:verify`
5. **Deploy**: Your app now uses Supabase online!

For Supabase best practices, see: [Supabase PostgreSQL Optimization](./SUPABASE_OPTIMIZATION.md)
