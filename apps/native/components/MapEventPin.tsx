import { Image, StyleSheet, Text, View } from 'react-native';

type SinglePinProps = {
  type: 'single';
  coverImageUrl?: string;
  category?: string;
  categoryIcon?: string;
  isSelected?: boolean;
};

type ClusterPinProps = {
  type: 'cluster';
  count: number;
};

type MapEventPinProps = SinglePinProps | ClusterPinProps;

export function MapEventPin(props: MapEventPinProps) {
  if (props.type === 'cluster') {
    return (
      <View style={styles.clusterPin}>
        <Text style={styles.clusterText}>{props.count}</Text>
      </View>
    );
  }

  const { coverImageUrl, category, categoryIcon, isSelected } = props;

  const pinSize = isSelected ? 56 : 44;
  const pinRadius = isSelected ? 28 : 22;

  return (
    <View style={styles.pinWrapper}>
      {/* Category badge above the pin */}
      {(category ?? categoryIcon) ? (
        <View style={styles.categoryBadge}>
          {categoryIcon ? <Text style={styles.categoryBadgeIcon}>{categoryIcon}</Text> : null}
          {category ? <Text style={styles.categoryBadgeText}>{category}</Text> : null}
        </View>
      ) : null}

      {/* Outer glow ring — only when selected */}
      {isSelected ? (
        <View style={styles.glowRing}>
          <View
            style={[styles.pinCircle, { width: pinSize, height: pinSize, borderRadius: pinRadius }]}
          >
            {coverImageUrl ? (
              <Image
                source={{ uri: coverImageUrl }}
                style={{ width: pinSize, height: pinSize, borderRadius: pinRadius }}
                resizeMode="cover"
              />
            ) : (
              <View
                style={[
                  styles.pinFallback,
                  { width: pinSize, height: pinSize, borderRadius: pinRadius },
                ]}
              >
                <Text style={styles.pinFallbackIcon}>{categoryIcon ?? '🎵'}</Text>
              </View>
            )}
          </View>
        </View>
      ) : (
        <View
          style={[styles.pinCircle, { width: pinSize, height: pinSize, borderRadius: pinRadius }]}
        >
          {coverImageUrl ? (
            <Image
              source={{ uri: coverImageUrl }}
              style={{ width: pinSize, height: pinSize, borderRadius: pinRadius }}
              resizeMode="cover"
            />
          ) : (
            <View
              style={[
                styles.pinFallback,
                { width: pinSize, height: pinSize, borderRadius: pinRadius },
              ]}
            >
              <Text style={styles.pinFallbackIcon}>{categoryIcon ?? '🎵'}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Cluster
  clusterPin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#C8FF2F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clusterText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },

  // Single pin
  pinWrapper: {
    alignItems: 'center',
  },
  pinCircle: {
    borderWidth: 2,
    borderColor: '#ffffff',
    overflow: 'hidden',
  },
  pinFallback: {
    backgroundColor: '#C8FF2F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinFallbackIcon: {
    fontSize: 18,
  },

  // Selected glow ring
  glowRing: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: '#6155F5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6155F5',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
    elevation: 8,
  },

  // Category badge
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#C8FF2F',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
    marginBottom: 4,
    gap: 3,
  },
  categoryBadgeIcon: {
    fontSize: 10,
  },
  categoryBadgeText: {
    fontSize: 10,
    color: '#000000',
    fontWeight: '600',
    fontFamily: 'Urbanist_700Bold',
  },
});
