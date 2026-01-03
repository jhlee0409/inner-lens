# inner-lens 중앙화 서버 설정 가이드

이 가이드는 inner-lens를 중앙화 모드로 운영하는 방법을 설명합니다.
모든 버그 리포트가 `inner-lens-app[bot]`으로 생성됩니다.

## 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────┐
│                         사용자 앱                                │
│  ┌─────────────┐                                                │
│  │ inner-lens  │ ──POST──> inner-lens-one.vercel.app/api/report │
│  │   Widget    │                      │                         │
│  └─────────────┘                      │                         │
└───────────────────────────────────────│─────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Vercel (inner-lens 운영)                      │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ api/report.ts                                               ││
│  │                                                             ││
│  │ 1. 요청 검증                                                 ││
│  │ 2. Rate limiting (10 req/min/IP)                            ││
│  │ 3. 민감 정보 마스킹                                          ││
│  │ 4. GitHub App 토큰 발급                                      ││
│  │ 5. 이슈 생성                                                 ││
│  └─────────────────────────────────────────────────────────────┘│
└───────────────────────────────────────│─────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                         GitHub                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 이슈 생성됨                                                  ││
│  │ Author: inner-lens-app[bot]                                 ││
│  │ Labels: bug, inner-lens                                     ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Step 1: GitHub App 생성

### 1.1 GitHub App 생성 페이지 접속

https://github.com/settings/apps/new

### 1.2 기본 정보 입력

| 필드 | 값 |
|------|---|
| GitHub App name | `inner-lens-app` |
| Homepage URL | `https://github.com/jhlee0409/inner-lens` |
| Webhook | ☐ Active (체크 해제) |

### 1.3 권한 설정

**Repository permissions:**

| Permission | Access |
|------------|--------|
| Issues | Read & Write |
| Metadata | Read-only |

**Where can this GitHub App be installed?**
- ● Any account (누구나 설치 가능)

### 1.4 App 생성 후 정보 저장

생성 후 다음 정보를 저장하세요:

```bash
# App ID (숫자)
GITHUB_APP_ID=123456

# App 페이지 하단에서 Private Key 생성
# "Generate a private key" 클릭 → .pem 파일 다운로드
```

### 1.5 Private Key 포맷 변환

```bash
# .pem 파일 내용을 한 줄로 변환 (Vercel 환경변수용)
cat inner-lens.*.private-key.pem | tr '\n' '\\n' | sed 's/\\n$//'
```

---

## Step 2: Vercel 배포

### 2.1 Vercel에 프로젝트 연결

```bash
# Vercel CLI 설치 (없는 경우)
npm i -g vercel

# 프로젝트 연결
cd inner-lens
vercel link
```

### 2.2 환경변수 설정

Vercel Dashboard > Settings > Environment Variables:

| Name | Value | Environment |
|------|-------|-------------|
| `GITHUB_APP_ID` | `123456` | Production, Preview, Development |
| `GITHUB_APP_PRIVATE_KEY` | `-----BEGIN RSA PRIVATE KEY-----\nMIIE...` | Production, Preview, Development |

⚠️ **중요:** Private Key는 `\n`을 실제 줄바꿈 문자로 입력하세요.

### 2.3 도메인 설정 (선택)

Vercel Dashboard > Settings > Domains:

- `api.inner-lens.dev` 또는 원하는 도메인 연결

### 2.4 배포

```bash
vercel --prod
```

---

## Step 3: 클라이언트 설정 변경

### 3.1 기존 방식 (분산형)

```typescript
// 사용자가 직접 서버 엔드포인트 운영
<InnerLensWidget
  endpoint="/api/bug-report"  // 사용자 서버
/>
```

### 3.2 새로운 방식 (중앙형)

```typescript
// inner-lens 중앙 서버 사용
<InnerLensWidget
  endpoint="https://inner-lens-one.vercel.app/api/report"
  owner="your-org"
  repo="your-repo"
/>
```

---

## Step 4: 사용자 가이드

inner-lens를 사용하는 개발자들에게 안내할 내용:

### 설치 방법

1. **GitHub App 설치**
   - https://github.com/apps/inner-lens-app 방문
   - "Install" 클릭
   - 버그 리포트 받을 레포 선택

2. **위젯 설정**
   ```typescript
   import { InnerLensWidget } from 'inner-lens/react';

   function App() {
     return (
       <>
         <YourApp />
         <InnerLensWidget
           endpoint="https://inner-lens-one.vercel.app/api/report"
           owner="your-org"
           repo="your-repo"
         />
       </>
     );
   }
   ```

3. **끝!**
   - 버그 리포트 → `inner-lens-app[bot]`이 이슈 생성
   - AI 분석 자동 실행 (워크플로우 설정된 경우)

---

## 비용 예상

| 사용량 | Vercel 비용 | 비고 |
|--------|-------------|------|
| 월 100K 요청 | $0 | Pro 플랜 무료 범위 |
| 월 1M 요청 | ~$20 | 추가 함수 호출 비용 |
| 월 10M 요청 | ~$200 | Enterprise 고려 |

---

## 모니터링

### Vercel Analytics

Vercel Dashboard > Analytics에서 모니터링:
- 요청 수
- 응답 시간
- 에러율

### 로그 확인

```bash
vercel logs --follow
```

---

## 보안 고려사항

1. **Rate Limiting**: API에 IP 기반 rate limit 적용됨 (10 req/min/IP)
2. **민감 정보 마스킹**: 이메일, API 키, JWT 등 자동 마스킹
3. **CORS**: 모든 origin 허용 (위젯이 어디서든 호출 가능하도록)
4. **Private Key 보안**: Vercel 환경변수에만 저장, 코드에 포함하지 않음

---

## 문제 해결

### "inner-lens app is not installed on this repository"

사용자가 GitHub App을 설치하지 않았거나, 해당 레포에 권한을 부여하지 않음.

**해결:** https://github.com/apps/inner-lens-app 에서 App 설치

### "Rate limit exceeded"

동일 IP에서 너무 많은 요청.

**해결:** 1분 후 재시도 또는 rate limit 조정

### "Failed to create issue"

GitHub API 오류.

**해결:** Vercel 로그 확인 (`vercel logs`)

---

## 다음 단계

- [ ] GitHub App 생성
- [ ] Vercel 환경변수 설정
- [ ] 배포 (`vercel --prod`)
- [ ] 테스트 이슈 생성
- [ ] 문서 업데이트 (README에 새 설정 방법 추가)
