import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from './AppNavigator';

// Deep link config: /charge/:chargeBoxId? should open the Charge tab
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['ev://', 'http://localhost:8087'],
  config: {
    screens: {
      Tabs: {
        screens: {
          Home: 'home',
          Charge: 'charge/:chargeBoxId?',
          Record: 'record',
          Me: 'me',
        },
      },
      ChargingSession: 'session',
      Settings: 'settings',
      Cards: 'cards',
      About: 'about',
      RecentlyUsed: 'recently-used',
    },
  },
};