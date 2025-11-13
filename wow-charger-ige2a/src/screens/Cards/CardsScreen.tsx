import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert } from 'react-native';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import { useUserStore } from '../../stores/useUserStore';
import { useI18n } from '../../i18n/useI18n';

export default function CardsScreen() {
  const { user, addCard, removeCard, setDefaultCard } = useUserStore();
  const [card, setCard] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const { t } = useI18n();
  // Guard user optional fields to satisfy TypeScript and runtime safety
  const safeCards = user?.cards || [];

  const digits = useMemo(() => card.replace(/\D/g, ''), [card]);
  const brand = useMemo(() => detectBrandLocal(digits), [digits]);

  const onAdd = () => {
    // validação UX: luhn e tamanho
    if (!isValidLength(digits) || !luhnValid(digits)) {
      setError('Número de cartão inválido');
      return;
    }
    const res = addCard(digits);
    if (!res.ok) {
      Alert.alert('Erro', res.message || t('cards.maxTwo'));
      return;
    }
    setCard('');
    setError(undefined);
  };

  const onRemove = (id: string) => {
    Alert.alert(t('cards.remove'), t('cards.removeConfirm'), [
      { text: 'Cancelar', style: 'cancel' },
      { text: t('cards.remove'), style: 'destructive', onPress: () => removeCard(id) },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={[Typography.titleSection, styles.title]}>{t('cards.title')}</Text>
      {/* Lista de cartões */}
  {(safeCards.length > 0) && (
        <View style={styles.card}>
          <Text style={styles.label}>{t('cards.default')}</Text>
  {safeCards.map((c) => (
            <View key={c.id} style={{ marginTop: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.mask}>{c.masked}</Text>
                  {c.isDefault && <Badge text="Padrão" color={Colors.brandTeal} />}
                </View>
                <BrandBadge brand={c.brand} />
              </View>
              <View style={{ height: 8 }} />
              <View style={{ flexDirection: 'row', gap: 16 }}>
                {!c.isDefault && (
                  <Pressable accessibilityRole="button" accessibilityLabel={t('cards.setDefault')} onPress={() => setDefaultCard(c.id)}>
                    <Text style={styles.link}>{t('cards.setDefault')}</Text>
                  </Pressable>
                )}
                <Pressable accessibilityRole="button" accessibilityLabel={t('cards.remove')} onPress={() => onRemove(c.id)}>
                  <Text style={[styles.link, { color: '#E11D48' }]}>{t('cards.remove')}</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Adicionar cartão - mostrar se houver espaço */}
  {safeCards.length < 2 && (
        <View style={[styles.card, { marginTop: 16 }]}>
          <Text style={styles.label}>{t('cards.add')}</Text>
          <TextInput
            value={formatCard(card, brand)}
            onChangeText={(v) => {
              setError(undefined);
              // sempre mantém apenas dígitos internamente
              const onlyDigits = v.replace(/\D/g, '');
              setCard(onlyDigits);
            }}
            keyboardType="number-pad"
            placeholder={t('cards.numberPlaceholder')}
            style={styles.input}
          />
          {!!error && <Text style={{ color: '#DC2626', marginTop: 6 }}>{error}</Text>}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('cards.save')}
            style={[styles.btn, (!isValidLength(digits) || (digits.length >= 15 && !luhnValid(digits))) && { opacity: 0.7 }]}
            onPress={onAdd}
          >
            <Text style={styles.btnText}>{t('cards.save')}</Text>
          </Pressable>
  {safeCards.length === 1 && (
            <Text style={{ color: Colors.textBody, marginTop: 8 }}>Você pode adicionar mais um cartão.</Text>
          )}
  {safeCards.length >= 2 && (
            <Text style={{ color: Colors.textBody, marginTop: 8 }}>{t('cards.maxTwo')}</Text>
          )}
        </View>
      )}
    </View>
  );
}

function isValidLength(digits: string) {
  // Amex 15; visa/master 16+; simplificado
  return digits.length >= 15;
}

function formatCard(digits: string, brand: ReturnType<typeof detectBrandLocal>) {
  if (brand === 'amex') {
    const g1 = digits.slice(0, 4);
    const g2 = digits.slice(4, 10);
    const g3 = digits.slice(10, 15);
    return [g1, g2, g3].filter(Boolean).join(' ');
  }
  const parts = [] as string[];
  for (let i = 0; i < digits.length; i += 4) parts.push(digits.slice(i, i + 4));
  return parts.join(' ');
}

function detectBrandLocal(d: string): 'visa' | 'mastercard' | 'amex' | 'unknown' {
  if (/^4\d{12,18}$/.test(d)) return 'visa';
  if (/^(5[1-5]\d{14}|2(2[2-9]\d{12}|[3-6]\d{13}|7[01]\d{12}|720\d{12}))$/.test(d)) return 'mastercard';
  if (/^(34|37)\d{13}$/.test(d)) return 'amex';
  return 'unknown';
}

function luhnValid(num: string): boolean {
  let sum = 0, shouldDouble = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let digit = parseInt(num[i], 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

const Badge: React.FC<{ text: string; color?: string }> = ({ text, color = '#D1D5DB' }) => (
  <View style={{ marginLeft: 8, backgroundColor: color, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 }}>
    <Text style={{ color: '#0F2A2A', fontWeight: '700', fontSize: 12 }}>{text}</Text>
  </View>
);

const BrandBadge: React.FC<{ brand: 'visa' | 'mastercard' | 'amex' | 'unknown' }> = ({ brand }) => {
  const map: Record<string, { text: string; bg: string }> = {
    visa: { text: 'Visa', bg: '#BFDBFE' },
    mastercard: { text: 'Mastercard', bg: '#FECACA' },
    amex: { text: 'Amex', bg: '#BBF7D0' },
    unknown: { text: 'Desconhecida', bg: '#E5E7EB' },
  };
  const b = map[brand] || map.unknown;
  return <Badge text={b.text} color={b.bg} />;
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F8', paddingHorizontal: Spacing.h, paddingTop: 16 },
  title: { color: Colors.textBody, marginBottom: 12 },
  card: { backgroundColor: Colors.cardGray, borderRadius: 12, padding: 16 },
  label: { ...Typography.body, color: Colors.textBody, marginBottom: 8 },
  input: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: Colors.divider },
  btn: { marginTop: 12, height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.brandTeal },
  btnText: { color: '#0F2A2A', fontWeight: '700', fontSize: 16 },
  mask: { fontSize: 20, fontWeight: '700', color: Colors.textBody },
  linkBtn: { height: 44, alignItems: 'flex-start', justifyContent: 'center' },
  link: { color: Colors.brandTeal, fontWeight: '600' },
});