import { useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { Alert, BackHandler } from 'react-native';

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
