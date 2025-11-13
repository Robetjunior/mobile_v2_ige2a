import React from 'react';
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AuthInput from '../components/AuthInput';
import AuthButton from '../components/AuthButton';
import { useAuth } from '../hooks/useAuth';

export default function RegisterScreen() {
  const nav = useNavigation<any>();
  const { register, error } = useAuth();
  const [username, setUsername] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');

  async function onRegister() {
    if (!email || !password || password !== confirm) return;
    const ok = await register(email.trim(), password, username.trim());
    if (ok) {
      // Navegação automática pelo gate
    }
  }

  function onLoginNavigate() { nav.navigate('Login'); }

  return (
    <LinearGradient colors={["#0B1220", "#121826"]} style={{ flex: 1 }}>
      <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center' }}>
        {/* Logo */}
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <Ionicons name="flash" size={56} color="#00D1CC" />
          <Text style={{ color: '#E5E7EB', fontSize: 20, fontWeight: '700', marginTop: 8 }}>WOW CHARGER</Text>
        </View>
        <View style={{ marginTop: 8 }}>
          <AuthInput icon="person" placeholder="Username" value={username} onChangeText={setUsername} />
          <View style={{ height: 12 }} />
          <AuthInput icon="mail" placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
          <View style={{ height: 12 }} />
          <AuthInput icon="lock" placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
          <View style={{ height: 12 }} />
          <AuthInput icon="lock" placeholder="Confirm Password" value={confirm} onChangeText={setConfirm} secureTextEntry />
          <View style={{ height: 16 }} />
          <AuthButton title="Register" onPress={onRegister} variant="primary" />
          <View style={{ height: 8 }} />
          <Text onPress={onLoginNavigate} style={{ color: '#9CA3AF', textAlign: 'center' }}>Login</Text>
        </View>
        {!!error && (
          <Text style={{ color: '#FCA5A5', marginTop: 12 }}>{String(error)}</Text>
        )}
      </View>
    </LinearGradient>
  );
}