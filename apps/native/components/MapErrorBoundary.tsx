import * as Sentry from '@sentry/react-native';
import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Text, View } from 'react-native';

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class MapErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View className="flex-1 items-center justify-center bg-[#080808] px-6">
          <Text className="text-white text-base text-center">
            Something went wrong loading the map.
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}
