import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import PullToRefresh from '../PullToRefresh';

describe('PullToRefresh', () => {
  it('renders children', () => {
    const { getByText } = render(
      <PullToRefresh onRefresh={jest.fn()}>
        <Text>Контент</Text>
      </PullToRefresh>,
    );

    expect(getByText('Контент')).toBeTruthy();
  });
});
