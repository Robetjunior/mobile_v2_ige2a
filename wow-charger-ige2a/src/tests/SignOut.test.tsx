import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import MeScreen from '../screens/Me/MeScreen';
import { NavigationContainer } from '@react-navigation/native';
import { useUserStore } from '../stores/useUserStore';

test('sign out clears user', async () => {
  useUserStore.getState().signInMock();
  const tree = render(
    <NavigationContainer>
      <MeScreen />
    </NavigationContainer>
  );
  const btn = await tree.findByText('Sair');
  fireEvent.press(btn);
  await new Promise((r) => setTimeout(r, 150));
  expect(useUserStore.getState().user).toBeUndefined();
});