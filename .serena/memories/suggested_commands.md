# 개발 명령어

## 필수 검증 (변경 후 항상 실행)
```bash
npm run typecheck    # 타입 체크
npm run test         # 테스트 실행
```

## 개발
```bash
npm run dev          # 개발 서버 (watch 모드)
npm run build        # 프로덕션 빌드
npm run test:watch   # 테스트 watch 모드
npm run test:coverage # 커버리지 리포트
```

## 예제 실행
```bash
npm run example      # Vanilla JS 예제 서버
npm run example:dev  # 빌드 후 예제 실행
```

## 슬래시 명령어 (Claude Code)
- `/project:fix-issue #123` - 이슈 수정
- `/project:new-feature 기능명` - 새 기능 구현
- `/project:review 파일경로` - 코드 리뷰
- `/project:test 대상` - 테스트 작성
