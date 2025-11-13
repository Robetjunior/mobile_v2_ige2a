import { Platform } from 'react-native';

// Platform-aware shim to satisfy TypeScript module resolution
// and delegate to the appropriate implementation.
// On web: use RecordChart.web.tsx; on native: use RecordChart.native.tsx
// This avoids TS complaints when importing '../components/RecordChart'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Chart = Platform.OS === 'web'
  ? require('./RecordChart.web').default
  : require('./RecordChart.native').default;

export default Chart;