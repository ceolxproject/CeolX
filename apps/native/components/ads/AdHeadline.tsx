import { Text } from 'react-native';

export type AdHeadlineProps = {
  adTitle: string | null | undefined;
  eventTitle: string;
};

/**
 * The bold headline shown above an ad/offer.
 *
 * Ad Title is optional: when present we render `"<title> on \"<event>\""`;
 * when it is empty/whitespace we fall back to just the bold event title so a
 * description-only ad reads cleanly (no dangling "on" prefix).
 */
export function AdHeadline({ adTitle, eventTitle }: AdHeadlineProps) {
  const hasTitle = !!adTitle?.trim();
  return (
    <Text className="text-base font-medium text-black font-urbanist">
      {hasTitle ? <Text>{adTitle} on </Text> : null}
      <Text className="font-bold">&ldquo;{eventTitle}&rdquo;</Text>
    </Text>
  );
}
