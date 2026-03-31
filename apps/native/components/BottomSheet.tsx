import GorhomBottomSheet, {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  type BottomSheetProps as GorhomProps,
} from '@gorhom/bottom-sheet';
import { forwardRef, useCallback } from 'react';
import { View } from 'react-native';

interface BottomSheetProps extends Omit<GorhomProps, 'ref'> {
  snapPoints?: (string | number)[];
}

export const BottomSheet = forwardRef<GorhomBottomSheet, BottomSheetProps>(
  ({ children, snapPoints = ['50%', '90%'], ...props }, ref) => {
    const renderBackdrop = useCallback(
      (backdropProps: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...backdropProps}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.6}
        />
      ),
      []
    );

    return (
      <GorhomBottomSheet
        ref={ref}
        snapPoints={snapPoints}
        index={-1}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: '#2B2B2B' }}
        handleIndicatorStyle={{ backgroundColor: '#8d8d8d' }}
        {...props}
      >
        <View className="flex-1 px-4">{children}</View>
      </GorhomBottomSheet>
    );
  }
);

BottomSheet.displayName = 'BottomSheet';
