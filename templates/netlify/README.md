# inner-lens Netlify Function

Netlify에 프론트엔드를 배포할 때 함께 사용하는 함수입니다.

## 설치

### 1. 파일 복사

프로젝트 루트에 `netlify/functions/` 폴더를 만들고 파일을 복사하세요:

```bash
mkdir -p netlify/functions
npx degit jhlee0409/inner-lens/templates/netlify/netlify/functions netlify/functions
```

또는 직접 복사:
```
your-project/
├── netlify/
│   └── functions/
│       └── inner-lens-report.ts    ← 이 파일 복사
├── src/
└── ...
```

### 2. 환경변수 설정

Netlify Dashboard > Site settings > Environment variables:

- `GITHUB_TOKEN`: GitHub Personal Access Token (repo scope)
- `GITHUB_REPOSITORY`: `owner/repo` 형식

### 3. 배포

```bash
netlify deploy --prod
```

### 4. 위젯 설정

```tsx
<InnerLensWidget
  endpoint="/.netlify/functions/inner-lens-report"
/>
```

## 로컬 개발

```bash
netlify dev
```

## 비용

Netlify Free:
- **125,000 함수 호출/월**
- **100시간 실행 시간/월**

버그 리포트용으로 충분합니다.
