import React from 'react';
import { View, Text, Switch } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AuthInput from '../../components/AuthInput';
import AuthButton from '../../components/AuthButton';
import { useAuth } from '../context/AuthContext';

type Mode = 'normal' | 'quick';

export default function LoginScreen() {
  const nav = useNavigation<any>();
  const { signInWithPassword, signInWithGoogle, signInWithApple, setRemember, remember, email: rememberedEmail, error } = useAuth();
  const [mode, setMode] = React.useState<Mode>('normal');
  const [email, setEmail] = React.useState<string>(rememberedEmail || '');
  const [password, setPassword] = React.useState<string>('');
  const [rememberToggle, setRememberToggle] = React.useState<boolean>(!!remember);

  React.useEffect(() => { setEmail(rememberedEmail || ''); setRememberToggle(!!remember); }, [rememberedEmail, remember]);

  async function onLogin() {
    const ok = await signInWithPassword(email.trim(), password, rememberToggle);
    if (!ok) return;
    // Navegação automática pelo gate no AppNavigator
  }

  async function onGoogle() { await signInWithGoogle(); }
  async function onApple() { await signInWithApple(); }

  function onRegisterNavigate() { nav.navigate('Register'); }

  function onToggleMode(next: Mode) { setMode(next); }

  function onRememberSwitch(v: boolean) { setRememberToggle(v); void setRemember(v, v ? email : undefined); }

  return (
    <LinearGradient colors={["#0B1220", "#121826"]} style={{ flex: 1 }}>
      <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center' }}>
        {/* Logo */}
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <Ionicons name="flash" size={56} color="#00D1CC" />
          <Text style={{ color: '#E5E7EB', fontSize: 20, fontWeight: '700', marginTop: 8 }}>WOW CHARGER</Text>
        </View>

        {/* Tab selector */}
        <View style={{ flexDirection: 'row', backgroundColor: '#1F2937', borderRadius: 12, padding: 4 }}>
          <Text onPress={() => onToggleMode('normal')} style={{ flex: 1, textAlign: 'center', paddingVertical: 10, borderRadius: 8, color: mode === 'normal' ? '#003332' : '#9CA3AF', backgroundColor: mode === 'normal' ? '#00D1CC' : 'transparent', fontWeight: '600' }}>Normal Login</Text>
          <Text onPress={() => onToggleMode('quick')} style={{ flex: 1, textAlign: 'center', paddingVertical: 10, borderRadius: 8, color: mode === 'quick' ? '#003332' : '#9CA3AF', backgroundColor: mode === 'quick' ? '#00D1CC' : 'transparent', fontWeight: '600' }}>Quick Login</Text>
        </View>

        {mode === 'normal' ? (
          <View style={{ marginTop: 16 }}>
            <AuthInput icon="person" placeholder="Username" value={email} onChangeText={setEmail} keyboardType="email-address" />
            <View style={{ height: 12 }} />
            <AuthInput icon="lock" placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
              <Switch value={rememberToggle} onValueChange={onRememberSwitch} trackColor={{ false: '#4B5563', true: '#00B3AD' }} thumbColor={rememberToggle ? '#00D1CC' : '#9CA3AF'} />
              <Text style={{ color: '#9CA3AF', marginLeft: 8 }}>Remember Password</Text>
            </View>
            <View style={{ height: 16 }} />
            <AuthButton title="Login" onPress={onLogin} variant="primary" />
            <View style={{ height: 8 }} />
            <AuthButton title="register" onPress={onRegisterNavigate} variant="secondary" />
          </View>
        ) : (
          <View style={{ marginTop: 16 }}>
            <AuthButton title="Google Login" onPress={onGoogle} variant="google" />
            <View style={{ height: 8 }} />
            <AuthButton title="Apple Login" onPress={onApple} variant="apple" />
          </View>
        )}

        {!!error && (
          <Text style={{ color: '#FCA5A5', marginTop: 12 }}>{String(error)}</Text>
        )}
      </View>
    </LinearGradient>
  );
}