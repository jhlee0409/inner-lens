---
paths:
  - "src/utils/masking.ts"
  - "src/server.ts"
  - "api/**/*.ts"
  - "scripts/analyze-issue.ts"
---

# 보안 규칙

> ⚠️ 이 파일들은 민감 데이터를 다룹니다. 변경 시 sub-agent 검증을 요청하세요.

## 마스킹 필수

AI 처리 전 **반드시** 민감 데이터 마스킹:

```typescript
import { maskSensitiveData } from './utils/masking';

// ✅ 올바름
const maskedLogs = maskSensitiveData(rawLogs);
await analyzeWithAI(maskedLogs);

// ❌ 잘못됨
await analyzeWithAI(rawLogs); // 마스킹 없이 전송
```

## 마스킹 패턴 (30개)

| 패턴 | 치환값 |
|------|--------|
| Discord 웹훅 | `[DISCORD_WEBHOOK_REDACTED]` |
| 데이터베이스 URL | `[DATABASE_URL_REDACTED]` |
| 이메일 | `[EMAIL_REDACTED]` |
| Bearer 토큰 | `[TOKEN_REDACTED]` |
| API 키 파라미터 | `[API_KEY_REDACTED]` |
| Authorization 헤더 | `[AUTH_REDACTED]` |
| 신용카드 (번호) | `[CARD_REDACTED]` |
| 신용카드 (포맷) | `[CARD_REDACTED]` |
| SSN | `[SSN_REDACTED]` |
| 전화번호 | `[PHONE_REDACTED]` |
| IPv4 주소 | `[IP_REDACTED]` |
| IPv6 주소 | `[IP_REDACTED]` |
| AWS Access Key | `[AWS_KEY_REDACTED]` |
| AWS Secret Key | `[AWS_SECRET_REDACTED]` |
| GitHub 토큰 | `[GITHUB_TOKEN_REDACTED]` |
| OpenAI API 키 | `[OPENAI_KEY_REDACTED]` |
| Anthropic API 키 | `[ANTHROPIC_KEY_REDACTED]` |
| Google API 키 | `[GOOGLE_KEY_REDACTED]` |
| Stripe 키 | `[STRIPE_KEY_REDACTED]` |
| JWT 토큰 | `[JWT_REDACTED]` |
| 환경변수 시크릿 | `[SECRET_REDACTED]` |
| Private Key (PEM) | `[PRIVATE_KEY_REDACTED]` |
| Slack 토큰 | `[SLACK_TOKEN_REDACTED]` |
| NPM 토큰 | `[NPM_TOKEN_REDACTED]` |
| SendGrid 키 | `[SENDGRID_KEY_REDACTED]` |
| Twilio SID | `[TWILIO_REDACTED]` |
| JSON 민감 키 | `[REDACTED]` |
| ENV 민감 키 | `[REDACTED]` |
| Query 민감 키 | `[REDACTED]` |
| Header 민감 키 | `[REDACTED]` |

## API 보안

```typescript
// ✅ 환경변수에서 시크릿 로드
const token = process.env.GITHUB_TOKEN;

// ❌ 하드코딩 금지
const token = 'ghp_xxxxx';
```

## Rate Limiting

```typescript
// api/report.ts - 10 req/min/IP 적용됨
// 변경 시 README 업데이트 필수
```

## GitHub App 인증

```typescript
// ✅ 올바른 패턴
const app = new App({
  appId: process.env.GITHUB_APP_ID!,
  privateKey: process.env.GITHUB_APP_PRIVATE_KEY!,
});
const octokit = await app.getInstallationOctokit(installationId);

// ❌ 개인 토큰 사용 금지 (hosted 모드에서)
```

## 체크리스트

변경 전 확인:
- [ ] 새로운 데이터 필드에 마스킹 필요한가?
- [ ] 로그에 민감 정보 노출되는가?
- [ ] 에러 메시지에 시크릿 포함되는가?
- [ ] 클라이언트에 불필요한 데이터 전송하는가?
