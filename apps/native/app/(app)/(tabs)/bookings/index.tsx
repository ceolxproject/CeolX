import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { SavedEventsContent } from '@/components/saved-events/SavedEventsContent';

export default function BookingsTabScreen() {
  // This tab shows the user's saved/bookmarked events for every role, so it is
  // labelled "My Events" across the board (Asana 1216289752400014).
  const title = 'My Events';

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
