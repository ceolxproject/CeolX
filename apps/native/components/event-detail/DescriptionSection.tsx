import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

interface DescriptionSectionProps {
  description: string;
  className?: string;
}

export function DescriptionSection({ description, className }: DescriptionSectionProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View className={className}>
      <Text className="text-xl font-bold text-white font-sans mb-3">Description</Text>
      <Text
        className="text-base text-white/80 font-sans leading-5"
        numberOfLines={expanded ? undefined : 2}
      >
        {description}
        {!expanded && description.length > 120 && <Text>...</Text>}
      </Text>
      {description.length > 120 && (
        <Pressable onPress={() => setExpanded(!expanded)} hitSlop={8}>
          <Text className="text-base text-blue-10 font-sans mt-0.5">
            {expanded ? 'show less' : 'read more'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
