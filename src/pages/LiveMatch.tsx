import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Eye, Share2, Swords, Trophy, Radio } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth-context';

export default function LiveMatch() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [viewers, setViewers] = useState(0);
  const [scoreFlash, setScoreFlash] = useState<'p1' | 'p2' | null>(null);

  const { data: match, isLoading } = useQuery({
    queryKey: ['live-match', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('matches')
        .select('*, tournaments(id, title, game, prize_pool)')
        .eq('id', id!)
        .maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  const { data: players = [] } = useQuery({
    queryKey: ['live-match-players', match?.player1_id, match?.player2_id],
    queryFn: async () => {
      const ids = [match?.player1_id, match?.player2_id].filter(Boolean) as string[];
      if (ids.length === 0) return [];
      const { data } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url, game_handle')
        .in('user_id', ids);
      return data ?? [];
    },
    enabled: !!(match?.player1_id || match?.player2_id),
  });

  const p1 = players.find((p: any) => p.user_id === match?.player1_id);
  const p2 = players.find((p: any) => p.user_id === match?.player2_id);

  // Realtime: score updates
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`live-match-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${id}` },
        (payload: any) => {
          const oldRow = payload.old || {};
          const newRow = payload.new || {};
          if (newRow.player1_score !== oldRow.player1_score) {
            setScoreFlash('p1');
            setTimeout(() => setScoreFlash(null), 800);
          } else if (newRow.player2_score !== oldRow.player2_score) {
            setScoreFlash('p2');
            setTimeout(() => setScoreFlash(null), 800);
          }
          queryClient.invalidateQueries({ queryKey: ['live-match', id] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, queryClient]);

  // Presence: viewer count
  useEffect(() => {
    if (!id) return;
    const channel = supabase.channel(`match-viewers-${id}`, {
      config: { presence: { key: user?.id ?? `guest-${Math.random().toString(36).slice(2)}` } },
    });
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setViewers(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ username: profile?.username ?? 'Guest', at: Date.now() });
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, user?.id, profile?.username]);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Watch live on GameFlex', url });
      } else {
        await navigator.clipboard.writeText(url);
        toast({ title: 'Link copied!', description: 'Share it with friends to watch together.' });
      }
    } catch {
      /* user cancelled */
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold mb-2">Match not found</h1>
        <Button asChild className="mt-4"><Link to="/live">Back to Live</Link></Button>
      </div>
    );
  }

  const isLive = match.status === 'live';
  const isCompleted = match.status === 'completed';

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/live"><ArrowLeft className="h-4 w-4 mr-1" /> Live</Link>
        </Button>
        <div className="flex items-center gap-2">
          {isLive && (
            <Badge variant="destructive" className="gap-1.5">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> LIVE
            </Badge>
          )}
          <Badge variant="outline" className="gap-1.5">
            <Eye className="h-3.5 w-3.5" /> {viewers}
          </Badge>
          <Button variant="ghost" size="icon" onClick={share}>
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tournament info */}
      <Link
        to={`/tournaments/${match.tournament_id}`}
        className="block mb-6 p-4 rounded-xl bg-card border border-border/50 hover:border-primary/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <div className="flex-1 min-w-0">
            <p className="font-display font-bold truncate">{match.tournaments?.title}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {match.tournaments?.game} • Round {match.round} • Match {match.match_number}
            </p>
          </div>
          {match.tournaments?.prize_pool ? (
            <Badge variant="secondary">
              KES {Number(match.tournaments.prize_pool).toLocaleString()}
            </Badge>
          ) : null}
        </div>
      </Link>

      {/* Scoreboard */}
      <div className="rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-500/5 via-card to-card p-6 md:p-10 mb-6">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 md:gap-8">
          {/* Player 1 */}
          <div className="text-center">
            <Avatar className="h-16 w-16 md:h-24 md:w-24 mx-auto mb-3 border-2 border-primary/30">
              <AvatarImage src={p1?.avatar_url ?? undefined} />
              <AvatarFallback className="text-xl">{p1?.username?.charAt(0).toUpperCase() ?? '?'}</AvatarFallback>
            </Avatar>
            <p className="font-display font-bold truncate">{p1?.username ?? 'TBD'}</p>
            {p1?.game_handle && (
              <p className="text-xs text-muted-foreground truncate">{p1.game_handle}</p>
            )}
            <div
              className={`mt-4 font-display text-5xl md:text-7xl font-bold transition-all ${
                scoreFlash === 'p1' ? 'text-primary scale-110' : ''
              } ${isCompleted && match.winner_id === match.player1_id ? 'text-yellow-500' : ''}`}
            >
              {match.player1_score ?? 0}
            </div>
          </div>

          <div className="flex flex-col items-center">
            <Swords className="h-6 w-6 md:h-8 md:w-8 text-muted-foreground" />
            <span className="text-xs text-muted-foreground mt-1">VS</span>
          </div>

          {/* Player 2 */}
          <div className="text-center">
            <Avatar className="h-16 w-16 md:h-24 md:w-24 mx-auto mb-3 border-2 border-primary/30">
              <AvatarImage src={p2?.avatar_url ?? undefined} />
              <AvatarFallback className="text-xl">{p2?.username?.charAt(0).toUpperCase() ?? '?'}</AvatarFallback>
            </Avatar>
            <p className="font-display font-bold truncate">{p2?.username ?? 'TBD'}</p>
            {p2?.game_handle && (
              <p className="text-xs text-muted-foreground truncate">{p2.game_handle}</p>
            )}
            <div
              className={`mt-4 font-display text-5xl md:text-7xl font-bold transition-all ${
                scoreFlash === 'p2' ? 'text-primary scale-110' : ''
              } ${isCompleted && match.winner_id === match.player2_id ? 'text-yellow-500' : ''}`}
            >
              {match.player2_score ?? 0}
            </div>
          </div>
        </div>

        {isCompleted && match.winner_id && (
          <div className="mt-6 text-center">
            <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 gap-1.5">
              <Trophy className="h-3.5 w-3.5" />
              Winner: {match.winner_id === match.player1_id ? p1?.username : p2?.username}
            </Badge>
          </div>
        )}

        {isLive && (
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Radio className="h-4 w-4 text-red-500 animate-pulse" />
            <span>Scores update in real-time</span>
          </div>
        )}
      </div>
    </div>
  );
}
