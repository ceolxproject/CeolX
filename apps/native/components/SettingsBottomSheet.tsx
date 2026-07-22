import { Ionicons } from '@expo/vector-icons';
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import { forwardRef, useCallback, useEffect, useState } from 'react';
import { BackHandler, Pressable, Text, View } from 'react-native';

import { DeleteAccountButton } from './DeleteAccountButton';

interface SettingsBottomSheetProps {
  onChangePassword: () => void;
  onSignOut: () => void;
}

export const SettingsBottomSheet = forwardRef<BottomSheetModal, SettingsBottomSheetProps>(
  ({ onChangePassword, onSignOut }, ref) => {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);

    const handleClose = useCallback(() => {
      if (ref && 'current' in ref) {
        ref.current?.dismiss();
      }
    }, [ref]);

    // Android hardware back: @gorhom/bottom-sheet doesn't hook into it, so an
    // unhandled press falls through to the tab navigator (jumps to the initial
    // tab) instead of just closing the sheet. Returning true consumes the press
    // here so it never reaches the navigator. (Asana bug-bash: settings popup
    // persists / back navigates away instead of closing it.)
    useEffect(() => {
      if (!isOpen) return;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        handleClose();
        return true;
      });
      return () => sub.remove();
    }, [isOpen, handleClose]);

    const handleAbout = useCallback(() => {
      handleClose();
      router.push('/about');
    }, [handleClose, router]);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.6} />
      ),
      []
    );

    return (
      <BottomSheetModal
        ref={ref}
        enableDynamicSizing
        enablePanDownToClose
        onChange={(index) => setIsOpen(index >= 0)}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: '#2B2B2B' }}
        handleIndicatorStyle={{ backgroundColor: '#8d8d8d' }}
      >
        <BottomSheetView className="px-4 pb-8">
          {/* Header */}
          <View className="flex-row items-center mb-6">
            <Pressable onPress={handleClose} hitSlop={8} className="active:opacity-70 mr-3">
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </Pressable>
            <Text className="text-xl font-bold text-white font-urbanist">Settings</Text>
          </View>

          {/* Change Password */}
          <Pressable
            onPress={onChangePassword}
            className="flex-row items-center justify-between py-3 active:opacity-70"
          >
            <View className="flex-row items-center gap-2">
              <View className="w-8 h-8 rounded-full bg-[#C8FF2F] items-center justify-center">
                <Ionicons name="lock-closed-outline" size={16} color="#080808" />
              </View>
              <Text className="text-base text-white font-urbanist">Change Password</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#8D8D8D" />
          </Pressable>

          {/* Divider */}
          <View className="h-px bg-[rgba(141,141,141,0.3)] my-1" />

          {/* Sign Out */}
          <Pressable
            onPress={onSignOut}
            className="flex-row items-center justify-between py-3 active:opacity-70"
          >
            <View className="flex-row items-center gap-2">
              <View className="w-8 h-8 rounded-full bg-[#C8FF2F] items-center justify-center">
                <Ionicons name="log-out-outline" size={16} color="#080808" />
              </View>
              <Text className="text-base text-white font-urbanist">Sign Out</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#8D8D8D" />
          </Pressable>

          {/* Divider */}
          <View className="h-px bg-[rgba(141,141,141,0.3)] my-1" />

          {/* About & Updates */}
          <Pressable
            onPress={handleAbout}
            className="flex-row items-center justify-between py-3 active:opacity-70"
          >
            <View className="flex-row items-center gap-2">
              <View className="w-8 h-8 rounded-full bg-[#C8FF2F] items-center justify-center">
                <Ionicons name="information-circle-outline" size={16} color="#080808" />
              </View>
              <Text className="text-base text-white font-urbanist">About & Updates</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#8D8D8D" />
          </Pressable>

          {/* Divider */}
          <View className="h-px bg-[rgba(141,141,141,0.3)] my-1" />

          {/* Delete Account (M11-T1 — destructive, 30-day cooling-off) */}
          <DeleteAccountButton onDismiss={handleClose} />
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);

SettingsBottomSheet.displayName = 'SettingsBottomSheet';
