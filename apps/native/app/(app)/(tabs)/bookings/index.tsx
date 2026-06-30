import { SafeAreaView } from 'react-native-safe-area-context';

import { UserRole } from '@CeolX/shared/enums';

import { AppHeader } from '@/components/AppHeader';
import { SavedEventsContent } from '@/components/saved-events/SavedEventsContent';
import { authClient } from '@/lib/auth-client';

export default function BookingsTabScreen() {
  const { data: session } = authClient.useSession();
  const currentRole = session?.user?.currentRole ?? 'spectator';

  // Spectators call this tab "Bookings"; artist/venue call it "My Events".
  // Both now show the user's saved/bookmarked events.
  const title = currentRole === UserRole.SPECTATOR ? 'Bookings' : 'My Events';

  return (
    <SafeAreaView
      className="flex-1 bg-[#080808]"
      style={{ flex: 1, backgroundColor: '#080808' }}
      edges={['top']}
    >
      <AppHeader leading="none" title={title} showBell />
      <SavedEventsContent />
    </SafeAreaView>
  );
}
