import { Text, View } from 'react-native';

interface SinglePinProps {
  type: 'single';
  categoryIcon?: string;
}

interface ClusterPinProps {
  type: 'cluster';
  count: number;
}

type MapEventPinProps = SinglePinProps | ClusterPinProps;

export function MapEventPin(props: MapEventPinProps) {
  if (props.type === 'cluster') {
    return (
      <View className="h-9 w-9 rounded-full bg-green-10 items-center justify-center shadow-md">
        <Text className="text-xs font-bold text-surface-dark">{props.count}</Text>
      </View>
    );
  }

  return (
    <View className="h-8 w-8 rounded-full bg-green-10 items-center justify-center shadow-md">
      <Text className="text-sm">{props.categoryIcon ?? '🎵'}</Text>
    </View>
  );
}
