import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function EditProfileScreen() {
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }}>
      <View className="p-4">
        <TextInput
          className="bg-white rounded-lg h-[52px] px-4 text-base font-medium text-black mb-3"
          placeholder="Display name"
          placeholderTextColor="#8d8d8d"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          className="bg-white rounded-lg px-4 py-3 text-base font-medium text-black mb-3 h-[100px]"
          placeholder="Bio (wired in M6)"
          placeholderTextColor="#8d8d8d"
          multiline
          numberOfLines={4}
          style={{ textAlignVertical: 'top' }}
          value={bio}
          onChangeText={setBio}
        />

        <Pressable
          className="bg-white rounded-full py-4 items-center mt-2"
          onPress={() => router.back()}
        >
          {/* Wired in M6-T1 */}
          <Text className="text-base font-bold text-black">Save Changes</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
