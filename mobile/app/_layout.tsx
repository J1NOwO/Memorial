// app/_layout.tsx - 루트 레이아웃
// 모든 Provider 감싸기 + 폰트 로드
//
// 폰트 파일 준비:
//   assets/fonts/ 폴더에 아래 파일 추가 필요:
//   - NotoSerifKR-Regular.ttf
//   - NotoSerifKR-Bold.ttf
//   - NotoSansKR-Regular.ttf
//   - NotoSansKR-Medium.ttf
//   - NotoSansKR-Bold.ttf
//   Google Fonts (https://fonts.google.com/) 에서 무료 다운로드 가능

import { useEffect, Component, ReactNode } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { View, Text, ScrollView } from 'react-native';
import { AuthProvider } from '@/context/AuthContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { MemorialProvider } from '@/context/MemorialContext';

// 크래시 발생 시 에러를 화면에 표시
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error;
      return (
        <View style={{ flex: 1, padding: 20, paddingTop: 60, backgroundColor: '#1a1a1a' }}>
          <Text style={{ color: 'red', fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
            앱 오류 발생
          </Text>
          <ScrollView>
            <Text style={{ color: '#fff', fontSize: 13 }}>{err.message}</Text>
            <Text style={{ color: '#aaa', fontSize: 11, marginTop: 10 }}>{err.stack}</Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

// 폰트 로드 전까지 스플래시 화면 유지
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    // ── 폰트 파일이 없으면 이 블록을 주석처리하고 시스템 폰트로 대체 ──
    // 'NotoSerifKR-Regular': require('../assets/fonts/NotoSerifKR-Regular.ttf'),
    // 'NotoSerifKR-Bold':    require('../assets/fonts/NotoSerifKR-Bold.ttf'),
    // 'NotoSansKR-Regular':  require('../assets/fonts/NotoSansKR-Regular.ttf'),
    // 'NotoSansKR-Medium':   require('../assets/fonts/NotoSansKR-Medium.ttf'),
    // 'NotoSansKR-Bold':     require('../assets/fonts/NotoSansKR-Bold.ttf'),
  });

  useEffect(() => {
    // 폰트 로드 완료 or 에러 시 스플래시 화면 숨기기
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // 폰트 로드 전에는 아무것도 렌더하지 않음
  if (!fontsLoaded && !fontError) return null;

  return (
    <ErrorBoundary>
      <AuthProvider>
        <LanguageProvider>
          <MemorialProvider>
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false }} />
          </MemorialProvider>
        </LanguageProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
