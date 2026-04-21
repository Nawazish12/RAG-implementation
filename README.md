# RAG Practice Lab

This project uses GitHub Actions for CI/CD and deploys to Vercel automatically.

## What happens on push

- Every push and pull request runs:
  - `npm ci`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`
- Every successful push to `main` deploys the app to Vercel production.

## Required GitHub secrets

Add these repository secrets in GitHub: `Settings -> Secrets and variables -> Actions`.

### Vercel deployment

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

### Runtime environment variables

These should be added in Vercel project settings so the deployed app can run:

- `OPENAI_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_CHAT_MODEL` (optional)
- `OPENAI_EMBEDDING_MODEL` (optional)

## How to get the Vercel values

1. Import this repo into Vercel once.
2. In Vercel, open the project settings.
3. Copy the project ID and org ID from the project/environment settings or from a local `vercel pull`.
4. Create a Vercel token from your Vercel account settings.

## Triggering deployment

Push to `main`:

```bash
git push origin main
```

That push will run checks first and deploy automatically if they pass.
