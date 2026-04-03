<h1 align="center">Memorial</h1>

<p align="center">
  <em>Preserve who you are — so the people you love can always find you.</em>
</p>

> ⚠️ **Work in Progress** — This project is currently under active development. AI prompts are not yet finalized and the backend may have unstable behavior. Not production-ready.

<p align="center">
  <img src="https://img.shields.io/badge/React_Native-0.81.5-61DAFB?style=flat-square&logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/Expo-SDK_54-000020?style=flat-square&logo=expo&logoColor=white" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/Node.js-Express_5-339933?style=flat-square&logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Firebase-Firestore%20%7C%20Auth%20%7C%20Storage-FFCA28?style=flat-square&logo=firebase&logoColor=black" />
  <img src="https://img.shields.io/badge/Groq-Llama_3.3-F55036?style=flat-square&logo=groq&logoColor=white" />
  <img src="https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey?style=flat-square" />
</p>

---

## Problem Statement

Every year, millions of people face terminal illness or sudden loss — and when they are gone, their voice, personality, and stories disappear with them. Families are left with static photographs and fading memories, with no way to continue the relationship.

Memorial addresses this gap by giving people a way to **document their identity while they are still alive** — their words, habits, memories, and personality — and transforming that data into an AI that loved ones can speak with after they pass. It is not a replacement for grief; it is a bridge that helps families hold on to the person, not just the memory.

---

## Features

### Core Systems

| Feature | Description |
|---|---|
| **AI Doll** | Each user owns a personalized AI avatar trained on their personality, speech patterns, and memories. After passing, the Doll is inherited by the deceased's name and continues conversations with family. |
| **Memory Collection** | AI-generated daily questions (by category, with deduplication) prompt the user to record answers as text, tags, or images. Every 10 conversations, key memories are auto-extracted for future RAG. |
| **Free Diary** | A private daily journal separate from structured Q&A, for unfiltered thoughts and stories. |
| **Family Connection** | Connect family and friends via a unique invite code (`MEM-XXXXXX`). Separate sections for family and friends. Assign one Trusted Family member who can trigger the memorial transition. |
| **Post-Passing Transition** | Trusted family manually activates Memorial Mode (two-step confirmation). The entire app shifts to a memorial theme, memories become read-only, and the Name Inheritance Animation plays once — a 25-second ceremony. |
| **Memorial Features** | Guestbook (connected contacts only), Memory Album (book-style flip), AI Chat with the deceased's Doll, and a full dark-blue memorial theme. |
| **Gem Economy** | In-app currency (`💎 기억 조각`) earned through activity. Spend in the Doll Shop for avatar costumes and themes. |
| **Multilingual** | Korean and English, switchable at runtime. |

### Access Roles

| Role | Description |
|---|---|
| **Provider** | The living user — registers memories, trains their Doll, manages family connections. Receives a unique invite code. |
| **Family** | Joins via invite code. Views shared memories and, after the transition, converses with the Doll. |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Mobile** | React Native 0.81.5 · Expo SDK 54 · Expo Router (file-based) · New Architecture |
| **Web** | React 19 · Vite · React Router v7 |
| **Backend** | Node.js · Express 5 |
| **Database** | Firebase Firestore |
| **Authentication** | Firebase Auth — Email/Password + Google Sign-In |
| **Storage** | Firebase Storage |
| **AI** | Groq — Llama 3.3 70B Versatile |
| **Mobile Build** | EAS Build (Expo Application Services) |
| **Web Deployment** | Vercel |
| **Backend Deployment** | Render (free tier) |

---

## Architecture

```
┌──────────────────────┐          ┌──────────────────────┐
│   Mobile App         │          │   Web App            │
│   React Native       │          │   React 19 + Vite    │
│   Expo SDK 54        │          │   Vercel             │
└──────────┬───────────┘          └──────────┬───────────┘
           │                                  │
           │   @react-native-firebase          │   Firebase Web SDK
           │   (Auth, Firestore, Storage)      │   (Auth, Firestore, Storage)
           │                                  │
           └──────────────┬───────────────────┘
                          │
              ┌───────────▼────────────┐
              │   Firebase             │
              │   Auth │ Firestore     │
              │   Storage              │
              └───────────┬────────────┘
                          │
                          │   REST API  (Firebase ID Token auth)
                          │
              ┌───────────▼────────────┐
              │   Backend              │
              │   Node.js + Express 5  │
              │   Render               │
              └───────────┬────────────┘
                          │
                          │
              ┌───────────▼────────────┐
              │  Groq                  │
              │  Llama 3.3 70B         │
              └────────────────────────┘
```

**Data flow — Doll Chat:**
1. Client sends message + Firebase ID token to `/api/doll/chat`
2. Backend verifies token via Firebase Admin SDK
3. Backend fetches Doll profile + recent memories from Firestore
4. Constructs system prompt with personality & memory context → Groq API
5. Response returned to client; key memories auto-extracted every 10 turns

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/connections` | List connected family/friends |
| `POST` | `/api/connections/join` | Join via invite code |
| `POST` | `/api/connections/approve` | Approve a connection request |
| `POST` | `/api/connections/setTrust` | Set trusted family member |
| `POST` | `/api/connections/deceased` | Trigger memorial mode transition |
| `GET` | `/api/questions` | Fetch today's AI-generated question |
| `POST` | `/api/questions/extra` | Request an additional question |
| `POST` | `/api/doll` | Create a new Doll |
| `GET` | `/api/doll/me` | Get current user's Doll |
| `PATCH` | `/api/doll/appearance` | Update Doll avatar |
| `PATCH` | `/api/doll/rename` | Rename Doll |
| `POST` | `/api/doll/chat` | Send message to Doll (AI response) |
| `DELETE` | `/api/doll` | Delete Doll |
| `POST` | `/api/chat` | Family ↔ deceased AI conversation |
| `GET/POST/DELETE` | `/api/memorial-book` | Memorial book entries |
| `GET` | `/api/memory-album` | Memory album (photos + answers) |

---

## Firestore Collections

```
users            — user profiles (role, gems, inviteCode, isDeceased …)
connections      — family/friend relationships + trust settings
dolls            — Doll profiles (personality, appearance, memory summary)
dollChats        — Doll conversation history
dailyQuestions   — AI-generated questions per user (dedup tracking)
dollGreetings    — Doll greeting messages
answers          — Structured memory answers (text / tags / image)
diaries          — Free diary entries
memorialBook     — Memorial book page entries
userItems        — Owned shop items per user
questions        — Question bank (category metadata)
```

---

## Project Structure

```
memorial/
├── mobile/                        # React Native + Expo
│   ├── app/
│   │   ├── (auth)/                # Landing, Login, ProfileSetup
│   │   ├── (tabs)/                # Home, Diary, Doll, Memories, Family, Shop, Settings
│   │   ├── doll/                  # DollChat, DollCreate, DollWardrobe
│   │   ├── chat.tsx               # Family ↔ AI Chat
│   │   ├── memorial-book.tsx
│   │   ├── memory-album.tsx
│   │   └── trust-settings.tsx
│   ├── components/                # BottomNav, TopBar, DollAvatar, StarField …
│   ├── constants/                 # colors, typography, dollItems
│   ├── context/                   # AuthContext, MemorialContext
│   ├── contexts/                  # LanguageContext
│   ├── locales/                   # ko.ts, en.ts
│   └── app.json / eas.json
│
├── web/                           # React 19 + Vite
│   └── src/
│       ├── pages/                 # Landing, Login, Dashboard, DollCreate,
│       │                          # DollChat, MemoryAlbum, MemorialBook …
│       ├── components/
│       ├── context/               # AuthContext, MemorialContext
│       └── firebase.js
│
└── backend/                       # Node.js + Express 5
    ├── routes/
    │   ├── chat.js
    │   ├── connections.js
    │   ├── doll.js
    │   ├── memorialBook.js
    │   ├── memoryAlbum.js
    │   └── questions.js
    ├── services/
    │   └── aiService.js           # Groq (Llama 3.3) AI orchestration
    ├── middleware/
    │   └── auth.js                # Firebase token verification
    └── firebase-admin.js
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- [Expo CLI](https://docs.expo.dev/get-started/installation/) — `npm install -g expo-cli`
- [EAS CLI](https://docs.expo.dev/eas/) — `npm install -g eas-cli`
- A Firebase project with **Auth**, **Firestore**, and **Storage** enabled
- Groq API key — [console.groq.com](https://console.groq.com/)

### 1. Clone

```bash
git clone https://github.com/J1NOwO/Memorial.git
cd Memorial
```

### 2. Backend

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
GROQ_API_KEY=your-groq-api-key
PORT=3000
```

> Firebase service account credentials: Firebase Console → Project Settings → Service Accounts → Generate new private key

```bash
node index.js
# Server running on http://localhost:3000
```

### 3. Web

```bash
cd web
npm install
```

Create `web/.env`:

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_API_URL=http://localhost:3000
```

```bash
npm run dev
# Web running on http://localhost:5173
```

### 4. Mobile

Add Firebase config files to `mobile/`:
- `google-services.json` — Android (Firebase Console → Project Settings → Android app)
- `GoogleService-Info.plist` — iOS (Firebase Console → Project Settings → iOS app)

```bash
cd mobile
npm install
npx expo start          # Development (Expo Go / dev build)
```

For a native dev build:

```bash
eas build --profile development --platform android
```

---

## Roadmap

- [ ] **RAG Memory Search** — Pinecone vector DB for semantic memory retrieval during Doll conversations
- [ ] **Voice Cloning** — ElevenLabs integration to preserve the user's actual voice
- [ ] **Video Avatar** — HeyGen integration for a visual AI presence
- [ ] **Push Notifications** — Daily question reminders, family activity alerts
- [ ] **Android Store Release** — Google Play production deployment
- [ ] **iOS Store Release** — App Store production deployment
- [ ] **Memory Export** — PDF/print export of Memorial Book

---

## License

This project is licensed under the **Creative Commons Attribution-NonCommercial 4.0 International License (CC BY-NC 4.0)**.

- Free to share and adapt for **non-commercial purposes** with attribution.
- **Commercial use is prohibited** without explicit written permission from the copyright holder.

See [LICENSE](./LICENSE) for details · [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/)

---

<p align="center">
  Built with care · Copyright © 2026 <a href="https://github.com/J1NOwO">yjw02</a>
</p>