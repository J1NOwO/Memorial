# Memorial

> **고인과의 기억을 영원히 간직하는 추모 앱**  
> A mobile app to preserve, share, and relive memories of loved ones — powered by AI.

<br>

## Overview

Memorial은 세상을 떠난 소중한 사람의 기억을 가족과 함께 기록하고, AI를 통해 그 사람의 목소리를 다시 만날 수 있는 추모 서비스입니다.

- **Provider** — 고인의 생전 정보와 기억을 등록하는 사용자
- **Family** — 초대 코드로 연결되어 함께 기억을 나누는 가족 구성원

<br>

## Features

| 기능 | 설명 |
|---|---|
| **AI 인형 (Doll)** | 고인의 성격·말투·기억을 학습한 AI와 실시간 대화 |
| **기억 앨범** | 사진·음성 기록을 시간순으로 보관 |
| **메모리얼 북** | 고인의 생애를 책처럼 정리한 디지털 추모록 |
| **일기** | 매일의 감정과 추억을 기록 |
| **데일리 질문** | AI가 생성한 질문으로 고인의 이야기를 채워가기 |
| **가족 연결** | 초대 코드로 가족 계정 연동, 기억 공유 |
| **상점** | 기억 조각(gem)으로 AI 인형 의상·테마 구매 |

<br>

## Tech Stack

### Mobile (React Native)
- **Expo SDK 54** + Expo Router (file-based navigation)
- **React Native 0.81.5** — New Architecture enabled
- **Firebase** — Auth, Firestore, Storage (`@react-native-firebase`)
- **Google Sign-In** — `@react-native-google-signin/google-signin`
- **react-native-reanimated v4** — 애니메이션
- **EAS Build** — 클라우드 빌드 & 배포

### Web (React)
- **React + Vite**
- **Firebase Web SDK** — Auth, Firestore, Storage
- Admin 대시보드 및 Doll 관리 웹 인터페이스

### Backend (Node.js)
- **Express 5**
- **Firebase Admin SDK** — 서버사이드 인증 & Firestore
- **Google Gemini API** — AI 인형 대화 생성
- **Groq SDK** — 빠른 LLM 응답
- **Render** 배포 (free tier)

<br>

## Project Structure

```
Memorial/
├── mobile/          # React Native (Expo) 앱
│   ├── app/         # Expo Router 라우트
│   │   ├── (auth)/  # 로그인·회원가입
│   │   ├── (tabs)/  # 메인 탭 (일기, 인형, 기억, 가족, 설정)
│   │   └── doll/    # AI 인형 상세 (채팅, 의상)
│   ├── context/     # AuthContext, MemorialContext
│   └── components/  # 공통 컴포넌트
│
├── web/             # React 웹 (관리/Doll 생성)
│   └── src/
│       └── pages/   # Landing, Login, Dashboard, DollCreate ...
│
└── backend/         # Express API 서버
    └── routes/      # chat, doll, connections, memorialBook ...
```

<br>

## Getting Started

### 사전 준비
- Node.js 18+
- Expo CLI (`npm install -g expo`)
- EAS CLI (`npm install -g eas-cli`)
- Firebase 프로젝트 생성 및 설정 파일 준비

### Mobile

```bash
cd mobile
npm install
# google-services.json (Android) / GoogleService-Info.plist (iOS) 추가
expo start
```

### Backend

```bash
cd backend
npm install
# .env 파일 생성 (아래 환경변수 설정)
node index.js
```

**Backend `.env` 예시:**
```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
GEMINI_API_KEY=your-gemini-api-key
GROQ_API_KEY=your-groq-api-key
```

### Web

```bash
cd web
npm install
# .env 파일에 VITE_FIREBASE_* 환경변수 설정
npm run dev
```

<br>

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│  Mobile (Expo)  │     │   Web (React)   │
│  React Native   │     │   Vite + SPA    │
└────────┬────────┘     └────────┬────────┘
         │                        │
         │  Firebase SDK          │  Firebase SDK
         ▼                        ▼
┌─────────────────────────────────────────┐
│           Firebase (Google Cloud)       │
│   Auth │ Firestore │ Storage            │
└─────────────────────────────────────────┘
         │
         │  REST API
         ▼
┌─────────────────┐
│  Backend (Node) │  ← Gemini API / Groq
│  Express 5      │
└─────────────────┘
```

<br>

## License

This project is licensed under the **Creative Commons Attribution-NonCommercial 4.0 International License (CC BY-NC 4.0)**.

- **비영리 목적**의 사용·공유·수정은 자유롭게 허용됩니다.
- **상업적 이용**은 저작권자의 명시적 서면 동의 없이 금지됩니다.

Copyright © 2026 yjw02 · [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/)
