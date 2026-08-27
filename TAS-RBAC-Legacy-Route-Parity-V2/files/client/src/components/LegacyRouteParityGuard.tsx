import { PropsWithChildren } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  isLegacyParityAllowed,
  legacyRouteNeedsTaraProfile,
} from "@/lib/legacyRouteParity";

export default function LegacyRouteParityGuard({ children }: PropsWithChildren) {
  const [location] = useLocation();
  const { user, loading, isAuthenticated } = useAuth({ redirectOnUnauthenticated: true });
  const needsTaraProfile = legacyRouteNeedsTaraProfile(location);
  const taraProfileQ = trpc.tara.moderation.profile.useQuery(undefined, {
    enabled: Boolean(isAuthenticated && needsTaraProfile),
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (loading || (needsTaraProfile && taraProfileQ.isLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !user) return null;

  const allowed = isLegacyParityAllowed(user.role, location, {
    taraCanAccess: Boolean(taraProfileQ.data?.canAccess),
  });

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="max-w-md w-full rounded-2xl border bg-card p-6 text-center shadow-sm">
          <h1 className="text-xl font-semibold">Access denied</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You do not have permission to open this page.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
