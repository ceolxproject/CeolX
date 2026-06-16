import { useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { Alert, BackHandler } from 'react-native';

import { isBackNavigationAction } from '@/lib/onboarding-navigation';

interface UseDiscardOnboardingBackHandlerOpts {
  enabled: boolean;
  onConfirmDiscard: () => void;
}

export function useDiscardOnboardingBackHandler({
  enabled,
  onConfirmDiscard,
}: UseDiscardOnboardingBackHandlerOpts) {
  const navigation = useNavigation();

  // Android hardware back. Returning true prevents the default pop, so
  // beforeRemove never fires on this path — no double-alerts.
  useEffect(() => {
    if (!enabled) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      showDiscardAlert(onConfirmDiscard);
      return true;
    });
    return () => sub.remove();
  }, [enabled, onConfirmDiscard]);

  // iOS edge-swipe + Android gesture-back + programmatic router.back().
  useEffect(() => {
    if (!enabled) return;
    const unsub = navigation.addListener('beforeRemove', (e) => {
      // Only prompt on a genuine back gesture. Programmatic REPLACE / PUSH
      // redirects from the auth + onboarding routing flow (e.g. the Google
      // sign-up roundtrip landing on this screen) also fire `beforeRemove`, and
      // must pass through — otherwise the discard dialog appears unbidden mid
      // sign-up (Asana 1215278068024772).
      if (!isBackNavigationAction(e.data.action.type)) return;
      e.preventDefault();
      showDiscardAlert(() => {
        onConfirmDiscard();
        navigation.dispatch(e.data.action);
      });
    });
    return unsub;
  }, [enabled, onConfirmDiscard, navigation]);
}

function showDiscardAlert(onConfirm: () => void) {
  Alert.alert(
    'Discard onboarding?',
    'Your progress will be lost. You can finish setting up your profile later.',
    [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onConfirm },
    ]
  );
}
