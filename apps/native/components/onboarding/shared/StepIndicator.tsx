import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

type Step = 1 | 2 | 3;
type State = 'done' | 'active' | 'upcoming';

interface StepIndicatorProps {
  currentStep: Step;
  stepCount: 3;
  onStepPress: (step: Step) => void;
}

export function StepIndicator({ currentStep, onStepPress }: StepIndicatorProps) {
  const stateOf = (s: Step): State =>
    s < currentStep ? 'done' : s === currentStep ? 'active' : 'upcoming';

  return (
    <View className="flex-row items-center px-5" style={{ height: 56 }}>
      <StepCircle step={1} state={stateOf(1)} onPress={onStepPress} />
      <Connector active={stateOf(1) === 'done'} />
      <StepCircle step={2} state={stateOf(2)} onPress={onStepPress} />
      <Connector active={stateOf(2) === 'done'} />
      <StepCircle step={3} state={stateOf(3)} onPress={onStepPress} />
    </View>
  );
}

interface ConnectorProps {
  active: boolean;
}

function Connector({ active }: ConnectorProps) {
  return (
    <View
      className="mx-2 flex-1"
      style={{
        height: 2,
        backgroundColor: active ? '#C8FF2F' : 'rgba(255,255,255,0.2)',
      }}
    />
  );
}

interface StepCircleProps {
  step: Step;
  state: State;
  onPress: (step: Step) => void;
}

function StepCircle({ step, state, onPress }: StepCircleProps) {
  const tappable = state === 'done';
  const accessibilityLabel =
    state === 'active'
      ? `Step ${step} of 3, current`
      : state === 'done'
        ? `Step ${step} of 3, completed, tap to go back`
        : `Step ${step} of 3, upcoming`;

  return (
    <Pressable
      onPress={() => {
        if (tappable) onPress(step);
      }}
      disabled={!tappable}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !tappable }}
      className="items-center justify-center rounded-full"
      style={[
        { width: 32, height: 32 },
        state === 'done' && { backgroundColor: '#C8FF2F' },
        state === 'active' && { backgroundColor: '#6155F5' },
        state === 'upcoming' && { borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
      ]}
    >
      {state === 'done' ? (
        <Ionicons name="checkmark" size={18} color="#080808" />
      ) : (
        <Text
          style={{
            color: state === 'active' ? '#fff' : 'rgba(255,255,255,0.4)',
            fontSize: 14,
            fontWeight: '700',
          }}
        >
          {step}
        </Text>
      )}
    </Pressable>
  );
}
