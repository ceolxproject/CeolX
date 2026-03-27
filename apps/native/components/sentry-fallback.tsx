import { Text, TouchableOpacity, View } from 'react-native';

export function FallbackComponent({ resetError }: { resetError?: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>
        Something went wrong
      </Text>
      <Text style={{ textAlign: 'center', marginBottom: 24, color: '#666' }}>
        An unexpected error occurred. Please try again.
      </Text>
      {resetError && (
        <TouchableOpacity
          onPress={resetError}
          style={{
            backgroundColor: '#007AFF',
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>Try again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
