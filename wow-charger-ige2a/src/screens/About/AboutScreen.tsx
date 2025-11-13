import React from 'react';
import { View, Text, StyleSheet, Linking, Pressable } from 'react-native';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import appJson from '../../../app.json';
import { useI18n } from '../../i18n/useI18n';

export default function AboutScreen() {
  const { t } = useI18n();
  const version = appJson?.expo?.version || '1.0.0';
  return (
    <View style={styles.container}>
      <Text style={[Typography.titleSection, styles.title]}>{t('about.title')}</Text>
      <View style={styles.card}>
        <Text style={styles.text}>WOW Charger IGE2A</Text>
        <Text style={[styles.text, { marginTop: 4 }]}>Versão {version}</Text>
        <View style={{ height: 12 }} />
        <Pressable accessibilityRole="button" accessibilityLabel={t('about.terms')} onPress={() => Linking.openURL('https://example.com/terms')}>
          <Text style={styles.link}>{t('about.terms')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('about.policy')} onPress={() => Linking.openURL('https://example.com/privacy')}>
          <Text style={styles.link}>{t('about.policy')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F8', paddingHorizontal: Spacing.h, paddingTop: 16 },
  title: { color: Colors.textBody, marginBottom: 12 },
  card: { backgroundColor: Colors.cardGray, borderRadius: 12, padding: 16 },
  text: { ...Typography.body, color: Colors.textBody },
  link: { color: Colors.brandTeal, fontWeight: '600', marginTop: 6 },
});