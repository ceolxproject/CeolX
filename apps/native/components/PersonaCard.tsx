import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { Image, Pressable, Text, View, type PressableProps } from 'react-native';

interface Tag {
  label: string;
}

interface PersonaCardProps extends Omit<PressableProps, 'style'> {
  name: string;
  bio?: string;
  imageUri?: string;
  tags?: Tag[];
  type: 'artist' | 'venue';
  className?: string;
}

export function PersonaCard({
  name,
  bio,
  imageUri,
  tags = [],
  type: _type,
  className,
  ...props
}: PersonaCardProps) {
  return (
    <Pressable
      className={cn(
        'flex-row items-center gap-3 p-4 rounded-xl bg-card active:opacity-80',
        className
      )}
      {...props}
    >
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          className="h-14 w-14 rounded-full bg-muted"
          resizeMode="cover"
        />
      ) : (
        <View className="h-14 w-14 rounded-full bg-muted items-center justify-center">
          <Ionicons name="person-outline" size={24} color="#8d8d8d" />
        </View>
      )}
      <View className="flex-1 gap-1">
        <Text className="font-semibold text-white text-sm" numberOfLines={1}>
          {name}
        </Text>
        {bio && (
          <Text className="text-xs text-gray-7" numberOfLines={2}>
            {bio}
          </Text>
        )}
        {tags.length > 0 && (
          <View className="flex-row flex-wrap gap-1 mt-1">
            {tags.slice(0, 3).map((tag) => (
              <View key={tag.label} className="px-2 py-0.5 rounded-full bg-blue-2">
                <Text className="text-xs text-blue-10">{tag.label}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </Pressable>
  );
}
