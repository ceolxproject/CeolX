import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

interface AddArtistModalProps {
  visible: boolean;
  onClose: () => void;
  onInvite: (artist: { name: string; email: string }) => void;
}

export function AddArtistModal({ visible, onClose, onInvite }: AddArtistModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInvite = useCallback(() => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Invalid email address';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onInvite({ name: name.trim(), email: email.trim().toLowerCase() });
    setName('');
    setEmail('');
    setErrors({});
  }, [name, email, onInvite]);

  const handleClose = useCallback(() => {
    setName('');
    setEmail('');
    setErrors({});
    onClose();
  }, [onClose]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-end"
      >
        <Pressable className="flex-1" onPress={handleClose} />
        <View className="bg-[#1a1a1a] rounded-t-3xl px-5 pt-5 pb-10 border-t border-gray-8">
          {/* Header */}
          <View className="flex-row items-center justify-between mb-6">
            <Text className="text-lg font-bold text-white font-urbanist">
              Invite External Artist
            </Text>
            <Pressable onPress={handleClose} hitSlop={12}>
              <Ionicons name="close" size={24} color="rgba(255,255,255,0.6)" />
            </Pressable>
          </View>

          <Text className="text-xs text-white/40 font-urbanist mb-4">
            Invite an artist who isn't on CeolX yet. They'll be listed as a collaborator on your
            event.
          </Text>

          {/* Name field */}
          <View className="gap-1.5 mb-4">
            <Text className="text-sm font-semibold text-gray-3 font-urbanist">Artist Name</Text>
            <TextInput
              className={cn(
                'rounded-lg border bg-surface px-4 py-3 text-sm text-white font-urbanist',
                errors.name ? 'border-error' : 'border-gray-8'
              )}
              placeholder="Enter artist name"
              placeholderTextColor="#8d8d8d"
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
              }}
              maxLength={150}
              autoFocus
            />
            {errors.name ? (
              <Text className="text-xs text-error font-urbanist">{errors.name}</Text>
            ) : null}
          </View>

          {/* Email field */}
          <View className="gap-1.5 mb-6">
            <Text className="text-sm font-semibold text-gray-3 font-urbanist">Email Address</Text>
            <TextInput
              className={cn(
                'rounded-lg border bg-surface px-4 py-3 text-sm text-white font-urbanist',
                errors.email ? 'border-error' : 'border-gray-8'
              )}
              placeholder="Enter email address"
              placeholderTextColor="#8d8d8d"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {errors.email ? (
              <Text className="text-xs text-error font-urbanist">{errors.email}</Text>
            ) : null}
          </View>

          {/* Invite button */}
          <Pressable
            onPress={handleInvite}
            className="bg-[#C8FF2F] rounded-xl py-4 items-center active:opacity-80"
            accessibilityRole="button"
          >
            <Text className="text-black text-base font-bold font-urbanist">INVITE</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
