// NOTE: Requires @testing-library/react-native and jest setup.
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import MeScreen from '../screens/Me/MeScreen';
import { NavigationContainer } from '@react-navigation/native';

test('render MeScreen shows name and publicId', async () => {
  const tree = render(
    <NavigationContainer>
      <MeScreen />
    </NavigationContainer>
  );

  expect(await tree.findByText(/Jose Roberto/)).toBeTruthy();
  expect(await tree.findByText(/Go\d+/)).toBeTruthy();
});

test('tap Recently Used navigates', async () => {
  const tree = render(
    <NavigationContainer>
      <MeScreen />
    </NavigationContainer>
  );
  const btn = await tree.findByLabelText('Recently Used');
  fireEvent.press(btn);
});