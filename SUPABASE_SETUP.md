# Supabase Setup Guide for AI-Faculty

This guide covers setting up Supabase for the AI-Faculty application.

## Prerequisites

- A Supabase project ([Create one here](https://supabase.com))
- Node.js 20+
- npm installed

## 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign in.
2. Click "New Project" or use an existing project.
3. Note the Project URL and API keys from the Settings → API page.

## 2. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# AI Teaching Providers (server-side only)
GEMINI_API_KEY=your-gemini-key
GROQ_API_KEY=your-groq-key
MISTRAL_API_KEY=your-mistral-key
MISTRAL_MODEL=mistral-small-latest
```

**Important:** Never commit `.env.local` to version control.

## 3. Apply SQL Migrations

The SQL migrations are in `supabase/migrations/`. Apply them using the Supabase CLI or the Dashboard:

### Option A: Using Supabase CLI

```bash
npx supabase db push
```

### Option B: Using the Dashboard

1. Go to your Supabase project dashboard.
2. Navigate to "SQL Editor".
3. Copy the contents of `supabase/migrations/001_initial_schema.sql`.
4. Paste and run the SQL.

The migration creates the following tables:

| Table | Description |
|-------|-------------|
| `profiles` | User profiles with display name, language, teaching depth |
| `teaching_sessions` | Lesson sessions with board/visual state |
| `lesson_steps` | Individual teaching steps within a session |
| `messages` | User questions and assistant responses |
| `saved_lessons` | Bookmarked lessons |
| `learning_progress` | Progress tracking per session |
| `usage_records` | Token usage records |

All tables have Row Level Security (RLS) enabled with appropriate policies.

## 4. Generate Database Types

The TypeScript database types are already defined in `lib/supabase/types.ts`. If you need to regenerate them:

```bash
npx supabase gen types --lang typescript --schema public > lib/supabase/types.ts
```

## 5. Configure Authentication Providers

1. Go to your Supabase project dashboard.
2. Navigate to "Authentication" → "Providers".
3. Enable "Email" provider.
4. Configure the following:

### Email Templates

Customize the email templates in the "Email Templates" section:

- **Sign Up Confirmation**: Customize the welcome email sent after signup.
- **Password Reset**: Customize the password reset email.

### Redirect URLs

Configure redirect URLs in "Authentication" → "URL Configuration":

- **Site URL**: `http://localhost:3000` (development) or your production URL
- **Redirect URLs**:
  - `http://localhost:3000/auth/callback` (for email confirmation)
  - `http://localhost:3000/reset-password` (for password reset)

For production, replace `localhost:3000` with your actual domain.

## 6. Start the App Locally

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

## 7. Run Tests

```bash
npm run test
```

## 8. Verify the Application

To verify the application works correctly:

1. **Sign Up**: Navigate to `/signup` and create a new account with a valid email.
2. **Verify Email**: Check your email and click the verification link (if email verification is enabled).
3. **Sign In**: Go to `/login` and sign in with your credentials.
4. **Create a Lesson**: Click "New Lesson" and enter a topic.
5. **Verify Persistence**: Refresh the page and verify your lesson is restored.
6. **Sign Out**: Verify you can sign out and sign back in.

### Test with Two Users

To verify RLS and isolation:

1. Sign up as User A and create a lesson.
2. Sign out and sign up as User B.
3. Verify User B cannot see User A's lessons.
4. Sign in as User A and verify User A's lessons are visible.

## Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Your Supabase anonymous key |
| `GEMINI_API_KEY` | No | Gemini API key for AI teaching |
| `GROQ_API_KEY` | No | Groq API key for AI teaching |
| `MISTRAL_API_KEY` | No | Mistral API key for AI teaching |
| `MISTRAL_MODEL` | No | Mistral model name (default: mistral-small-latest) |

## Troubleshooting

### "Invalid login credentials" error
- Verify your email and password are correct.
- Check if email verification is required and verify your email.

### "Session not found" error
- Ensure you're logged in.
- Verify the session ID is correct and belongs to you.

### Database connection errors
- Verify your Supabase URL and keys are correct.
- Check that the SQL migrations have been applied.

## Security Notes

- The Supabase service role key is never exposed to the browser.
- All database access is protected by Row Level Security (RLS).
- Server-side API routes verify user authentication and session ownership.
- Client-side code only uses the anonymous key.