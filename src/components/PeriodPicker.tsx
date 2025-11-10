import React, { useState } from 'react';
import { View, Text, Pressable, Modal, FlatList } from 'react-native';
import dayjs from 'dayjs';
import { PeriodType } from '../types';


type Props = {
  periodType: PeriodType;
  anchorDate: Date;
  onChange: (d: Date) => void;
};

export default function PeriodPicker({ periodType, anchorDate, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const label = periodType === 'month'
    ? dayjs(anchorDate).format('MM-YYYY')
    : dayjs(anchorDate).format('YYYY');

  const months = Array.from({ length: 12 }, (_, i) => dayjs().month(i));
  const monthsPtBr = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const years = Array.from({ length: 10 }, (_, i) => dayjs(anchorDate).year() - i);

  return (
    <View style={{ alignSelf: 'center' }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Selecionar período" onPress={() => setOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontWeight: '600' }}>{label}</Text>
        <Text style={{ fontSize: 16 }}>▾</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.2)' }} onPress={() => setOpen(false)}>
          <View style={{ marginTop: 120, marginHorizontal: 24, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16 }}>
            {periodType === 'month' ? (
              <FlatList
                data={months}
                keyExtractor={(m) => m.format('MM')}
                numColumns={3}
                renderItem={({ item }) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Selecionar mês ${monthsPtBr[item.month()]}`}
                    onPress={() => { const d = dayjs(anchorDate).month(item.month()); setOpen(false); onChange(d.toDate()); }}
                    style={{ padding: 12, margin: 6, borderRadius: 10, backgroundColor: '#F3F4F6' }}
                  >
                    <Text>{monthsPtBr[item.month()]}</Text>
                  </Pressable>
                )}
              />
            ) : (
              <FlatList
                data={years}
                keyExtractor={(y) => String(y)}
                numColumns={3}
                renderItem={({ item }) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Selecionar ano ${item}`}
                    onPress={() => { const d = dayjs(anchorDate).year(item); setOpen(false); onChange(d.toDate()); }}
                    style={{ padding: 12, margin: 6, borderRadius: 10, backgroundColor: '#F3F4F6' }}
                  >
                    <Text>{item}</Text>
                  </Pressable>
                )}
              />
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}