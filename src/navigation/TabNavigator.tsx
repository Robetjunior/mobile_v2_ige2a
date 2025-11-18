import React from 'react';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../chargers/screens/HomeMapScreen';
import ChargeScreen from '../screens/ChargeScreen';
import HistoryScreen from '../sessions/screens/HistoryScreen';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UI_TOKENS } from '../constants';
import { useNavigation } from '@react-navigation/native';
import MeScreen from '../screens/Me/MeScreen';

const Tab = createBottomTabNavigator();

function Placeholder({ title }: { title: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>{title}</Text>
    </View>
  );
}

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const tabHeight = UI_TOKENS.sizes.tabH + insets.bottom;

  const getIcon = (name: string, focused: boolean) => {
    switch (name) {
      case 'Home':
        return focused ? 'home' : 'home-outline';
      case 'Charge':
        return focused ? 'flash' : 'flash-outline';
      case 'Record':
        return focused ? 'document-text' : 'document-text-outline';
      case 'Me':
        return focused ? 'person' : 'person-outline';
      default:
        return 'ellipse-outline';
    }
  };

  const getLabel = (name: string): string => {
    switch (name) {
      case 'Home':
        return 'Início';
      case 'Charge':
        return 'Carga';
      case 'Record':
        return 'Histórico';
      case 'Me':
        return 'Conta';
      default:
        return name;
    }
  };

  return (
    <View style={{
      height: tabHeight,
      backgroundColor: UI_TOKENS.colors.tabBg,
      borderTopColor: UI_TOKENS.colors.tabBorder,
      borderTopWidth: 1,
      paddingBottom: insets.bottom,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
    }}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const color = focused ? UI_TOKENS.colors.tabActive : UI_TOKENS.colors.tabInactive;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        if (route.name === 'QR') {
          return (
            <View key={route.key} style={{ width: 72, alignItems: 'center' }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Abrir scanner QR"
                onPress={() => navigation.navigate('QRScanner')}
                style={({ pressed }) => ([
                  {
                    height: UI_TOKENS.sizes.qr,
                    width: UI_TOKENS.sizes.qr,
                    borderRadius: UI_TOKENS.radius.qr,
                    backgroundColor: UI_TOKENS.colors.brand,
                    borderColor: UI_TOKENS.colors.brandRing,
                    borderWidth: 4,
                    alignItems: 'center',
                    justifyContent: 'center',
                    elevation: 6,
                    shadowColor: '#000',
                    shadowOpacity: 0.15,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 4 },
                  },
                  pressed && { opacity: 0.92 },
                ])}
              >
                <Ionicons name="qr-code" size={28} color={UI_TOKENS.colors.brandText} />
              </Pressable>
            </View>
          );
        }

        return (
          <Pressable key={route.key} onPress={onPress} accessibilityRole="button" style={{ alignItems: 'center', justifyContent: 'center', minWidth: 64 }}>
            <Ionicons name={getIcon(route.name, focused) as any} size={24} color={color} />
            <Text style={{ color, fontSize: 12, fontWeight: focused ? '600' : '500', marginTop: 4 }}>{getLabel(route.name)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const TabNavigatorComp = () => {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <CustomTabBar {...props} />}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Charge" component={ChargeScreen} />
      <Tab.Screen name="QR" component={() => <Placeholder title="QR" />} options={{ tabBarLabel: () => null }} />
      <Tab.Screen name="Record" component={HistoryScreen} />
      <Tab.Screen name="Me" component={MeScreen} />
    </Tab.Navigator>
  );
};

export default TabNavigatorComp;