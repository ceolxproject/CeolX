import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { form, layout } from '@/styles/shared';

export default function EditProfileScreen() {
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');

  return (
    <SafeAreaView style={layout.container}>
      <View style={layout.inner}>
        <TextInput
          style={form.input}
          placeholder="Display name"
          placeholderTextColor="#999"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={[form.input, styles.bioInput]}
          placeholder="Bio (wired in M6)"
          placeholderTextColor="#999"
          multiline
          numberOfLines={4}
          value={bio}
          onChangeText={setBio}
        />

        <TouchableOpacity style={[form.button, { marginTop: 8 }]} onPress={() => router.back()}>
          {/* Wired in M6-T1 */}
          <Text style={form.buttonText}>Save Changes</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bioInput: { height: 100, textAlignVertical: 'top' },
});
