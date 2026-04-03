// AuthContext.jsx - 인증 + 유저 프로필 전역 관리
//
// useAuth()로 어디서든 접근 가능:
//   user        - Firebase Auth 유저 객체
//   userProfile - Firestore에 저장된 추가 정보 (role, inviteCode, isDeceased 등)
//   signup / login / loginWithGoogle / logout

import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, getDocFromServer, updateDoc, serverTimestamp, increment, arrayUnion } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';

const AuthContext = createContext(null);

// ─────────────────────────────────────────────────────────────────
// 초대 코드 생성 (제공자 가입 시 자동 생성)
// 헷갈리기 쉬운 문자(0, O, I, 1) 제외
// 예: MEM-K7PX2R
// ─────────────────────────────────────────────────────────────────
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'MEM-';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null); // Firestore 유저 정보
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        // 로그인 시 Firestore에서 유저 프로필 불러오기
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const profileSnap = await getDoc(userRef);

          if (profileSnap.exists()) {
            let profile = profileSnap.data();

            // ── 구버전 계정 자동 업그레이드 ──────────────────────────
            // 이전에 만든 계정은 inviteCode, isDeceased 등이 없을 수 있어
            const updates = {};
            if (profile.role === 'provider' && !profile.inviteCode) {
              updates.inviteCode = generateInviteCode();
            }
            if (profile.isDeceased === undefined) updates.isDeceased = false;
            if (profile.trustedFamilyId === undefined) updates.trustedFamilyId = null;
            if (typeof profile.gems !== 'number') updates.gems = 0;

            if (Object.keys(updates).length > 0) {
              await updateDoc(userRef, updates);
              profile = { ...profile, ...updates }; // 로컬 상태도 업데이트
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
  async function signup(name, email, password, role = 'provider', birthDate = null) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const newUser = userCredential.user;

    await updateProfile(newUser, { displayName: name });
    const profile = await saveUserToFirestore(newUser, name, role, birthDate);

    // 로컬 상태도 즉시 업데이트 (onAuthStateChanged 재실행 전에도 반영)
    setUserProfile(profile);
    return newUser;
  }

  // ─────────────────────────────────────────
  // 이메일 로그인
  // ─────────────────────────────────────────
  async function login(email, password) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  }

  // ─────────────────────────────────────────
  // Google 소셜 로그인
  // 처음이면 기본 role: 'provider' 로 저장
  // ─────────────────────────────────────────
  async function loginWithGoogle() {
    const userCredential = await signInWithPopup(auth, googleProvider);
    const googleUser = userCredential.user;

    const userDocSnap = await getDoc(doc(db, 'users', googleUser.uid));
    if (!userDocSnap.exists()) {
      // 신규 구글 유저: 최소 정보만 저장, birthDate=null → ProfileSetup으로 이동됨
      const profile = await saveUserToFirestore(googleUser, googleUser.displayName, null, null);
      setUserProfile(profile);
    }

    return googleUser;
  }

  // ─────────────────────────────────────────
  // 로그아웃
  // ─────────────────────────────────────────
  async function logout() {
    await signOut(auth);
  }

  // ─────────────────────────────────────────
  // Firestore 유저 저장 (내부 함수)
  // ─────────────────────────────────────────
  async function saveUserToFirestore(firebaseUser, name, role, birthDate = null) {
    const profile = {
      email: firebaseUser.email,
      name: name || firebaseUser.displayName || '이름 없음',
      role,                        // 'provider' | 'family' | null(신규 구글유저, ProfileSetup에서 확정)
      birthDate,                   // 생년월일 문자열 ('1990-03-15'), null이면 ProfileSetup 필요
      isDeceased: false,
      trustedFamilyId: null,
      gems: 0,
      inviteCode: role === 'provider' ? generateInviteCode() : null,
      createdAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'users', firebaseUser.uid), profile);
    return profile;
  }

  // ─────────────────────────────────────────
  // 프로필 설정 완료 (ProfileSetup에서 호출)
  // name, birthDate, role을 Firestore에 저장
  // 제공자는 inviteCode도 이때 생성
  // ─────────────────────────────────────────
  async function completeProfile({ name, birthDate, role, gender }) {
    if (!user) return;

    const updates = {
      name: name.trim(),
      birthDate,
      role,
      ...(gender ? { gender } : {}),
    };

    if (role === 'provider') {
      // 기존에 inviteCode가 없으면 새로 생성
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (!snap.data()?.inviteCode) {
        updates.inviteCode = generateInviteCode();
      }
      updates.isDeceased     = false;
      updates.trustedFamilyId = null;
    } else {
      updates.inviteCode = null;
    }

    await updateDoc(doc(db, 'users', user.uid), updates);

    // Firebase Auth displayName도 변경
    if (name.trim() !== user.displayName) {
      await updateProfile(user, { displayName: name.trim() });
    }

    await refreshProfile();
  }

  // userProfile 새로고침 (외부에서 강제 갱신이 필요할 때)
  // getDocFromServer: 캐시 무시하고 항상 서버에서 최신값 가져옴
  async function refreshProfile() {
    if (!user) return;
    try {
      const snap = await getDocFromServer(doc(db, 'users', user.uid));
      if (snap.exists()) setUserProfile(snap.data());
    } catch (err) {
      console.error('프로필 새로고침 실패:', err);
    }
  }

  // gems += amount (Firestore atomic increment + local state update)
  async function addGems(amount) {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid), { gems: increment(amount) });
    setUserProfile((prev) => ({ ...prev, gems: (prev?.gems || 0) + amount }));
  }

  // 상점 아이템 구매 (gems 차감 + userItems/{userId}.ownedItems 추가)
  async function buyItem(itemId, cost) {
    if (!user) throw new Error('로그인이 필요해요');
    const currentGems = userProfile?.gems || 0;
    if (currentGems < cost) throw new Error('기억 조각이 부족해요');

    // gems 차감 (atomic)
    await updateDoc(doc(db, 'users', user.uid), { gems: increment(-cost) });

    // ownedItems 추가 (없으면 문서 생성)
    const itemsRef = doc(db, 'userItems', user.uid);
    const itemsSnap = await getDoc(itemsRef);
    if (itemsSnap.exists()) {
      await updateDoc(itemsRef, { ownedItems: arrayUnion(itemId) });
    } else {
      await setDoc(itemsRef, { ownedItems: [itemId] });
    }

    setUserProfile((prev) => ({ ...prev, gems: currentGems - cost }));
  }

  const value = {
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth는 AuthProvider 안에서만 사용할 수 있어요');
  }
  return context;
}
