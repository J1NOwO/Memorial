// AuthContext.tsx - 인증 + 유저 프로필 전역 관리 (React Native)
//
// useAuth()로 어디서든 접근 가능:
//   user        - Firebase Auth 유저 객체
//   userProfile - Firestore에 저장된 추가 정보 (role, inviteCode, isDeceased 등)
//   signup / login / loginWithGoogle / logout

import React, { createContext, useContext, useEffect, useState } from 'react';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

// ─────────────────────────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────────────────────────
export interface UserProfile {
  email: string | null;
  name: string;
  role: 'provider' | 'family' | null;
  birthDate: string | null;
  isDeceased: boolean;
  trustedFamilyId: string | null;
  gems: number;
  inviteCode: string | null;
  createdAt?: any;
  gender?: string;
  nameInheritanceShown?: boolean;
  [key: string]: any;
}

interface AuthContextType {
  user: FirebaseAuthTypes.User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signup: (name: string, email: string, password: string, role?: 'provider' | 'family', birthDate?: string | null) => Promise<FirebaseAuthTypes.User>;
  login: (email: string, password: string) => Promise<FirebaseAuthTypes.User>;
  loginWithGoogle: () => Promise<FirebaseAuthTypes.User>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  completeProfile: (data: { name: string; birthDate: string; role: 'provider' | 'family'; gender?: string }) => Promise<void>;
  addGems: (amount: number) => Promise<void>;
  buyItem: (itemId: string, cost: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ─────────────────────────────────────────────────────────────────
// 초대 코드 생성 (제공자 가입 시 자동 생성)
// 헷갈리기 쉬운 문자(0, O, I, 1) 제외
// 예: MEM-K7PX2R
// ─────────────────────────────────────────────────────────────────
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'MEM-';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Google Sign-In 초기화 (웹 클라이언트 ID는 google-services.json에서 자동 참조됨)
    GoogleSignin.configure({
      webClientId: undefined, // google-services.json에 설정된 값 자동 사용
    });

    const unsubscribe = auth().onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        // 로그인 시 Firestore에서 유저 프로필 불러오기
        try {
          const profileSnap = await firestore()
            .collection('users')
            .doc(currentUser.uid)
            .get();

          if (profileSnap.exists) {
            let profile = profileSnap.data() as UserProfile;

            // ── 구버전 계정 자동 업그레이드 ──────────────────────────
            const updates: Partial<UserProfile> = {};
            if (profile.role === 'provider' && !profile.inviteCode) {
              updates.inviteCode = generateInviteCode();
            }
            if (profile.isDeceased === undefined) updates.isDeceased = false;
            if (profile.trustedFamilyId === undefined) updates.trustedFamilyId = null;
            if (typeof profile.gems !== 'number') updates.gems = 0;

            if (Object.keys(updates).length > 0) {
              await firestore().collection('users').doc(currentUser.uid).update(updates);
              profile = { ...profile, ...updates };
            }
            // ─────────────────────────────────────────────────────────

            setUserProfile(profile);
          }
        } catch (err) {
          console.error('프로필 로드 실패:', err);
        }
      } else {
        // 로그아웃 시 프로필 초기화
        setUserProfile(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ─────────────────────────────────────────
  // 이메일 회원가입
  // role: 'provider'(기억 남기는 사람) | 'family'(유족)
  // ─────────────────────────────────────────
  async function signup(
    name: string,
    email: string,
    password: string,
    role: 'provider' | 'family' = 'provider',
    birthDate: string | null = null,
  ): Promise<FirebaseAuthTypes.User> {
    const userCredential = await auth().createUserWithEmailAndPassword(email, password);
    const newUser = userCredential.user;

    await newUser.updateProfile({ displayName: name });
    const profile = await saveUserToFirestore(newUser, name, role, birthDate);

    // 로컬 상태도 즉시 업데이트
    setUserProfile(profile);
    return newUser;
  }

  // ─────────────────────────────────────────
  // 이메일 로그인
  // ─────────────────────────────────────────
  async function login(email: string, password: string): Promise<FirebaseAuthTypes.User> {
    const userCredential = await auth().signInWithEmailAndPassword(email, password);
    return userCredential.user;
  }

  // ─────────────────────────────────────────
  // Google 소셜 로그인
  // 처음이면 기본 role: 'provider' 로 저장
  // ─────────────────────────────────────────
  async function loginWithGoogle(): Promise<FirebaseAuthTypes.User> {
    // Google Sign-In으로 idToken 획득
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const signInResult = await GoogleSignin.signIn();
    const idToken = signInResult.data?.idToken ?? (signInResult as any).idToken;
    if (!idToken) throw new Error('Google 로그인 실패: idToken 없음');

    // Firebase Auth에 Google 자격 증명으로 로그인
    const googleCredential = auth.GoogleAuthProvider.credential(idToken);
    const userCredential = await auth().signInWithCredential(googleCredential);
    const googleUser = userCredential.user;

    // 신규 구글 유저면 Firestore에 저장
    const snap = await firestore().collection('users').doc(googleUser.uid).get();
    if (!snap.exists) {
      const profile = await saveUserToFirestore(googleUser, googleUser.displayName, null, null);
      setUserProfile(profile);
    }

    return googleUser;
  }

  // ─────────────────────────────────────────
  // 로그아웃
  // ─────────────────────────────────────────
  async function logout(): Promise<void> {
    await auth().signOut();
    // Google Sign-In 세션도 함께 해제
    try {
      await GoogleSignin.signOut();
    } catch {}
  }

  // ─────────────────────────────────────────
  // Firestore 유저 저장 (내부 함수)
  // ─────────────────────────────────────────
  async function saveUserToFirestore(
    firebaseUser: FirebaseAuthTypes.User,
    name: string | null,
    role: 'provider' | 'family' | null,
    birthDate: string | null = null,
  ): Promise<UserProfile> {
    const profile: UserProfile = {
      email: firebaseUser.email,
      name: name || firebaseUser.displayName || '이름 없음',
      role,
      birthDate,
      isDeceased: false,
      trustedFamilyId: null,
      gems: 0,
      inviteCode: role === 'provider' ? generateInviteCode() : null,
      createdAt: firestore.FieldValue.serverTimestamp(),
    };

    await firestore().collection('users').doc(firebaseUser.uid).set(profile);
    return profile;
  }

  // ─────────────────────────────────────────
  // 프로필 설정 완료 (ProfileSetup에서 호출)
  // name, birthDate, role을 Firestore에 저장
  // 제공자는 inviteCode도 이때 생성
  // ─────────────────────────────────────────
  async function completeProfile({
    name,
    birthDate,
    role,
    gender,
  }: {
    name: string;
    birthDate: string;
    role: 'provider' | 'family';
    gender?: string;
  }): Promise<void> {
    if (!user) return;

    const updates: Partial<UserProfile> = {
      name: name.trim(),
      birthDate,
      role,
      ...(gender ? { gender } : {}),
    };

    if (role === 'provider') {
      const snap = await firestore().collection('users').doc(user.uid).get();
      if (!snap.data()?.inviteCode) {
        updates.inviteCode = generateInviteCode();
      }
      updates.isDeceased = false;
      updates.trustedFamilyId = null;
    } else {
      updates.inviteCode = null;
    }

    await firestore().collection('users').doc(user.uid).update(updates);

    // Firebase Auth displayName도 변경
    if (name.trim() !== user.displayName) {
      await user.updateProfile({ displayName: name.trim() });
    }

    await refreshProfile();
  }

  // userProfile 새로고침 (외부에서 강제 갱신이 필요할 때)
  async function refreshProfile(): Promise<void> {
    if (!user) return;
    try {
      const snap = await firestore().collection('users').doc(user.uid).get({ source: 'server' });
      if (snap.exists) setUserProfile(snap.data() as UserProfile);
    } catch (err) {
      console.error('프로필 새로고침 실패:', err);
    }
  }

  // gems += amount (Firestore atomic increment + local state update)
  async function addGems(amount: number): Promise<void> {
    if (!user) return;
    await firestore()
      .collection('users')
      .doc(user.uid)
      .update({ gems: firestore.FieldValue.increment(amount) });
    setUserProfile((prev) => prev ? { ...prev, gems: (prev.gems || 0) + amount } : prev);
  }

  // 상점 아이템 구매 (gems 차감 + userItems/{userId}.ownedItems 추가)
  async function buyItem(itemId: string, cost: number): Promise<void> {
    if (!user) throw new Error('로그인이 필요해요');
    const currentGems = userProfile?.gems || 0;
    if (currentGems < cost) throw new Error('기억 조각이 부족해요');

    // gems 차감 (atomic)
    await firestore()
      .collection('users')
      .doc(user.uid)
      .update({ gems: firestore.FieldValue.increment(-cost) });

    // ownedItems 추가 (없으면 문서 생성)
    const itemsRef = firestore().collection('userItems').doc(user.uid);
    const itemsSnap = await itemsRef.get();
    if (itemsSnap.exists) {
      await itemsRef.update({ ownedItems: firestore.FieldValue.arrayUnion(itemId) });
    } else {
      await itemsRef.set({ ownedItems: [itemId] });
    }

    setUserProfile((prev) => prev ? { ...prev, gems: currentGems - cost } : prev);
  }

  const value: AuthContextType = {
    user,
    userProfile,
    loading,
    signup,
    login,
    loginWithGoogle,
    logout,
    refreshProfile,
    completeProfile,
    addGems,
    buyItem,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth는 AuthProvider 안에서만 사용할 수 있어요');
  }
  return context;
}
