# Pipeline Tool

Next.js 16 + React 19 sales pipeline management app using Supabase Auth + Supabase Postgres.

## Local dev

1. Install deps

	`npm install`

2. Create `.env.local`

	Copy from `.env.example` and set:

	- `NEXT_PUBLIC_SUPABASE_URL`
	- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3. Run the app

	`npm run dev`

Open http://localhost:3000

## Cloud deployment (runs without your laptop)

Recommended: Vercel + Supabase.

1. Push to GitHub (already set up in this repo)
2. In Vercel: **New Project** → import the GitHub repo
3. Add Environment Variables in Vercel (Production + Preview):
	- `NEXT_PUBLIC_SUPABASE_URL`
	- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. In Supabase Auth settings:
	- Set **Site URL** to your Vercel domain (e.g. `https://your-app.vercel.app`)
	- Add Redirect URLs as needed (e.g. `https://your-app.vercel.app/**`)

After that, every `git push` to `main` triggers a cloud build + deploy.

## Docs

- Feature guide: `QUICK_START.md`
- Robustness notes: `ROBUSTNESS.md`
