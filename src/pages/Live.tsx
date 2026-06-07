import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Radio, Trophy, Swords, Eye, ArrowRight, Tv } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TournamentCard } from '@/components/tournament-card';

export default function Live() {
  const queryClient = useQueryClient();
  const [viewerCounts, setViewerCounts] = useState<Record<string, number>>({});

  const { data: liveTournaments = [], isLoading: tLoading } = useQuery({
    queryKey: ['live-tournaments'],
    queryFn: async () => {
      const { data } = await supabase
        .from('tournaments')
        .select('*')
        .eq('status', 'live')
        .order('start_date', { ascending: false });
      return data ?? [];
    },
  });

  const { data: liveMatches = [], isLoading: mLoading } = useQuery({
    queryKey: ['live-matches'],
    queryFn: async () => {
      const { data } = await supabase
        .from('matches')
        .select('*, tournaments(id, title, game)')
        .eq('status', 'live')
        .order('updated_at', { ascending: false });
      return data ?? [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['live-match-profiles', liveMatches.map((m: any) => m.id).join(',')],
    queryFn: async () => {
      const ids = Array.from(
        new Set(liveMatches.flatMap((m: any) => [m.player1_id, m.player2_id]).filter(Boolean))
      );
      if (ids.length === 0) return [];
      const { data } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url')
        .in('user_id', ids);
      return data ?? [];
    },
    enabled: liveMatches.length > 0,
  });

  const getProfile = (id: string | null) =>
    id ? profiles.find((p: any) => p.user_id === id) : null;

  // Realtime updates for tournaments + matches
  useEffect(() => {
    const channel = supabase
      .channel('live-hub')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' }, () => {
        queryClient.invalidateQueries({ queryKey: ['live-tournaments'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
        queryClient.invalidateQueries({ queryKey: ['live-matches'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Track viewer counts for live matches via presence
  useEffect(() => {
    if (liveMatches.length === 0) return;
    const channels = liveMatches.map((m: any) => {
      const ch = supabase.channel(`match-viewers-${m.id}`);
      ch.on('presence', { event: 'sync' }, () => {
        const state = ch.presenceState();
        setViewerCounts((prev) => ({ ...prev, [m.id]: Object.keys(state).length }));
      }).subscribe();
      return ch;
    });
    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [liveMatches]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
          <Radio className="h-6 w-6 text-red-500 animate-pulse" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold">Live Now</h1>
          <p className="text-muted-foreground">Watch ongoing tournaments and matches in real-time</p>
        </div>
      </div>

      {/* Live Matches */}
      <section className="mb-12">
        <div className="flex items-center gap-2 mb-6">
          <Swords className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl font-bold">Live Matches</h2>
          <Badge variant="destructive" className="ml-2">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse mr-1.5" />
            {liveMatches.length}
          </Badge>
        </div>

        {mLoading ? (
          <div className="grid md:grid-cols-2 gap-4">
            {[1, 2].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
          </div>
        ) : liveMatches.length === 0 ? (
          <div className="rounded-2xl border border-border/50 bg-card p-10 text-center">
            <Tv className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No matches are live right now. Check back soon!</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {liveMatches.map((m: any) => {
              const p1 = getProfile(m.player1_id);
              const p2 = getProfile(m.player2_id);
              const viewers = viewerCounts[m.id] ?? 0;
              return (
                <Link
                  key={m.id}
                  to={`/live/match/${m.id}`}
                  className="group rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-500/10 via-card to-card p-5 transition-all hover:border-red-500/60 hover:shadow-lg hover:shadow-red-500/10"
                >
                  <div className="flex items-center justify-between mb-4">
                    <Badge variant="destructive">
                      <span className="w-2 h-2 rounded-full bg-white animate-pulse mr-1.5" />
                      LIVE
                    </Badge>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Eye className="h-3.5 w-3.5" />
                      <span>{viewers} watching</span>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground mb-1 truncate">
                    {m.tournaments?.title} • {m.tournaments?.game?.toUpperCase()}
                  </div>

                  <div className="flex items-center justify-between gap-3 my-4">
                    <div className="text-center flex-1 min-w-0">
                      <p className="font-semibold truncate">{p1?.username ?? 'TBD'}</p>
                      <p className="text-3xl font-display font-bold text-primary">{m.player1_score ?? 0}</p>
                    </div>
                    <Swords className="h-6 w-6 text-muted-foreground shrink-0" />
                    <div className="text-center flex-1 min-w-0">
                      <p className="font-semibold truncate">{p2?.username ?? 'TBD'}</p>
                      <p className="text-3xl font-display font-bold text-primary">{m.player2_score ?? 0}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Round {m.round} • Match {m.match_number}</span>
                    <span className="text-primary font-medium group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                      Watch <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Live Tournaments */}
      <section>
        <div className="flex items-center gap-2 mb-6">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <h2 className="font-display text-xl font-bold">Live Tournaments</h2>
          <Badge variant="destructive" className="ml-2">{liveTournaments.length}</Badge>
        </div>

        {tLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
          </div>
        ) : liveTournaments.length === 0 ? (
          <div className="rounded-2xl border border-border/50 bg-card p-10 text-center">
            <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">No tournaments live right now.</p>
            <Button asChild>
              <Link to="/tournaments">Browse all tournaments</Link>
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {liveTournaments.map((t: any) => <TournamentCard key={t.id} tournament={t} />)}
          </div>
        )}
      </section>
    </div>
  );
}
