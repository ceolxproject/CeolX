import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
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

import { AppHeader } from '@/components/AppHeader';
import { ProfileEventCard } from '@/components/ProfileEventCard';
import { useCollection, useDeleteCollection, useUpdateCollection } from '@/hooks/use-collections';

export default function CollectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: collection, isLoading } = useCollection(id);
  const updateMutation = useUpdateCollection();
  const deleteMutation = useDeleteCollection();

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const startEditing = () => {
    if (!collection) return;
    setEditName(collection.name);
    setEditDescription(collection.description ?? '');
    setEditing(true);
  };

  const handleSave = async () => {
    if (!id || !editName.trim()) return;
    await updateMutation.mutateAsync({
      id,
      data: {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
      },
    });
    setEditing(false);
  };

  const handleDelete = () => {
    if (!id || !collection) return;
    Alert.alert('Delete Collection', `Are you sure you want to delete "${collection.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteMutation.mutateAsync(id).then(() => router.back());
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#C8FF2F" />
        </View>
      </SafeAreaView>
    );
  }

  if (!collection) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }}>
        <AppHeader leading="back" title="Not Found" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#080808' }}>
      <AppHeader
        leading="back"
        titleNode={
          editing ? (
            <TextInput
              className="flex-1 h-8 text-[18px] font-bold text-white font-urbanist"
              value={editName}
              onChangeText={setEditName}
              maxLength={100}
              autoFocus
            />
          ) : (
            <Text className="text-lg font-bold text-white font-urbanist" numberOfLines={1}>
              {collection.name}
            </Text>
          )
        }
        trailingAccessory={
          editing ? (
            <View className="flex-row items-center gap-3">
              <Pressable onPress={() => setEditing(false)}>
                <Text className="text-sm text-white/60">Cancel</Text>
              </Pressable>
              <Pressable onPress={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <ActivityIndicator color="#C8FF2F" size="small" />
                ) : (
                  <Text className="text-sm font-bold text-[#C8FF2F]">Save</Text>
                )}
              </Pressable>
            </View>
          ) : (
            <View className="flex-row items-center gap-3">
              <Pressable onPress={startEditing}>
                <Ionicons name="pencil-outline" size={20} color="#fff" />
              </Pressable>
              <Pressable onPress={handleDelete}>
                <Ionicons name="trash-outline" size={20} color="rgba(255,255,255,0.5)" />
              </Pressable>
            </View>
          )
        }
      />

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        {/* Description */}
        {editing ? (
          <TextInput
            className="mb-4 rounded-lg bg-white/10 px-3 pt-2 text-white text-sm font-urbanist min-h-[60px]"
            placeholder="Description (optional)"
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={editDescription}
            onChangeText={setEditDescription}
            maxLength={500}
            multiline
            textAlignVertical="top"
          />
        ) : collection.description ? (
          <Text className="text-sm text-white/60 mb-4 font-urbanist">{collection.description}</Text>
        ) : null}

        {/* Event count */}
        <Text className="text-xs text-white/40 mb-4 font-urbanist">
          {collection.eventCount} event{collection.eventCount !== 1 ? 's' : ''}
        </Text>

        {/* Events list */}
        {collection.events.length === 0 ? (
          <View className="py-12 items-center">
            <Text className="text-sm text-white/60 text-center font-urbanist">
              No events in this collection yet.
            </Text>
          </View>
        ) : (
          <View className="gap-4 pb-8">
            {collection.events.map((event) => (
              <ProfileEventCard
                key={event.id}
                id={event.id}
                title={event.title}
                coverImage={event.coverImage}
                dateStart={event.dateStart}
                category={event.category}
                venueAddress={event.venueAddress}
                status={event.status}
                onPress={() => router.push(`/(app)/(tabs)/profile/event/${event.id}`)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
