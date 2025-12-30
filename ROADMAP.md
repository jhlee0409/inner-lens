# inner-lens ROADMAP

> 이 파일은 Claude Code가 자동으로 읽고 업데이트합니다.
> 체크박스: `[ ]` Todo, `[-]` In Progress, `[x]` Completed

---

## Phase 1: 즉시 수정 (P0)

### 1.1 templates/ 폴더 삭제 + README 백엔드 가이드 단순화
- [x] templates/ 폴더 삭제 ✅ 2025-12-30
- [x] README.md 백엔드 섹션 단순화 (프레임워크별 → 단일 가이드) ✅ 2025-12-30
- [x] Serverless 배포 섹션 정리 (Cloudflare/Vercel/Netlify 코드 예시만) ✅ 2025-12-30

### 1.2 InnerLensCore 편의 옵션 추가
- [x] `position` 옵션 추가 (styles.buttonPosition 매핑) ✅ 2025-12-30
- [x] `buttonColor` 옵션 추가 (styles.buttonColor 매핑) ✅ 2025-12-30
- [x] UI 텍스트 옵션 추가: `buttonText`, `dialogTitle`, `dialogDescription`, `submitText`, `cancelText`, `successMessage` ✅ 2025-12-30
- [x] examples/vanilla/index.html 업데이트 ✅ 2025-12-30
- [x] 타입 정의 업데이트 ✅ 2025-12-30

### 1.3 degit → tiged 마이그레이션
- [x] README.md에서 degit 참조 없음 (templates 삭제됨) ✅ 2025-12-30

---

## Phase 2: 중요 개선 (P1)

### 2.1 CLI UX 현대화 (Clack 도입)
- [x] @clack/prompts 의존성 추가 ✅ 2025-12-30
- [x] inquirer 의존성 제거 ✅ 2025-12-30
- [x] CLI 프롬프트 마이그레이션 ✅ 2025-12-30
- [x] 스피너/진행률 표시 개선 ✅ 2025-12-30
- [x] 취소 처리 (isCancel) 추가 ✅ 2025-12-30
- [x] 테스트 (138개 모두 통과) ✅ 2025-12-30

### 2.2 npm create inner-lens 지원
- [ ] package.json bin 필드에 create-inner-lens 추가
- [ ] 또는 별도 create-inner-lens 패키지 검토
- [ ] README에 사용법 추가

---

## Phase 3: UX 개선 (P2)

### 3.1 문서화 개선
- [ ] Quick Start 섹션 강화 (30초 설정)
- [ ] 트러블슈팅 섹션 추가
- [ ] FAQ 추가

### 3.2 에러 메시지 개선
- [ ] GITHUB_TOKEN 미설정 에러 메시지 개선
- [ ] GITHUB_REPOSITORY 형식 오류 메시지 개선
- [ ] 네트워크 오류 메시지 개선
- [ ] 해결 방법 + 문서 링크 포함

### 3.3 devOnly 동작 명확화
- [ ] 프로덕션에서 위젯 비활성화 시 콘솔 경고 추가
- [ ] README에 devOnly 기본값 명시

### 3.4 GitHub Actions Reusable Workflow
- [ ] 재사용 가능한 워크플로우 작성
- [ ] 사용 가이드 추가

---

## 완료된 작업

<!-- 완료된 항목은 여기로 이동 -->

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2025-12-30 | 초기 ROADMAP 생성 |
| 2025-12-30 | Phase 1 완료: templates 삭제, README 정리, 편의 옵션 추가 |
| 2025-12-30 | Phase 2.1 완료: CLI Clack 마이그레이션 (inquirer → @clack/prompts) |
