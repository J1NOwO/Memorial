// app/(auth)/profile-setup.tsx - 프로필 설정 화면
// 웹 ProfileSetup.jsx → React Native 변환
// select → PickerModal (login.tsx와 동일한 패턴)
// navigate('/dashboard') → router.replace('/(tabs)')

import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Modal, FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/hooks/useT';
import { apiCall } from '@/utils/api';
import { Colors } from '@/constants/colors';

// ── 커스텀 피커 (login.tsx와 동일) ────────────────────────────────────────────
interface PickerModalProps {
  visible:  boolean;
  items:    { label: string; value: string }[];
  selected: string;
  onSelect: (v: string) => void;
  onClose:  () => void;
  title:    string;
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
  sheet:    { backgroundColor: Colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40, maxHeight: '70%' },
  handle:   { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginTop: 10, marginBottom: 8 },
  title:    { fontSize: 15, fontWeight: '600', color: Colors.text, textAlign: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  list:     { flexGrow: 0 },
  item:     { paddingVertical: 14, paddingHorizontal: 24 },
  itemSelected:     { backgroundColor: Colors.accentPale },
  itemText:         { fontSize: 15, color: Colors.textMid },
  itemTextSelected: { color: Colors.accent, fontWeight: '700' },
});

// ── 생년월일 선택 행 (login.tsx와 동일) ─────────────────────────────────────
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
export default function ProfileSetupScreen() {
  const router = useRouter();
  const t = useT();
  const { user, userProfile, completeProfile } = useAuth();

  // role이 null이면 선택 UI 표시 (주로 구글 신규 유저)
  const needsRoleSelect = !userProfile?.role;
  const existingName = userProfile?.name || user?.displayName || '';

  const [lastName, setLastName]   = useState('');
  const [firstName, setFirstName] = useState(existingName);

  const [birthYear, setBirthYear]   = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay]     = useState('');

  const [role, setRole]     = useState<'provider' | 'family'>(
    needsRoleSelect ? 'provider' : (userProfile?.role as 'provider' | 'family') ?? 'provider'
  );
  const [gender, setGender] = useState(userProfile?.gender || '');

  // 유족 전용
  const [inviteCode, setInviteCode]         = useState('');
  const [relation, setRelation]             = useState('');
  const [relationPicker, setRelationPicker] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const RELATIONS = (t.relations as string[]).map((r) => ({ label: r, value: r }));

  // ── 제출 ─────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setError('');

    const fullName = (lastName + firstName).trim();
    if (!fullName)                          { setError(t.validation_name); return; }
    if (!birthYear || !birthMonth || !birthDay) { setError(t.validation_birthdate); return; }
    if (!gender)                            { setError(t.validation_gender); return; }
    if (role === 'family') {
      if (!inviteCode.trim()) { setError(t.validation_invite_code); return; }
      if (!relation)          { setError(t.validation_relation); return; }
    }

    const birthDate = `${birthYear}-${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`;

    setLoading(true);
    try {
      await completeProfile({ name: fullName, birthDate, role, gender });

      if (role === 'family') {
        try {
          await apiCall('POST', '/api/connections/join', {
            inviteCode: inviteCode.trim().toUpperCase(),
            relation,
          });
        } catch {
          // 연결 실패는 대시보드에서 재시도 가능
          router.replace({
            pathname: '/(tabs)',
            params: { pendingInvite: inviteCode.trim().toUpperCase(), relation },
          } as any);
          return;
        }
      }

      router.replace('/(tabs)');
    } catch (err: any) {
      console.error('프로필 설정 실패:', err);
      setError(t.error_save);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={S.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={S.kav}
      >
        <ScrollView contentContainerStyle={S.scroll} keyboardShouldPersistTaps="handled">

          {/* 로고 */}
          <Text style={S.logo}>{t.app_name}</Text>
          <Text style={S.logoSub}>{t.profile_welcome}</Text>

          <Text style={S.title}>{t.profile_setup_title}</Text>
          <Text style={S.desc}>{t.profile_setup_desc}</Text>

          {/* 에러 */}
          {!!error && (
            <View style={S.errorBox}>
              <Text style={S.errorText}>{error}</Text>
            </View>
          )}

          {/* ── 역할 선택 (role이 null인 신규 구글 유저) ── */}
          {needsRoleSelect && (
            <View style={S.section}>
              <Text style={S.label}>{t.signup_type}</Text>
              <View style={S.roleRow}>
                {([
                  { key: 'provider', icon: '✍️', name: t.profile_role_provider_name, desc: t.profile_role_provider_desc },
                  { key: 'family',   icon: '💌', name: t.profile_role_family_name,   desc: t.profile_role_family_desc },
                ] as const).map(({ key, icon, name, desc }) => (
                  <TouchableOpacity
                    key={key}
                    style={[S.roleBtn, role === key && S.roleBtnActive]}
                    onPress={() => setRole(key)}
                  >
                    <Text style={S.roleIcon}>{icon}</Text>
                    <Text style={S.roleName}>{name}</Text>
                    <Text style={S.roleDesc}>{desc}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* ── 이름 (성 + 이름) ── */}
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
            <Text style={S.hint}>{t.profile_name_hint}</Text>
          </View>

          {/* ── 생년월일 ── */}
          <View style={S.section}>
            <BirthDateRow
              year={birthYear} month={birthMonth} day={birthDay}
              onYear={setBirthYear} onMonth={setBirthMonth} onDay={setBirthDay}
              t={t}
            />
          </View>

          {/* ── 성별 선택 ── */}
          <View style={S.section}>
            <Text style={S.label}>{t.doll_step_gender}</Text>
            <View style={S.genderRow}>
              {([
                { value: 'male',   label: t.doll_create_male,   icon: '👦' },
                { value: 'female', label: t.doll_create_female, icon: '👧' },
              ] as const).map(({ value, label, icon }) => (
                <TouchableOpacity
                  key={value}
                  style={[S.genderBtn, gender === value && S.genderBtnActive]}
                  onPress={() => setGender(value)}
                >
                  <Text style={{ fontSize: 22 }}>{icon}</Text>
                  <Text style={S.genderLabel}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── 유족 전용: 초대 코드 + 관계 ── */}
          {role === 'family' && (
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
                <Text style={S.hint}>{t.profile_invite_hint}</Text>
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
              {loading ? t.saving : t.landing_start}
            </Text>
          </TouchableOpacity>

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

  logo:    { fontSize: 26, fontWeight: '700', color: Colors.primary, letterSpacing: 2, textAlign: 'center', marginBottom: 4 },
  logoSub: { fontSize: 12, color: Colors.accent, textAlign: 'center', letterSpacing: 2, marginBottom: 20 },
  title:   { fontSize: 20, fontWeight: '700', color: Colors.primary, marginBottom: 6 },
  desc:    { fontSize: 13, color: Colors.textMuted, marginBottom: 24 },

  errorBox:  { backgroundColor: '#fdf0f0', borderRadius: 8, padding: 12, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: Colors.error },
  errorText: { color: Colors.error, fontSize: 13 },

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

  // ── 역할 선택 ─────────────────────────────────────────────────
  roleRow: { flexDirection: 'row', gap: 10 },
  roleBtn: {
    flex:            1,
    paddingVertical: 14,
    paddingHorizontal: 10,
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
  roleDesc:      { fontSize: 11, color: Colors.textMuted, textAlign: 'center' },

  // ── 성별 선택 ─────────────────────────────────────────────────
  genderRow: { flexDirection: 'row', gap: 8 },
  genderBtn: {
    flex:            1,
    paddingVertical: 12,
    borderRadius:    12,
    borderWidth:     1.5,
    borderColor:     Colors.border,
    backgroundColor: '#faf7f4',
    alignItems:      'center',
    gap:             4,
  },
  genderBtnActive: { borderColor: Colors.accent, backgroundColor: '#fef8f2' },
  genderLabel:     { fontSize: 13, fontWeight: '600', color: Colors.text },

  // ── 제출 버튼 ─────────────────────────────────────────────────
  btnSubmit: {
    marginTop:       8,
    paddingVertical: 14,
    backgroundColor: Colors.primary,
    borderRadius:    10,
    alignItems:      'center',
  },
  btnSubmitText: { color: Colors.card, fontSize: 15, fontWeight: '600' },
  btnDisabled:   { opacity: 0.55 },
});
