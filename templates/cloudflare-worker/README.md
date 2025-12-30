# inner-lens Cloudflare Worker

프론트엔드 전용 프레임워크(Vite, Vanilla JS 등)를 위한 서버리스 백엔드입니다.

## 1-Click Deploy

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/jhlee0409/inner-lens/tree/main/templates/cloudflare-worker)

## 수동 설치

### 1. 프로젝트 클론

```bash
npx degit jhlee0409/inner-lens/templates/cloudflare-worker inner-lens-worker
cd inner-lens-worker
npm install
```

### 2. 환경변수 설정

```bash
# GitHub 토큰 설정 (secret)
npx wrangler secret put GITHUB_TOKEN
# 프롬프트에 GitHub Personal Access Token 입력 (repo scope 필요)

# wrangler.toml 수정
# GITHUB_REPOSITORY = "your-username/your-repo"
```

### 3. 배포

```bash
npm run deploy
```

### 4. 위젯에 엔드포인트 설정

```tsx
<InnerLensWidget
  endpoint="https://inner-lens-api.your-subdomain.workers.dev"
/>
```

## 로컬 개발

```bash
npm run dev
```

## 비용

Cloudflare Workers 무료 플랜:
- **10만 요청/일** (충분!)
- 신용카드 불필요

## 문제 해결

### CORS 에러
Worker가 이미 CORS 헤더를 포함하고 있습니다. 문제가 있다면 브라우저 캐시를 삭제해보세요.

### GitHub API 에러
- `GITHUB_TOKEN`이 올바른지 확인
- 토큰에 `repo` 또는 `public_repo` scope가 있는지 확인
- `GITHUB_REPOSITORY`가 `owner/repo` 형식인지 확인
