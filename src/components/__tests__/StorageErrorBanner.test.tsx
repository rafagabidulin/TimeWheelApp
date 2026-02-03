import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import StorageErrorBanner from '../StorageErrorBanner';

describe('StorageErrorBanner', () => {
  it('renders message and handles dismiss', () => {
    const onDismiss = jest.fn();
    const { getByText, getByTestId } = render(
      <StorageErrorBanner message="Ошибка хранилища" onDismiss={onDismiss} />,
    );

    expect(getByText('Ошибка хранилища')).toBeTruthy();
    fireEvent.press(getByTestId('storage-error-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
