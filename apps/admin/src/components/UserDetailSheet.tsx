import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { inferRouterOutputs } from '@trpc/server';
import {
  Building2,
  CalendarDays,
  ChevronDown,
  CreditCard,
  ExternalLink,
  Handshake,
  KeyRound,
  Link2,
  Smartphone,
  User as UserIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

import type { AppRouter } from '@CeolX/api/routers/index';
import { Avatar, AvatarFallback, AvatarImage } from '@CeolX/ui/components/avatar';
import { Badge } from '@CeolX/ui/components/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@CeolX/ui/components/sheet';
import { Skeleton } from '@CeolX/ui/components/skeleton';
import { cn } from '@CeolX/ui/lib/utils';

import { StatusBadge } from '@/components/StatusBadge';
import { formatDate, formatDateTime } from '@/lib/format';
import { initials, PERSONA_CLASS, SUB_CLASS } from '@/lib/userBadges';
import { trpc } from '@/utils/trpc';

type Detail = inferRouterOutputs<AppRouter>['admin']['users']['getById'];

const AUTH_LABEL: Record<string, string> = {
  credential: 'Email / Password',
  google: 'Google',
  apple: 'Apple',
};

function Card({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="border-b border-border/60 py-4 last:border-b-0">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid size-6 place-items-center rounded-md bg-primary/10 text-primary">
          {icon}
        </span>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function KV({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-0.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{k}</span>
      <span className="text-right font-medium break-words">{children ?? '—'}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-r border-border/60 py-3.5 text-center last:border-r-0">
      <div className="font-bold text-lg leading-none">{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

export function UserDetailSheet({
  userId,
  onClose,
}: {
  userId: string | null;
  onClose: () => void;
}) {
  const { data, isLoading, isError, refetch } = useQuery(
    trpc.admin.users.getById.queryOptions({ userId: userId ?? '' }, { enabled: !!userId })
  );

  return (
    <Sheet open={!!userId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="p-0">
        {isError ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="max-w-xs text-sm text-muted-foreground">
              Couldn’t load this user. Check your connection and try again.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Try again
            </button>
          </div>
        ) : isLoading || !data ? (
          <div className="space-y-4 p-6">
            <Skeleton className="h-14 w-2/3" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <DetailBody data={data} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailBody({ data }: { data: Detail }) {
  const { user, artist, venue, socialLinks, lastSession, devices, counts, recentEvents } = data;
  const location = artist?.location ?? venue?.county ?? null;
  const subStatus = venue?.subscriptionStatus ?? null;
  const avatarSrc = artist?.profileImageUrl ?? venue?.profileImageUrl ?? user.image;

  const stats =
    user.currentRole === 'artist'
      ? [
          { label: 'Events', value: counts.events },
          { label: 'Followers', value: counts.followers },
          { label: 'Posts', value: counts.posts },
        ]
      : user.currentRole === 'venue'
        ? [
            { label: 'Events', value: counts.events },
            { label: 'Followers', value: counts.followers },
            { label: 'Posts', value: counts.posts },
          ]
        : [
            { label: 'Saved', value: counts.saved },
            { label: 'Following', value: counts.following },
          ];
  const statCols =
    stats.length === 4 ? 'grid-cols-4' : stats.length === 3 ? 'grid-cols-3' : 'grid-cols-2';

  return (
    <>
      <SheetHeader className="border-b border-border bg-gradient-to-b from-primary/5 to-transparent p-6 pb-5">
        <div className="flex gap-3.5 pr-7">
          <Avatar className="size-14 ring-2 ring-primary/30 ring-offset-2 ring-offset-background">
            {avatarSrc && <AvatarImage src={avatarSrc} alt={user.name} />}
            <AvatarFallback className="text-base">{initials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <SheetTitle className="truncate text-xl">{user.name}</SheetTitle>
            <SheetDescription className="truncate">{user.email}</SheetDescription>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge
                variant="outline"
                className={cn('capitalize', PERSONA_CLASS[user.currentRole])}
              >
                {user.currentRole}
              </Badge>
              <Badge
                variant="outline"
                className={
                  user.emailVerified
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-amber-200 bg-amber-50 text-amber-800'
                }
              >
                {user.emailVerified ? 'Verified' : 'Unverified'}
              </Badge>
              {subStatus && (
                <Badge variant="outline" className={cn('capitalize', SUB_CLASS[subStatus])}>
                  {subStatus.replace('_', ' ')}
                </Badge>
              )}
              {user.flaggedInactive && (
                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                  Inactive
                </Badge>
              )}
              {user.isAnonymized && (
                <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                  Anonymized
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>Member since {formatDate(user.createdAt)}</span>
          {location && <span>· {location}</span>}
          <span className="font-mono">· {user.id.slice(0, 12)}…</span>
        </div>
      </SheetHeader>

      <div className={cn('grid border-b border-border', statCols)}>
        {stats.map((s) => (
          <Stat key={s.label} label={s.label} value={s.value} />
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-6">
        {recentEvents.length > 0 && (
          <Card icon={<CalendarDays size={14} />} title="Events">
            {recentEvents.map((e) => (
              <Link
                key={e.id}
                to="/events/moderation"
                search={{ createdBy: user.id, eventId: e.id }}
                className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
              >
                <span className="min-w-0 truncate font-medium">{e.title}</span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  {formatDate(e.dateStart)}
                  <StatusBadge status={e.status} />
                </span>
              </Link>
            ))}
            {counts.events > recentEvents.length && (
              <Link
                to="/events/moderation"
                search={{ createdBy: user.id }}
                className="mt-2 inline-flex text-sm font-medium text-primary hover:underline"
              >
                View all {counts.events} events →
              </Link>
            )}
          </Card>
        )}

        {(artist || venue) && (
          <Card icon={<Handshake size={14} />} title="Bookings">
            {artist ? (
              <>
                <KV k="Requested">{counts?.artistRequested}</KV>
                <KV k="Invited">{counts?.artistInvited}</KV>
              </>
            ) : (
              <>
                <KV k="Invites sent">{counts.venueSent}</KV>
                <KV k="Requests received">{counts.venueReceived}</KV>
              </>
            )}
          </Card>
        )}

        {artist && (
          <Card icon={<UserIcon size={14} />} title="Artist profile">
            <KV k="Stage name">{artist.stageName}</KV>
            <KV k="Genres">
              {artist.genres.length ? (
                <span className="flex flex-wrap justify-end gap-1.5">
                  {artist.genres.map((g) => (
                    <span key={g} className="rounded bg-muted px-2 py-0.5 text-xs font-semibold">
                      {g}
                    </span>
                  ))}
                </span>
              ) : (
                '—'
              )}
            </KV>
            <KV k="Booking email">{artist.contactEmail}</KV>
            {artist.bio && <p className="pt-1 text-sm text-muted-foreground">{artist.bio}</p>}
          </Card>
        )}

        {venue && (
          <Card icon={<Building2 size={14} />} title="Venue profile">
            <KV k="Venue name">{venue.venueName}</KV>
            <KV k="Address">{venue.address}</KV>
            <KV k="County">{venue.county}</KV>
            <KV k="Phone">{venue.phone}</KV>
            <KV k="Website">{venue.websiteUrl}</KV>
            <KV k="Coordinates">{venue.lat && venue.lng ? `${venue.lat}, ${venue.lng}` : '—'}</KV>
          </Card>
        )}

        {venue && (
          <Card icon={<CreditCard size={14} />} title="Membership">
            <KV k="Tier">Venue</KV>
            <KV k="Status">
              {subStatus ? (
                <Badge variant="outline" className={cn('capitalize', SUB_CLASS[subStatus])}>
                  {subStatus.replace('_', ' ')}
                </Badge>
              ) : (
                '—'
              )}
            </KV>
            {subStatus === 'inactive' && (
              <p className="pt-1 text-xs text-muted-foreground">
                Venue subscriptions aren&rsquo;t live yet, so every venue reads inactive until
                billing ships.
              </p>
            )}
            {venue.subscription && (
              <>
                <KV k="Plan">{venue.subscription.plan}</KV>
                <KV k="Renews">{formatDate(venue.subscription.currentPeriodEnd)}</KV>
              </>
            )}
            {venue.stripeCustomerId && (
              <KV k="Stripe customer">
                <span className="font-mono text-xs text-muted-foreground">
                  {venue.stripeCustomerId}
                </span>
              </KV>
            )}
          </Card>
        )}

        <Card icon={<KeyRound size={14} />} title="Account & sign-in">
          <KV k="Sign-in">
            {data.authMethods.length
              ? data.authMethods.map((m) => AUTH_LABEL[m] ?? m).join(', ')
              : '—'}
          </KV>
          <KV k="Password set">{data.hasPassword ? 'Yes' : 'No'}</KV>
          <KV k="Last login">{formatDateTime(user.lastLoginAt)}</KV>
          <KV k="Marketing">{user.marketingConsent ? 'Opted in' : 'No'}</KV>
        </Card>

        <Card icon={<Smartphone size={14} />} title="Devices & sessions">
          <KV k="Devices">
            {devices.length
              ? devices.map((d) => `${d.platform}${d.isActive ? '' : ' (inactive)'}`).join(', ')
              : 'None'}
          </KV>
          <KV k="Active sessions">{data.activeSessionCount}</KV>
          <KV k="Last session OS">{lastSession?.os ?? '—'}</KV>
          <KV k="Last session IP">{lastSession?.ipAddress ?? '—'}</KV>
          <KV k="Last seen">{formatDateTime(lastSession?.createdAt ?? null)}</KV>
        </Card>

        {socialLinks.length > 0 && (
          <Card icon={<Link2 size={14} />} title="Social">
            <div className="flex flex-col">
              {socialLinks.map((s) => (
                <a
                  key={s.platform}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between py-1.5 text-sm font-medium text-primary hover:underline"
                >
                  <span className="capitalize">{s.platform.toLowerCase()}</span>
                  <ExternalLink size={13} className="opacity-60" />
                </a>
              ))}
            </div>
          </Card>
        )}

        <details className="border-t border-border/60 py-4">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-muted-foreground [&::-webkit-details-marker]:hidden">
            <ChevronDown size={15} />
            Compliance &amp; technical
          </summary>
          <div className="mt-3 space-y-1">
            <KV k="User ID">
              <span className="font-mono text-xs text-muted-foreground">{user.id}</span>
            </KV>
            <KV k="Consent given">{formatDateTime(user.consentAt)}</KV>
            <KV k="Profile updated">{formatDateTime(user.updatedAt)}</KV>
            <KV k="Deletion requested">{formatDateTime(user.deletionRequestedAt)}</KV>
            <KV k="Scheduled for">{formatDateTime(user.deletionScheduledFor)}</KV>
            <KV k="Anonymized">{formatDateTime(user.anonymizedAt)}</KV>
          </div>
        </details>
      </div>
    </>
  );
}
