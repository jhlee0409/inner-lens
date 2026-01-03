# Centralized Server Setup (Admin Guide)

This guide is for **server administrators** who want to run their own centralized inner-lens API, similar to the official hosted service at `inner-lens-one.vercel.app`.

> **Note:** If you're a user looking to integrate inner-lens into your app, see the [README](../README.md) instead.

## Overview

A centralized server allows multiple repositories to use a single API endpoint for bug reporting, with issues created by a GitHub App bot account.

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Apps                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ App A       │  │ App B       │  │ App C       │              │
│  │ (owner/a)   │  │ (owner/b)   │  │ (org/c)     │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         └────────────────┼───────────────┘                      │
│                          │ POST /api/report                      │
└──────────────────────────┼──────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Your Vercel Server                            │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ api/report.ts                                               ││
│  │ - Request validation                                        ││
│  │ - Rate limiting (10 req/min/IP)                             ││
│  │ - Sensitive data masking                                    ││
│  │ - GitHub App authentication                                 ││
│  └─────────────────────────────────────────────────────────────┘│
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                         GitHub                                   │
│  Issues created by: your-app-name[bot]                          │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

- Vercel account (Pro recommended for production)
- GitHub account for creating the App

## Step 1: Create GitHub App

1. Go to https://github.com/settings/apps/new

2. Fill in the required fields:

   | Field | Value |
   |-------|-------|
   | GitHub App name | `your-app-name` (must be unique) |
   | Homepage URL | Your project URL |
   | Webhook | Uncheck "Active" |

3. Set permissions:

   | Permission | Access |
   |------------|--------|
   | Issues | Read & Write |
   | Metadata | Read-only |

4. Under "Where can this GitHub App be installed?", select:
   - **Any account** (for public service)
   - **Only on this account** (for private use)

5. Click **Create GitHub App**

6. After creation, note the **App ID** (shown at the top)

7. Scroll down and click **Generate a private key** — download the `.pem` file

## Step 2: Deploy to Vercel

### Option A: Fork and Deploy

1. Fork the `inner-lens` repository
2. Connect to Vercel
3. Deploy

### Option B: Use Existing Deployment

The `api/` directory in inner-lens is already configured for Vercel.

### Environment Variables

Set these in Vercel Dashboard → Settings → Environment Variables:

| Name | Value |
|------|-------|
| `GITHUB_APP_ID` | Your App ID (number) |
| `GITHUB_APP_PRIVATE_KEY` | Contents of the `.pem` file |

**Important:** For the private key, paste the entire file contents including the `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----` lines. Vercel will handle the formatting.

### Deploy

```bash
vercel --prod
```

Or use the Vercel dashboard to trigger a deployment.

## Step 3: Test the Deployment

### Health Check

```bash
curl https://your-domain.vercel.app/api/health
```

Expected response:
```json
{"status":"ok","service":"inner-lens-api","version":"1.0.0","timestamp":"..."}
```

### Test Bug Report

First, install your GitHub App on a test repository.

```bash
curl -X POST https://your-domain.vercel.app/api/report \
  -H "Content-Type: application/json" \
  -d '{
    "owner": "your-username",
    "repo": "your-repo",
    "description": "Test bug report"
  }'
```

Expected response:
```json
{"success":true,"issueNumber":1,"issueUrl":"https://github.com/..."}
```

## Step 4: User Instructions

Provide these instructions to your users:

### 1. Install GitHub App

Visit `https://github.com/apps/your-app-name` and install on repositories.

### 2. Configure Widget

```tsx
<InnerLensWidget
  endpoint="https://your-domain.vercel.app/api/report"
  repository="their-org/their-repo"
/>
```

## API Reference

### POST /api/report

Creates a GitHub issue from a bug report.

**Request:**
```json
{
  "owner": "string",       // Required: GitHub owner/org
  "repo": "string",        // Required: Repository name
  "description": "string", // Required: Bug description
  "logs": [...],           // Optional: Console logs
  "url": "string",         // Optional: Page URL
  "userAgent": "string",   // Optional: Browser info
  "metadata": {...}        // Optional: Custom data
}
```

**Response (Success):**
```json
{
  "success": true,
  "issueNumber": 123,
  "issueUrl": "https://github.com/owner/repo/issues/123"
}
```

**Response (Error):**
```json
{
  "error": "inner-lens app is not installed on this repository",
  "installUrl": "https://github.com/apps/your-app-name/installations/new"
}
```

### GET /api/health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "inner-lens-api",
  "version": "1.0.0",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

## Rate Limiting

The API implements in-memory rate limiting:
- 10 requests per minute per IP address
- Returns 429 Too Many Requests when exceeded

For production with high traffic, consider implementing Redis-based rate limiting.

## Monitoring

### Vercel Analytics

Monitor via Vercel Dashboard → Analytics:
- Request count
- Response time
- Error rate

### Logs

```bash
vercel logs --follow
```

## Cost Estimation

| Usage | Vercel Cost | Notes |
|-------|-------------|-------|
| 100K req/month | $0 | Pro plan included |
| 1M req/month | ~$20 | Additional function invocations |
| 10M req/month | ~$200 | Consider Enterprise |

## Security Considerations

1. **Private Key**: Never commit to git; use environment variables only
2. **Rate Limiting**: Prevents abuse; adjust limits as needed
3. **Data Masking**: Emails, API keys, JWTs are masked before issue creation
4. **CORS**: Currently allows all origins; restrict in production if needed

## Troubleshooting

### "inner-lens app is not installed on this repository"

The user hasn't installed your GitHub App, or the App doesn't have access to the specified repository.

**Solution:** Direct users to `https://github.com/apps/your-app-name`

### "Rate limit exceeded"

Too many requests from the same IP.

**Solution:** Wait 1 minute, or adjust `RATE_LIMIT` constant in `api/report.ts`

### "Server configuration error"

Environment variables are missing.

**Solution:** Check `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY` are set in Vercel

### "Authentication error"

Private key is invalid or expired.

**Solution:** Generate a new private key in GitHub App settings
