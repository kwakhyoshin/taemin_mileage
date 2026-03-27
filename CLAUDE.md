# mile.ly 프로젝트 규칙

## 브랜치 전략
- main: 운영기. 직접 수정 절대 금지.
- dev: 개발기. 모든 개발은 여기서.
- main의 루트 index.html: 운영기 전용 (절대 덮어쓰지 않는다)
- main의 dev/ 폴더: 개발기 코드 (sync 스크립트로만 동기화)

## 배포
- dev→main/dev 동기화: scripts/sync-dev-to-main.sh만 사용
- 루트 index.html의 _ENV는 항상 'prod'

## 동시 수정 금지
- 한 번에 하나의 Code Task만 index.html 수정
- 병렬 작업 시 같은 파일 동시 수정 금지
