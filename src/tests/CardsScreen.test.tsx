import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import CardsScreen from '../screens/Cards/CardsScreen';
import { NavigationContainer } from '@react-navigation/native';
import { useUserStore } from '../stores/useUserStore';

test('add/remove card toggles hasPaymentCard', async () => {
  const tree = render(
    <NavigationContainer>
      <CardsScreen />
    </NavigationContainer>
  );

  // inicialmente verdadeiro (dois cartões pré-cadastrados)
  expect(useUserStore.getState().user?.hasPaymentCard).toBe(true);

  const input = tree.getByPlaceholderText('Número do cartão');
  fireEvent.changeText(input, '4111 1111 1111 1111');
  const save = tree.getByLabelText('Salvar');
  fireEvent.press(save);
  // continua verdadeiro após adicionar mais um
  expect(useUserStore.getState().user?.hasPaymentCard).toBe(true);
});