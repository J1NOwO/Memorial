// app/(auth)/login.tsx - 로그인 / 회원가입 화면
// 웹 Login.jsx → React Native 변환
// select(생년월일/관계) → Modal 커스텀 피커
// useNavigate → useRouter
// form onSubmit → 버튼 onPress

import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Modal, FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/hooks/useT';
import { apiCall } from '@/utils/api';
import { Colors } from '@/constants/colors';

// ── Firebase 에러 코드 → 메시지 ───────────────────────────────────────────────
function getErrorMessage(code: string, t: any): string {
  const map: Record<string, string> = {
    'auth/email-already-in-use': t.error_email_in_use,
    'auth/invalid-email':        t.error_invalid_email,
    'auth/weak-password':        t.error_weak_password,
    'auth/user-not-found':       t.error_user_not_found,
    'auth/wrong-password':       t.error_wrong_password,
    'auth/invalid-credential':   t.error_invalid_credential,
    'auth/popup-closed-by-user': t.error_popup_closed,
    'auth/too-many-requests':    t.error_too_many_requests,
  };
  return map[code] || t.error_default;
}

// ── 커스텀 피커 (select 대체) ──────────────────────────────────────────────────
interface PickerModalProps {
  visible:   boolean;
  items:     { label: string; value: string }[];
  selected:  string;
  onSelect:  (v: string) => void;
  onClose:   () => void;
  title:     string;
}
function PickerModal({ visible, items, selected, onSelect, onClose, title }: PickerModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={PM.backdrop} onPress={onClose} activeOpacity={1}>
        <View style={PM.sheet}>
          <View style={PM.handle} />
          <Text style={PM.title}>{title}</Text>
          <FlatList
            data={items}
            keyExtractor={(item) => item.value}
            style={PM.list}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[PM.item, item.value === selected && PM.itemSelected]}
                onPress={() => { onSelect(item.value); onClose(); }}
              >
                <Text style={[PM.itemText, item.value === selected && PM.itemTextSelected]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const PM = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40, maxHeight: '70%' },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginTop: 10, marginBottom: 8 },
  title: { fontSize: 15, fontWeight: '600', color: Colors.text, textAlign: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  list: { flexGrow: 0 },
  item: { paddingVertical: 14, paddingHorizontal: 24 },
  itemSelected: { backgroundColor: Colors.accentPale },
  itemText: { fontSize: 15, color: Colors.textMid },
  itemTextSelected: { color: Colors.accent, fontWeight: '700' },
});

// ── 생년월일 선택 행 ──────────────────────────────────────────────────────────
interface BirthDateRowProps {
  year: string; month: string; day: string;
  onYear: (v: string) => void; onMonth: (v: string) => void; onDay: (v: string) => void;
  t: any;
}
function BirthDateRow({ year, month, day, onYear, onMonth, onDay, t }: BirthDateRowProps) {
  const [picker, setPicker] = useState<'year' | 'month' | 'day' | null>(null);
  const currentYear = new Date().getFullYear();
  const years  = Array.from({ length: currentYear - 1899 }, (_, i) => String(currentYear - i));
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1));
  const daysInMonth = year && month ? new Date(Number(year), Number(month), 0).getDate() : 31;
  const days = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));

  return (
    <View>
      <Text style={S.label}>{t.birthdate}</Text>
      <View style={S.dateRow}>
        <TouchableOpacity style={[S.picker, { flex: 2 }]} onPress={() => setPicker('year')}>
          <Text style={year ? S.pickerText : S.pickerPlaceholder}>
            {year ? t.year_unit(Number(year)) : t.year_placeholder}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[S.picker, { flex: 1 }]} onPress={() => setPicker('month')}>
          <Text style={month ? S.pickerText : S.pickerPlaceholder}>
            {month ? t.month_unit(Number(month)) : t.month_placeholder}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[S.picker, { flex: 1 }]} onPress={() => setPicker('day')}>
          <Text style={day ? S.pickerText : S.pickerPlaceholder}>
            {day ? t.day_unit(Number(day)) : t.day_placeholder}
          </Text>
        </TouchableOpacity>
      </View>
      <PickerModal
        visible={picker === 'year'}
        items={years.map(y => ({ label: t.year_unit(Number(y)), value: y }))}
        selected={year} onSelect={onYear} onClose={() => setPicker(null)}
        title={t.year_placeholder}
      />
      <PickerModal
        visible={picker === 'month'}
        items={months.map(m => ({ label: t.month_unit(Number(m)), value: m }))}
        selected={month} onSelect={onMonth} onClose={() => setPicker(null)}
        title={t.month_placeholder}
      />
      <PickerModal
        visible={picker === 'day'}
        items={days.map(d => ({ label: t.day_unit(Number(d)), value: d }))}
        selected={day} onSelect={onDay} onClose={() => setPicker(null)}
        title={t.day_placeholder}
      />
    </View>
  );
}

// ── 메인 화면 ─────────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const router = useRouter();
  const t = useT();
  const { login, signup, loginWithGoogle } = useAuth();

  const [tab, setTab]     = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // 회원가입 전용
  const [role, setRole]               = useState<'provider' | 'family'>('provider');
  const [lastName, setLastName]       = useState('');
  const [firstName, setFirstName]     = useState('');
  const [birthYear, setBirthYear]     = useState('');
  const [birthMonth, setBirthMonth]   = useState('');
  const [birthDay, setBirthDay]       = useState('');
  const [inviteCode, setInviteCode]   = useState('');
  const [relation, setRelation]       = useState('');
  const [relationPicker, setRelationPicker] = useState(false);

  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  function switchTab(newTab: 'login' | 'signup') {
    setTab(newTab); setError('');
    setEmail(''); setPassword(''); setRole('provider');
    setLastName(''); setFirstName('');
    setBirthYear(''); setBirthMonth(''); setBirthDay('');
    setInviteCode(''); setRelation('');
  }

  // ── 로그인 / 회원가입 제출 ──────────────────────────────────────────────────
  async function handleSubmit() {
    setError('');
    setLoading(true);
    try {
      if (tab === 'login') {
        await login(email, password);
        router.replace('/(tabs)');
        return;
      }

      // 회원가입 유효성 검사
      const fullName = (lastName + firstName).trim();
      if (!fullName)                                    { setError(t.validation_name); return; }
      if (!birthYear || !birthMonth || !birthDay)       { setError(t.validation_birthdate); return; }
      if (role === 'family' && !inviteCode.trim())      { setError(t.validation_invite_code); return; }
      if (role === 'family' && !relation)               { setError(t.validation_relation); return; }

      const birthDate = `${birthYear}-${String(birthMonth).padStart(2,'0')}-${String(birthDay).padStart(2,'0')}`;
      await signup(fullName, email, password, role, birthDate);

      // 유족이면 초대코드로 연결 요청
      if (role === 'family') {
        try {
          await apiCall('POST', '/api/connections/join', {
            inviteCode: inviteCode.trim().toUpperCase(),
            relation,
          });
        } catch {
          // 백엔드 오류여도 가입은 성공 → 대시보드에서 재시도
        }
      }
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(getErrorMessage(err.code, t));
    } finally {
      setLoading(false);
    }
  }

  // ── Google 로그인 ───────────────────────────────────────────────────────────
  async function handleGoogleLogin() {
    setError(''); setLoading(true);
    try {
      await loginWithGoogle();
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(getErrorMessage(err.code, t));
    } finally {
      setLoading(false);
    }
  }

  const RELATIONS = t.relations.map((r: string) => ({ label: r, value: r }));

  return (
    <SafeAreaView style={S.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={S.kav}
      >
        <ScrollView contentContainerStyle={S.scroll} keyboardShouldPersistTaps="handled">

          {/* 뒤로가기 */}
          <TouchableOpacity onPress={() => router.back()} style={S.backBtn}>
            <Text style={S.backText}>← {t.back}</Text>
          </TouchableOpacity>

          {/* 로고 */}
          <Text style={S.logo}>{t.app_name}</Text>
          <Text style={S.logoSub}>{t.login_subtitle}</Text>

          {/* 탭 전환 */}
          <View style={S.tabs}>
            {(['login', 'signup'] as const).map((tabKey) => (
              <TouchableOpacity
                key={tabKey}
                style={[S.tabBtn, tab === tabKey && S.tabBtnActive]}
                onPress={() => switchTab(tabKey)}
              >
                <Text style={[S.tabText, tab === tabKey && S.tabTextActive]}>
                  {tabKey === 'login' ? t.login : t.signup}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 에러 */}
          {!!error && (
            <View style={S.errorBox}>
              <Text style={S.errorText}>{error}</Text>
            </View>
          )}

          {/* ── 회원가입: 역할 선택 ── */}
          {tab === 'signup' && (
            <View style={S.section}>
              <Text style={S.label}>{t.signup_type}</Text>
              <View style={S.roleRow}>
                {([
                  { key: 'provider', icon: '✍️', name: t.role_provider },
                  { key: 'family',   icon: '💌', name: t.role_family },
                ] as const).map(({ key, icon, name }) => (
                  <TouchableOpacity
                    key={key}
                    style={[S.roleBtn, role === key && S.roleBtnActive]}
                    onPress={() => setRole(key)}
                  >
                    <Text style={S.roleIcon}>{icon}</Text>
                    <Text style={S.roleName}>{name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* ── 성 + 이름 (회원가입) ── */}
          {tab === 'signup' && (
            <View style={S.section}>
              <Text style={S.label}>{t.name}</Text>
              <View style={S.nameRow}>
                <TextInput
                  style={[S.input, { width: 80 }]}
                  placeholder={t.last_name}
                  placeholderTextColor={Colors.textMuted}
                  value={lastName}
                  onChangeText={setLastName}
                />
                <TextInput
                  style={[S.input, { flex: 1 }]}
                  placeholder={t.first_name}
                  placeholderTextColor={Colors.textMuted}
                  value={firstName}
                  onChangeText={setFirstName}
                />
              </View>
            </View>
          )}

          {/* ── 생년월일 (회원가입) ── */}
          {tab === 'signup' && (
            <View style={S.section}>
              <BirthDateRow
                year={birthYear} month={birthMonth} day={birthDay}
                onYear={setBirthYear} onMonth={setBirthMonth} onDay={setBirthDay}
                t={t}
              />
            </View>
          )}

          {/* 이메일 */}
          <View style={S.section}>
            <Text style={S.label}>{t.email}</Text>
            <TextInput
              style={S.input}
              placeholder="example@email.com"
              placeholderTextColor={Colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* 비밀번호 */}
          <View style={S.section}>
            <Text style={S.label}>{t.password}</Text>
            <TextInput
              style={S.input}
              placeholder={tab === 'signup' ? t.password_hint : t.password_placeholder}
              placeholderTextColor={Colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          {/* ── 유족 전용: 초대코드 + 관계 ── */}
          {tab === 'signup' && role === 'family' && (
            <>
              <View style={S.section}>
                <Text style={S.label}>{t.invite_code}</Text>
                <TextInput
                  style={[S.input, { letterSpacing: 2, fontWeight: '600' }]}
                  placeholder="MEM-XXXXXX"
                  placeholderTextColor={Colors.textMuted}
                  value={inviteCode}
                  onChangeText={(v) => setInviteCode(v.toUpperCase())}
                  maxLength={10}
                  autoCapitalize="characters"
                />
                <Text style={S.hint}>{t.invite_code_hint}</Text>
              </View>

              <View style={S.section}>
                <Text style={S.label}>{t.relation}</Text>
                <TouchableOpacity style={S.picker} onPress={() => setRelationPicker(true)}>
                  <Text style={relation ? S.pickerText : S.pickerPlaceholder}>
                    {relation || t.relation_placeholder}
                  </Text>
                </TouchableOpacity>
                <PickerModal
                  visible={relationPicker}
                  items={RELATIONS}
                  selected={relation}
                  onSelect={setRelation}
                  onClose={() => setRelationPicker(false)}
                  title={t.relation}
                />
              </View>
            </>
          )}

          {/* 제출 버튼 */}
          <TouchableOpacity
            style={[S.btnSubmit, loading && S.btnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={S.btnSubmitText}>
              {loading ? t.loading : tab === 'login' ? t.login : t.signup}
            </Text>
          </TouchableOpacity>

          {/* ── Google 로그인 (로그인 탭만) ── */}
          {tab === 'login' && (
            <>
              <View style={S.divider}>
                <View style={S.dividerLine} />
                <Text style={S.dividerText}>{t.or_divider}</Text>
                <View style={S.dividerLine} />
              </View>
              <TouchableOpacity
                style={[S.btnGoogle, loading && S.btnDisabled]}
                onPress={handleGoogleLogin}
                disabled={loading}
                activeOpacity={0.8}
              >
                {/* Google 로고 SVG */}
                <Svg width={18} height={18} viewBox="0 0 18 18" style={{ marginRight: 10 }}>
                  <Path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
                  <Path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
                  <Path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18z"/>
                  <Path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
                </Svg>
                <Text style={S.btnGoogleText}>{t.login_google}</Text>
              </TouchableOpacity>
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  kav:    { flex: 1 },
  scroll: { flexGrow: 1, padding: 24 },

  backBtn:  { marginBottom: 24 },
  backText: { color: Colors.textMuted, fontSize: 14 },

  logo:    { fontSize: 26, fontWeight: '700', color: Colors.primary, letterSpacing: 2, textAlign: 'center', marginBottom: 4 },
  logoSub: { fontSize: 12, color: Colors.accent, textAlign: 'center', letterSpacing: 2, marginBottom: 28 },

  // ── 탭 ─────────────────────────────────────────────────────
  tabs: {
    flexDirection:   'row',
    backgroundColor: Colors.accentPale,
    borderRadius:    10,
    padding:         4,
    marginBottom:    24,
  },
  tabBtn:       { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  tabBtnActive: { backgroundColor: Colors.card, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 2 },
  tabText:      { fontSize: 14, color: Colors.textMid },
  tabTextActive: { color: Colors.primary, fontWeight: '600' },

  // ── 에러 ────────────────────────────────────────────────────
  errorBox:  { backgroundColor: '#fdf0f0', borderRadius: 8, padding: 12, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: Colors.error },
  errorText: { color: Colors.error, fontSize: 13 },

  // ── 폼 공통 ────────────────────────────────────────────────
  section: { marginBottom: 16 },
  label:   { fontSize: 13, color: Colors.textMid, fontWeight: '500', marginBottom: 6 },
  hint:    { fontSize: 12, color: Colors.textMuted, marginTop: 4 },

  input: {
    backgroundColor: '#faf7f4',
    borderWidth:     1.5,
    borderColor:     Colors.border,
    borderRadius:    10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize:        15,
    color:           Colors.text,
  },
  nameRow: { flexDirection: 'row', gap: 8 },
  dateRow: { flexDirection: 'row', gap: 8 },

  picker: {
    backgroundColor: '#faf7f4',
    borderWidth:     1.5,
    borderColor:     Colors.border,
    borderRadius:    10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    justifyContent:  'center',
  },
  pickerText:        { fontSize: 15, color: Colors.text },
  pickerPlaceholder: { fontSize: 15, color: Colors.textMuted },

  // ── 역할 선택 ───────────────────────────────────────────────
  roleRow: { flexDirection: 'row', gap: 10 },
  roleBtn: {
    flex:            1,
    paddingVertical: 14,
    borderRadius:    12,
    borderWidth:     1.5,
    borderColor:     Colors.border,
    backgroundColor: '#faf7f4',
    alignItems:      'center',
    gap:             4,
  },
  roleBtnActive: { borderColor: Colors.accent, backgroundColor: '#fef8f2' },
  roleIcon:      { fontSize: 24 },
  roleName:      { fontSize: 13, fontWeight: '600', color: Colors.text },

  // ── 버튼들 ──────────────────────────────────────────────────
  btnSubmit: {
    marginTop:       8,
    paddingVertical: 14,
    backgroundColor: Colors.primary,
    borderRadius:    10,
    alignItems:      'center',
  },
  btnSubmitText: { color: Colors.card, fontSize: 15, fontWeight: '600' },
  btnDisabled:   { opacity: 0.55 },

  divider:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: 12, color: Colors.textMuted },

  btnGoogle: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    paddingVertical: 13,
    backgroundColor: Colors.card,
    borderWidth:     1.5,
    borderColor:     Colors.border,
    borderRadius:    10,
  },
  btnGoogleText: { fontSize: 14, color: Colors.primary, fontWeight: '500' },
});
