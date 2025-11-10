import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import { LOGGER } from '../../utils/logger';
import { useI18n } from '../../i18n/useI18n';

type Item = { id: string; title: string; subtitle: string };

export default function RecentlyUsedScreen() {
  const { t } = useI18n();
  const items = useMemo<Item[]>(() => [
    { id: '1', title: 'WOW Charger - Paulista', subtitle: 'Rápida 50kW' },
    { id: '2', title: 'Shopping Lapa', subtitle: 'AC 22kW' },
    { id: '3', title: 'Posto Centro', subtitle: 'DC 60kW' },
    { id: '4', title: 'Garagem João', subtitle: 'AC 7kW' },
    { id: '5', title: 'Ponto Verde', subtitle: 'DC 120kW' },
  ], []);

  const empty = items.length === 0;

  return (
    <View style={styles.container}>
      <Text style={[Typography.titleSection, styles.title]}>{t('recentlyUsed.title')}</Text>
      {empty ? (
        <View style={styles.empty}><Text style={styles.emptyText}>{t('recentlyUsed.empty')}</Text></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: Colors.divider }} />}
          renderItem={({ item }) => (
            <Pressable accessibilityRole="button" accessibilityLabel={item.title}
              onPress={() => LOGGER.API.info('tap_recently_used_item', item)}
              style={styles.row}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowSub}>{item.subtitle}</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F8', paddingHorizontal: Spacing.h, paddingTop: 16 },
  title: { color: Colors.textBody, marginBottom: 12 },
  empty: { backgroundColor: Colors.cardGray, borderRadius: 12, padding: 24, alignItems: 'center' },
  emptyText: { color: Colors.textBody },
  row: { backgroundColor: '#fff', padding: 14 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: Colors.textBody },
  rowSub: { fontSize: 14, color: '#4A4A4A', marginTop: 4 },
});