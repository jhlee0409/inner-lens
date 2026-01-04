# 코드베이스 구조

## 핵심 디렉토리
```
src/                    # 메인 소스 코드
├── types.ts           # 공유 타입 정의 ⭐ (변경 시 전체 영향)
├── core/
│   └── InnerLensCore.ts  # 위젯 핵심 로직
├── components/
│   └── InnerLensWidget.tsx  # React 위젯
├── hooks/
│   └── useInnerLens.ts     # React 훅
├── utils/
│   ├── masking.ts     # 민감정보 마스킹 ⭐ (보안 핵심)
│   ├── log-capture.ts # 로그 캡처
│   ├── session-replay.ts # 세션 리플레이
│   └── analysis.ts    # 분석 유틸
├── server.ts          # Self-hosted 백엔드
└── cli.ts             # CLI

api/                   # Vercel Functions
├── report.ts          # POST /api/report ⭐
├── _shared.ts         # 공유 유틸 (src import 불가!)
└── health.ts          # 헬스 체크

scripts/
└── analyze-issue.ts   # AI 분석 엔진 ⭐
```

## 진입점 파일
- `src/core.ts` - 메인 진입점
- `src/react.ts` - React 진입점
- `src/vue.ts` - Vue 진입점
- `src/vanilla.ts` - Vanilla JS 진입점
- `src/server.ts` - 서버 진입점
- `src/replay.ts` - 리플레이 진입점

## 파일 의존성 주의사항
- `api/` 폴더는 `src/`에서 import 불가 (Vercel 제약)
- `api/_shared.ts`에 필요한 타입/유틸 복제 유지
- `src/types.ts` 변경 시 `api/_shared.ts` 동기화 필수
