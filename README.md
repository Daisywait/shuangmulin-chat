# 双木林-chat

A private, deployable ChatGPT-style web app for an OpenAI-compatible gateway.

## Local Setup

1. Install dependencies:

   ```powershell
   npm.cmd install
   ```

2. Copy the environment template:

   ```powershell
   Copy-Item .env.example .env.local
   ```

3. Fill `.env.local` with `AUTH_SECRET`, Supabase service role key, gateway base URL, gateway API key, and model config.

4. Run Supabase migrations:

   ```text
   supabase/migrations/001_init.sql
   supabase/migrations/002_users.sql
   ```

5. Start the dev server:

   ```powershell
   npm.cmd run dev
   ```

6. Open `http://localhost:3000`, register with your email, then sign in.

## Deploy

1. Push this folder to GitHub.
2. Create a Supabase project and run the SQL migrations.
3. Import the GitHub repo into Vercel.
4. Add all variables from `.env.example` to Vercel Environment Variables.
5. Redeploy after changing environment variables.
6. Bind your custom domain in Vercel.

## Notes

- Users register with email and password.
- Conversations are isolated per user.
- API keys are only used in server routes and are never sent to the browser.
- File uploads support text, PDF text extraction, and image attachments for models marked with `supportsImages`.
