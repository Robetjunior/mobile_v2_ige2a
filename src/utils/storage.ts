import AsyncStorage from '@react-native-async-storage/async-storage';

export async function getJson<T>(key: string): Promise<T | undefined> {
  try {
    const v = await AsyncStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : undefined;
  } catch {
    return undefined;
  }
}

export async function setJson(key: string, value: any): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}