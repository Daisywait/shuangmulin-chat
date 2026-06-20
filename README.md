# 双木林-chat

A private, deployable ChatGPT-style web app for OpenAI-compatible and Claude-compatible API gateways.

## Local Setup

1. Install dependencies:

   ```powershell
   npm.cmd install
   ```

2. Copy the environment template:

   ```powershell
   Copy-Item .env.example .env.local
   ```

3. Fill `.env.local` with your admin login, Supabase service role key, gateway base URLs, gateway API keys, and model list.

4. Run the Supabase migration in `supabase/migrations/001_init.sql`.

5. Start the dev server:

   ```powershell
   npm.cmd run dev
   ```

6. Open `http://localhost:3000`.

## Deploy To A Domain

1. Push this folder to a GitHub repository.
2. Create a Supabase project and run `supabase/migrations/001_init.sql` in the SQL editor.
3. Import the GitHub repo into Vercel.
4. Add all variables from `.env.example` to Vercel project settings.
5. Add your custom domain in Vercel. Follow Vercel's DNS instructions to point the domain to the project.
6. After DNS verification, use `https://your-domain` from any computer and log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

## Model Config Example

```json
[
  {
    "id": "gpt-4o-mini",
    "label": "GPT-4o Mini",
    "provider": "openai",
    "supportsImages": true
  },
  {
    "id": "claude-3-5-sonnet",
    "label": "Claude Sonnet",
    "provider": "anthropic",
    "supportsImages": true
  }
]
```

The `id` must match the model name accepted by your gateway.

## Notes

- API keys are only used in server routes and are never sent to the browser.
- This first version is designed for one administrator account.
- File uploads support text, PDF text extraction, and image attachments for models marked with `supportsImages`.
