# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Express.js backend for a Subscription Tracker API. Provides CRUD operations for tracking user subscriptions with visit counting and time tracking. Uses Supabase as the database.

## Commands

```bash
npm install          # Install dependencies
npm start            # Start server (default port 3000)
```

## Environment Variables

Requires `.env` file with:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `PORT` (optional) - Server port, defaults to 3000

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | API info and endpoint list |
| GET | `/health` | Health check |
| GET | `/api/subscriptions/:userId` | Get user's subscriptions |
| POST | `/api/subscriptions` | Create subscription (requires `user_id`, `name`) |
| PUT | `/api/subscriptions/:id` | Update subscription |
| DELETE | `/api/subscriptions/:id` | Delete subscription |
| POST | `/api/subscriptions/:id/visit` | Record visit with optional `time_spent_seconds` |

## Database Schema

The `subscriptions` table has: `id`, `user_id`, `name`, `url`, `visit_count`, `total_time_seconds`, `last_visit`, `updated_at`
