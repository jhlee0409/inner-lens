# inner-lens Vercel Serverless Function

Vercel에 프론트엔드를 배포할 때 함께 사용하는 API 함수입니다.

## 설치

### 1. 파일 복사

프로젝트 루트에 `api/` 폴더를 만들고 파일을 복사하세요:

```bash
# 프로젝트 루트에서
mkdir -p api/inner-lens
npx degit jhlee0409/inner-lens/templates/vercel/api/inner-lens api/inner-lens
```

또는 직접 복사:
```
your-project/
├── api/
│   └── inner-lens/
│       └── report.ts    ← 이 파일 복사
├── src/
└── ...
```

### 2. 환경변수 설정

Vercel Dashboard에서 환경변수 추가:

- `GITHUB_TOKEN`: GitHub Personal Access Token (repo scope)
- `GITHUB_REPOSITORY`: `owner/repo` 형식

또는 CLI로:
```bash
vercel env add GITHUB_TOKEN
vercel env add GITHUB_REPOSITORY
```

### 3. 배포

```bash
vercel
```

### 4. 위젯 설정

```tsx
<InnerLensWidget
  endpoint="/api/inner-lens/report"
/>
```

## 로컬 개발

```bash
vercel dev
```

## 비용

Vercel Hobby (무료):
- **100GB 대역폭/월**
- **Serverless Function 100시간/월**

버그 리포트용으로 충분합니다.
