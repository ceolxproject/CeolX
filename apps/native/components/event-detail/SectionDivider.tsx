import { cn } from 'heroui-native';
import { View } from 'react-native';

interface SectionDividerProps {
  className?: string;
}

export function SectionDivider({ className }: SectionDividerProps) {
  return <View className={cn('h-px bg-[rgba(141,141,141,0.5)] my-6', className)} />;
}
