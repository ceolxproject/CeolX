import { router, useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnboardingHeader } from '@/components/onboarding/shared/OnboardingHeader';
import { StepIndicator } from '@/components/onboarding/shared/StepIndicator';
import { StepNavButtons } from '@/components/onboarding/shared/StepNavButtons';
import { Step1BasicInfo } from '@/components/onboarding/venue/Step1BasicInfo';
import { Step2ProfileDetails } from '@/components/onboarding/venue/Step2ProfileDetails';
import { Step3SocialMedia } from '@/components/onboarding/venue/Step3SocialMedia';
import { useAuth } from '@/contexts/auth-context';
import { useDiscardOnboardingBackHandler } from '@/hooks/use-discard-onboarding-back-handler';
import { useVenueOnboarding } from '@/hooks/use-venue-onboarding';

export default function VenueOnboardingScreen() {
  const { logout } = useAuth();
  const navigation = useNavigation();
  const onboarding = useVenueOnboarding();
  const { currentStep, goBack, goToStep, goNext, isPending, clearDraft } = onboarding;

  const handleLogoutAndExit = () => {
    void (async () => {
      // Discarding onboarding is a deliberate abandon — drop the saved draft so
      // it doesn't silently restore on the next sign-up for this account.
      clearDraft();
      await logout();
      router.replace('/(auth)/sign-in');
    })();
  };

  useDiscardOnboardingBackHandler({
    enabled: currentStep === 1,
    onConfirmDiscard: handleLogoutAndExit,
  });

  useEffect(() => {
    if (currentStep === 1) return;
    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    // Only intercept BACK-type navigation — otherwise the
    // `router.replace('/(app)/(tabs)/map')` triggered after a successful
    // submit would also be cancelled and bounce the user back to Step 2.
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
          primaryLabel={currentStep === 3 ? 'Create Venue Profile' : 'Next'}
          isPending={isPending}
          onBack={goBack}
          onPrimary={goNext}
        />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
