import { router } from 'expo-router';
import { cn } from 'heroui-native';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { CeolxLogo } from '@/components/CeolxLogo';
import { ArtistIcon, SpectatorIcon, VenueIcon } from '@/components/icons/PersonaIcons';

// ── Types ────────────────────────────────────────────────────────────

type Role = 'spectator' | 'artist' | 'venue';

interface Persona {
  role: Role;
  icon: ReactNode;
  title: string;
  description: string;
}

// ── Data ─────────────────────────────────────────────────────────────

const PERSONAS: Persona[] = [
  {
    role: 'spectator',
    icon: <SpectatorIcon />,
    title: 'Spectator',
    description: 'Discover and book seats for exclusive music events.',
  },
  {
    role: 'artist',
    icon: <ArtistIcon />,
    title: 'Musician / Artist',
    description: 'Promote your profile, list new gigs, and engage with fans.',
  },
  {
    role: 'venue',
    icon: <VenueIcon />,
    title: 'Venue / Business / Festival',
    description: 'Host events, connect with musicians, track analytics.',
  },
];

// ── Card component ───────────────────────────────────────────────────

function PersonaCard({
  persona,
  selected,
  onPress,
}: {
  persona: Persona;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'flex-row items-start gap-2 rounded-[20px] px-4 py-5 border overflow-hidden',
        selected
          ? 'bg-blue-1 border-blue-10'
          : 'bg-[rgba(141,141,141,0.3)] border-[rgba(141,141,141,0.4)]'
      )}
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.16,
        shadowRadius: 8,
        elevation: 4,
      }}
    >
      {persona.icon}
      <View className="flex-1 gap-1">
        {/* Title — Urbanist Bold 16/20 */}
        <Text className="text-base font-bold text-white leading-5 font-sans">{persona.title}</Text>
        {/* Description — Urbanist Regular 14/18 */}
        <Text className="text-sm font-normal text-white/80 leading-[18px] font-sans">
          {persona.description}
        </Text>
      </View>
    </Pressable>
  );
}

// ── Screen ───────────────────────────────────────────────────────────

export default function WhoAreYouScreen() {
  const [selected, setSelected] = useState<Role | null>(null);

  const handleSelect = (role: Role) => {
    setSelected(role);
    setTimeout(() => {
      router.push(`/(auth)/sign-up?role=${role}`);
    }, 150);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#080808' }}>
      <SafeAreaView style={{ flex: 1 }}>
        <AppHeader titleAlign="center" titleNode={<CeolxLogo />} bgClassName="bg-surface-dark" />

        <View className="flex-1 px-6 pt-4">
          {/* Heading — Urbanist Bold 36/40 */}
          <Text className="text-[36px] font-bold text-white leading-10 font-sans mb-3">
            Who are you?
          </Text>

          {/* Subtitle — Urbanist Regular 16/20 */}
          <Text className="text-base font-normal text-white/80 leading-5 font-sans mb-10">
            Tell us how you'll use the app so we can tailor your experience.
          </Text>

          {/* Persona cards */}
          <View className="gap-6">
            {PERSONAS.map((persona) => (
              <PersonaCard
                key={persona.role}
                persona={persona}
                selected={selected === persona.role}
                onPress={() => handleSelect(persona.role)}
              />
            ))}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
