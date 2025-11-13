import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import Avatar from '../../components/Avatar';
import DuoTile from '../../components/DuoTile';
import Divider from '../../components/Divider';
import PrimaryButton from '../../components/PrimaryButton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useUserStore } from '../../stores/useUserStore';
import { LOGGER } from '../../utils/logger';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../../i18n/useI18n';

export default function MeScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const { user, loading, getUser, signOut } = useUserStore();
  const { t } = useI18n();

  useEffect(() => {
    LOGGER.API.info('me_opened');
    getUser();
  }, []);

  const padTop = Platform.OS === 'android' ? Spacing.headerPadTopAndroid : Spacing.headerPadTopIOS;

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F7F8' }}>
      <View style={[styles.header, { paddingTop: insets.top + padTop }]}
        accessibilityRole="header" accessibilityLabel="Cabeçalho da conta">
        <Text style={styles.headerTitle}>{t('account.title')}</Text>
        <View style={{ alignItems: 'center', marginTop: 12 }}>
          <Avatar uri={user?.avatarUrl} />
          {loading ? (
            <View style={{ marginTop: 12 }}>
              <ActivityIndicator color={Colors.white} />
            </View>
          ) : (
            <>
              <Text style={[Typography.userName, styles.userName]}>{user?.name || '—'}</Text>
              <Text style={[Typography.subId, styles.subId]}>{user?.publicId || ''}</Text>
            </>
          )}
        </View>
      </View>

      <View style={styles.body}>
        <DuoTile
          left={{
            label: t('account.recentlyUsed'),
            icon: 'star',
            onPress: () => {
              LOGGER.API.info('tap_recently_used');
              // @ts-ignore
              nav.navigate('RecentlyUsed');
            },
          }}
          right={{
            label: t('account.myCard'),
            icon: 'wallet',
            onPress: () => {
              LOGGER.API.info('tap_cards');
              // @ts-ignore
              nav.navigate('Cards');
            },
          }}
        />

        <View style={{ height: 12 }} />
        <Divider />
        <View style={{ height: 12 }} />

        <View style={styles.block}>
          <View style={styles.cardGray}>
            <View>
              {/* Gray card with two rows */}
              {/* First item */}
              <View style={[styles.listRow, styles.listTopBorder]}
                accessibilityRole="button" accessibilityLabel={t('account.settings')}
                // @ts-ignore
                onTouchEnd={() => { LOGGER.API.info('tap_settings'); nav.navigate('Settings'); }}>
                <Ionicons name="settings-outline" size={22} color={Colors.textBody} style={styles.iconSpace} />
                <Text style={styles.listLabel}>{t('account.settings')}</Text>
              </View>
              {/* Second item */}
              <View style={styles.listRow}
                accessibilityRole="button" accessibilityLabel={t('account.about')}
                // @ts-ignore
                onTouchEnd={() => { LOGGER.API.info('tap_about'); nav.navigate('About'); }}>
                <Ionicons name="information-circle-outline" size={22} color={Colors.textBody} style={styles.iconSpace} />
                <Text style={styles.listLabel}>{t('account.about')}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={{ height: 16 }} />
        <PrimaryButton label={t('account.signOut')} onPress={async () => {
          LOGGER.API.info('tap_signout');
          await signOut();
          // após signOut, podemos navegar para Login ou Home por enquanto
          // @ts-ignore
          nav.navigate('Tabs');
        }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.headerTop,
    alignItems: 'center',
    paddingBottom: 16,
  },
  headerTitle: {
    color: Colors.brandTeal,
    fontSize: 22,
    fontWeight: '700',
    alignSelf: 'flex-start',
    marginLeft: Spacing.h,
  },
  userName: { color: Colors.textOnHeader, marginTop: 12 },
  subId: { color: Colors.textOnHeader, opacity: 0.86, marginTop: 6 },
  body: { paddingHorizontal: Spacing.h, paddingTop: 16 },
  block: {},
  cardGray: { backgroundColor: Colors.cardGray, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 6 },
  listRow: { height: 56, flexDirection: 'row', alignItems: 'center' },
  listTopBorder: { borderTopWidth: 1, borderTopColor: Colors.divider },
  iconSpace: { marginRight: 12 },
  listLabel: { ...Typography.body, color: Colors.textBody },
});