import { router, useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Step1BasicInfo } from '@/components/onboarding/artist/Step1BasicInfo';
import { Step2ProfileDetails } from '@/components/onboarding/artist/Step2ProfileDetails';
import { Step3SocialMedia } from '@/components/onboarding/artist/Step3SocialMedia';
import { OnboardingHeader } from '@/components/onboarding/shared/OnboardingHeader';
import { StepIndicator } from '@/components/onboarding/shared/StepIndicator';
import { StepNavButtons } from '@/components/onboarding/shared/StepNavButtons';
import { useAuth } from '@/contexts/auth-context';
import { useArtistOnboarding } from '@/hooks/use-artist-onboarding';
import { useDiscardOnboardingBackHandler } from '@/hooks/use-discard-onboarding-back-handler';

export default function ArtistOnboardingScreen() {
  const { logout } = useAuth();
  const navigation = useNavigation();
  const onboarding = useArtistOnboarding();
  const { currentStep, goBack, goToStep, goNext, isPending } = onboarding;

  const handleLogoutAndExit = () => {
    void (async () => {
      await logout();
      router.replace('/(auth)/sign-in');
    })();
  };

  useDiscardOnboardingBackHandler({
    enabled: currentStep === 1,
    onConfirmDiscard: handleLogoutAndExit,
  });

  // On Step 2/3, hardware back and iOS swipe-back walk the user one step
  // backward instead of leaving onboarding (Step 1 is handled by the discard
  // hook above). Mounting these listeners only when currentStep > 1 avoids
  // any overlap with the discard hook.
  useEffect(() => {
    if (currentStep === 1) return;
    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    const navUnsub = navigation.addListener('beforeRemove', (e) => {
      const actionType = e.data.action.type;
      const isBackNavigation =
        actionType === 'GO_BACK' || actionType === 'POP' || actionType === 'POP_TO_TOP';
      if (!isBackNavigation) return;
      e.preventDefault();
      goBack();
    });
    return () => {
      backSub.remove();
      navUnsub();
    };
  }, [currentStep, goBack, navigation]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: '#080808' }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <OnboardingHeader onLogoutPress={handleLogoutAndExit} />
        <StepIndicator currentStep={currentStep} stepCount={3} onStepPress={goToStep} />
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, paddingTop: 16 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {currentStep === 1 ? <Step1BasicInfo {...onboarding} /> : null}
          {currentStep === 2 ? <Step2ProfileDetails {...onboarding} /> : null}
          {currentStep === 3 ? <Step3SocialMedia {...onboarding} /> : null}
        </ScrollView>
        <StepNavButtons
          showBack={currentStep > 1}
          primaryLabel={currentStep === 3 ? 'Create Artist Profile' : 'Next'}
          isPending={isPending}
          onBack={goBack}
          onPrimary={goNext}
        />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
