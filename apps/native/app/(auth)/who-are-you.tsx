import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Role = 'spectator' | 'artist' | 'venue';

const PERSONAS: { role: Role; emoji: string; title: string; description: string }[] = [
  {
    role: 'spectator',
    emoji: '🎵',
    title: 'Spectator',
    description: 'Discover live Irish music events near you',
  },
  {
    role: 'artist',
    emoji: '🎸',
    title: 'Musician / Artist',
    description: 'Promote your performances and get booked',
  },
  {
    role: 'venue',
    emoji: '🏛️',
    title: 'Venue / Business',
    description: 'List gigs, recruit artists and run ads',
  },
];

export default function WhoAreYouScreen() {
  const [selected, setSelected] = useState<Role | null>(null);

  const handleSelect = (role: Role) => {
    setSelected(role);
    setTimeout(() => {
      router.push(`/(auth)/sign-up?role=${role}`);
    }, 150);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.logoText}>CEOLX</Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.heading}>Who are you?</Text>
          <Text style={styles.subheading}>Choose your role to personalise your experience</Text>

          {PERSONAS.map(({ role, emoji, title, description }) => (
            <TouchableOpacity
              key={role}
              style={[styles.card, selected === role && styles.cardSelected]}
              onPress={() => handleSelect(role)}
              activeOpacity={0.8}
            >
              <Text style={styles.cardEmoji}>{emoji}</Text>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{title}</Text>
                <Text style={styles.cardDescription}>{description}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080808' },
  safeArea: { flex: 1 },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    alignItems: 'center',
  },
  logoText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  heading: {
    fontSize: 36,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 40,
    marginBottom: 8,
  },
  subheading: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 32,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(141,141,141,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(141,141,141,0.4)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  cardSelected: {
    borderColor: '#6741FF',
    backgroundColor: 'rgba(103,65,255,0.15)',
  },
  cardEmoji: {
    fontSize: 32,
    marginRight: 16,
  },
  cardText: { flex: 1 },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 20,
  },
});
