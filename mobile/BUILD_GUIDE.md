# Memorial 앱 빌드 가이드 (Step 10 완료)

---

## 0. 사전 준비

### EAS CLI 설치 및 로그인
```bash
npm install -g eas-cli
eas login  # expo.dev 계정으로 로그인
```

### 패키지 설치
```bash
cd d:/portfolio/Memorial/mobile
npm install
```

---

## 1. 환경변수 설정

```bash
# .env.example 복사
cp .env.example .env
```

`.env` 파일을 열어서 값 채우기:

```env
# 배포된 백엔드 주소로 변경
EXPO_PUBLIC_API_URL=https://배포된백엔드주소.com

# Firebase 콘솔 → 프로젝트 설정 → 앱 → 구성에서 복사
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSy...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=memorial-xxxxx.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=memorial-xxxxx
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=memorial-xxxxx.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:android:abc123
```

---

## 2. 앱 아이콘 / 스플래시 이미지

| 파일 | 크기 | 설명 |
|------|------|------|
| `assets/icon.png` | 1024×1024 | 앱 아이콘 (투명 배경 없이) |
| `assets/adaptive-icon.png` | 1024×1024 | Android 어댑티브 아이콘 전경 |
| `assets/splash-icon.png` | 1242×2436 | 스플래시 이미지 |

### 옵션 A: 스크립트로 자동 생성 (Memorial 브랜드 아이콘)
```bash
npm install canvas        # canvas 패키지 설치 (1회)
node scripts/generate-icons.js
```

### 옵션 B: 직접 디자인
- Figma/Canva에서 제작 후 `assets/` 폴더에 덮어쓰기
- 색상: `#5c4a3a` (main), `#c4956a` (point), 배경 `#1a1a2e` (어두운 테마 추천)

> 현재 Expo 기본 이미지가 들어 있어. 스토어 출시 전에 반드시 교체.
> 개발/테스트 빌드는 기본 이미지로도 가능.

---

## 3. APK 빌드 (Android)

### 개발용 APK (개인 테스트 - Firebase 포함)
```bash
npm run build:dev
# 또는
eas build --profile development --platform android
```
→ `.apk` 파일 다운로드 → 안드로이드에 직접 설치

### 프리뷰 APK (지인 배포)
```bash
npm run build:preview
# 또는
eas build --profile preview --platform android
```
→ 다운로드 링크 공유 가능

### 스토어용 AAB (Google Play 출시)
```bash
npm run build:prod
# 또는
eas build --profile production --platform android
```
→ `.aab` 파일 → Google Play Console에 업로드

---

## 4. iOS 빌드 (선택사항)

```bash
# iOS 시뮬레이터용 (Mac 환경 필요)
npm run build:ios-sim

# App Store용
eas build --profile production --platform ios
```

> iOS 배포는 Apple Developer 계정 ($99/년) 필요.

---

## 5. Firebase 설정 확인

| 파일 | 용도 |
|------|------|
| `google-services.json` | Android Firebase 설정 |
| `GoogleService-Info.plist` | iOS Firebase 설정 |

Firebase 콘솔에서 다운로드: `프로젝트 설정 → 앱 → 구성 파일 다운로드`

> 이 파일들은 `.gitignore`에 의해 git에서 제외됨 (보안).

---

## 6. 로컬 테스트

```bash
# Expo Go로 빠른 미리보기 (Firebase 네이티브 기능 제외됨)
npm start

# 에뮬레이터로 실행 (개발 빌드 설치 후)
npm run android
```

> `@react-native-firebase`는 네이티브 모듈 → **Expo Go 불가**.
> 반드시 `eas build --profile development` 빌드 후 에뮬레이터/실기기에서 테스트.

---

## 7. 빌드 후 테스트 체크리스트

- [ ] 이메일 로그인 / 회원가입
- [ ] Google 로그인 (google-services.json SHA-1 등록 확인)
- [ ] 신규 유저 프로필 설정 (역할, 이름, 생년월일)
- [ ] 오늘의 질문 불러오기 (백엔드 연결)
- [ ] Doll 생성 및 대화
- [ ] 이미지 업로드 (갤러리 권한 팝업 확인)
- [ ] 추모 모드 색상 전환
- [ ] 언어 전환 (한국어 ↔ 영어)
- [ ] 개발자 모드 진입 (설정 화면 버전 7번 탭)
- [ ] SafeArea / 키보드 올라올 때 입력창 확인

---

## 8. 주요 설정값 (app.json)

| 항목 | 값 |
|------|-----|
| 앱 이름 | Memorial |
| 패키지 (Android) | `com.memorial.app` |
| Bundle ID (iOS) | `com.memorial.app` |
| 버전 | 1.0.0 (versionCode: 1) |
| EAS 프로젝트 | `f297c257-42ff-4d2e-a14f-c389458e39fa` |
| Expo 계정 | `j1nowo` |

---

## 9. Google Play 스토어 제출 (최종 단계)

```bash
# service account key 설정 후
eas submit --platform android
```

`eas.json`에 `google-play-key.json` 경로가 설정되어 있음.
Google Play Console에서 서비스 계정 키 발급 필요.

---

## 빠른 시작 요약

```bash
# 1. 환경변수 세팅
cp .env.example .env   # 값 채우기

# 2. 아이콘 생성 (선택)
npm install canvas
node scripts/generate-icons.js

# 3. 개발 빌드로 테스트
eas build --profile development --platform android

# 4. 프리뷰/릴리즈 빌드
npm run build:preview    # 테스트 배포
npm run build:prod       # 스토어 출시
```
