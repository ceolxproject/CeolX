import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCollections, useCreateCollection, useDeleteCollection } from '@/hooks/use-collections';

export default function CollectionsScreen() {
  const { data: collections, isLoading } = useCollections();
  const createMutation = useCreateCollection();
  const deleteMutation = useDeleteCollection();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createMutation.mutateAsync({
      name: newName.trim(),
      description: newDescription.trim() || undefined,
    });
    setNewName('');
    setNewDescription('');
    setShowCreate(false);
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      'Delete Collection',
      `Are you sure you want to delete "${name}"? Events in this collection will be unlinked but not deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(id),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 h-14">
        <View className="flex-row items-center">
          <Pressable onPress={() => router.back()} className="mr-3">
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </Pressable>
          <Text className="text-lg font-bold text-white font-urbanist">Collections</Text>
        </View>
        <Pressable onPress={() => setShowCreate(!showCreate)}>
          <Ionicons name={showCreate ? 'close' : 'add'} size={24} color="#C8FF2F" />
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        {/* Inline create form */}
        {showCreate && (
          <View className="mb-4 rounded-2xl border border-[rgba(141,141,141,0.4)] bg-[rgba(141,141,141,0.1)] p-4 gap-3">
            <Text className="text-sm font-bold text-white font-urbanist">New Collection</Text>
            <TextInput
              className="h-10 rounded-lg bg-white/10 px-3 text-white text-[14px] font-urbanist"
              placeholder="Collection name"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={newName}
              onChangeText={setNewName}
              maxLength={100}
            />
            <TextInput
              className="h-20 rounded-lg bg-white/10 px-3 pt-2 text-white text-sm font-urbanist"
              placeholder="Description (optional)"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={newDescription}
              onChangeText={setNewDescription}
              maxLength={500}
              multiline
              textAlignVertical="top"
            />
            <Pressable
              className="h-10 rounded-lg bg-[#C8FF2F] items-center justify-center"
              onPress={handleCreate}
              disabled={createMutation.isPending || !newName.trim()}
            >
              {createMutation.isPending ? (
                <ActivityIndicator color="#080808" />
              ) : (
                <Text className="text-sm font-bold text-black font-urbanist">Create</Text>
              )}
            </Pressable>
          </View>
        )}

        {/* Collections list */}
        {isLoading ? (
          <View className="py-16 items-center">
            <ActivityIndicator color="#C8FF2F" />
          </View>
        ) : !collections || collections.length === 0 ? (
          <View className="py-16 items-center">
            <Ionicons name="albums-outline" size={48} color="rgba(255,255,255,0.2)" />
            <Text className="text-base text-white/60 text-center mt-4 font-urbanist">
              No collections yet.{'\n'}Create one to group your events.
            </Text>
          </View>
        ) : (
          <View className="gap-3 pb-8">
            {collections.map((collection) => (
              <Pressable
                key={collection.id}
                className="rounded-2xl border border-[rgba(141,141,141,0.4)] bg-[rgba(141,141,141,0.1)] p-4 flex-row items-center justify-between active:opacity-80"
                onPress={() => router.push(`/(app)/(tabs)/profile/collection/${collection.id}`)}
              >
                <View className="flex-1 mr-3">
                  <Text className="text-base font-semibold text-white font-urbanist">
                    {collection.name}
                  </Text>
                  {collection.description && (
                    <Text className="text-xs text-white/60 mt-1 font-urbanist" numberOfLines={2}>
                      {collection.description}
                    </Text>
                  )}
                  <Text className="text-xs text-white/40 mt-1.5 font-urbanist">
                    {collection.eventCount} event{collection.eventCount !== 1 ? 's' : ''}
                  </Text>
                </View>
                <Pressable
                  onPress={() => handleDelete(collection.id, collection.name)}
                  className="p-2"
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={18} color="rgba(255,255,255,0.4)" />
                </Pressable>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
