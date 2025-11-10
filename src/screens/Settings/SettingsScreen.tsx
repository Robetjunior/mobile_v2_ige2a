import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, Pressable, TextInput } from 'react-native';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import Divider from '../../components/Divider';
import { useNavigation } from '@react-navigation/native';
import { useUserStore } from '../../stores/useUserStore';
import { LOGGER } from '../../utils/logger';
import { useI18n } from '../../i18n/useI18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PrimaryButton from '../../components/PrimaryButton';
import { setApiKey } from '../../services/http';

export default function SettingsScreen() {
  const nav = useNavigation();
  const { prefs, updatePrefs } = useUserStore();
  const { t } = useI18n();
  const [apiKey, setApiKeyInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stored = (await AsyncStorage.getItem('API_KEY')) || '';
        if (mounted) setApiKeyInput(stored);
      } catch {}
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          const ls = window.localStorage.getItem('API_KEY') || '';
          if (ls && mounted && !apiKey) setApiKeyInput(ls);
        }
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const trimmed = (apiKey || '').trim();
      await AsyncStorage.setItem('API_KEY', trimmed);
      try { if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem('API_KEY', trimmed); } catch {}
      setApiKey(trimmed);
      LOGGER.API.info('settings.saved_api_key');
    } catch (e) {
      LOGGER.API.info('settings.save_api_key_error', { message: (e as any)?.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={[Typography.titleSection, styles.title]}>{t('settings.title')}</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>{t('settings.language')}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Alternar idioma"
            onPress={() => {
              const next = prefs.language === 'pt-BR' ? 'en-US' : 'pt-BR';
              updatePrefs({ language: next });
            }}>
          <Text style={styles.link}>{prefs.language}</Text>
          </Pressable>
        </View>
        <Divider />
        <View style={styles.row}>
          <Text style={styles.label}>{t('settings.notifications')}</Text>
          <Switch value={prefs.notifications} onValueChange={(v) => updatePrefs({ notifications: v })} />
        </View>
        <Divider />
        <View style={styles.column}>
          <Text style={styles.label}>API Key</Text>
          <TextInput
            placeholder="Informe sua API Key"
            value={apiKey}
            onChangeText={setApiKeyInput}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
          <View style={{ marginTop: 12 }}>
            <PrimaryButton label={saving ? 'Salvando…' : 'Salvar'} onPress={handleSave} />
          </View>
        </View>
        <Divider />
        <Pressable style={styles.row} accessibilityRole="button" accessibilityLabel="Privacidade"
          onPress={() => { LOGGER.API.info('tap_privacy'); /* navega para tela estática de privacidade */ nav.navigate('Support' as never); }}>
          <Text style={styles.label}>{t('settings.privacy')}</Text>
          <Text style={styles.link}>Abrir</Text>
        </Pressable>
        <Divider />
        <View style={styles.row}>
          <Text style={[styles.label, { opacity: 0.5 }]}>{t('settings.themeDisabled')}</Text>
          <Text style={[styles.link, { opacity: 0.5 }]}>Desativado</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F8', paddingHorizontal: Spacing.h, paddingTop: 16 },
  title: { color: Colors.textBody, marginBottom: 12 },
  card: { backgroundColor: Colors.cardGray, borderRadius: 12, padding: 16 },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  column: { paddingVertical: 8 },
  label: { ...Typography.body, color: Colors.textBody },
  link: { color: Colors.brandTeal, fontWeight: '600' },
  input: { height: 48, borderRadius: 10, paddingHorizontal: 12, backgroundColor: '#fff', borderColor: '#E5E7EB', borderWidth: 1 },
});