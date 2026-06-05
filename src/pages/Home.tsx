import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Users, Zap, Shield, ArrowRight, Star, Gamepad2, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TournamentCard } from '@/components/tournament-card';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const features = [
  { icon: Trophy, title: 'Win Big Prizes', description: 'Compete for cash prizes up to KES 100,000+' },
  { icon: Shield, title: 'Secure Payments', description: 'Fast M-Pesa payments with instant verification' },
  { icon: Users, title: 'Active Community', description: 'Join 1500+ gamers competing daily' },
  { icon: Zap, title: 'Live Tournaments', description: 'Real-time brackets and live match updates' },
];

const games = [
  { name: 'FIFA 24', icon: '⚽', players: 450 },
  { name: 'Call of Duty', icon: '🎯', players: 380 },
  { name: 'PUBG Mobile', icon: '🔫', players: 320 },
  { name: 'Fortnite', icon: '🏗️', players: 280 },
  { name: 'Apex Legends', icon: '🦊', players: 210 },
  { name: 'Valorant', icon: '🎮', players: 190 },
];

export default function Home() {
  const queryClient = useQueryClient();
  
  const { data: tournaments = [] } = useQuery({
    queryKey: ['home-tournaments'],
    queryFn: async () => {
      const { data } = await supabase
        .from('tournaments')
        .select('*')
        .in('status', ['live', 'registration_open', 'upcoming'])
        .order('start_date', { ascending: true })
        .limit(6);
      return data ?? [];
    }
  });

  // Real-time subscription for tournament updates
  useEffect(() => {
    const channel = supabase
      .channel('home-tournaments-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tournaments' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['home-tournaments'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const { data: leaderboard = [] } = useQuery({
    queryKey: ['home-leaderboard'],
    queryFn: async () => {
      const { data: statsData } = await supabase
        .from('leaderboard_stats')
        .select('*')
        .order('points', { ascending: false })
        .limit(5);
      
      if (!statsData || statsData.length === 0) return [];
      
      const userIds = [...new Set(statsData.map(s => s.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url, game_handle')
        .in('user_id', userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) ?? []);
      
      return statsData.map(s => ({
        ...s,
        profiles: profileMap.get(s.user_id)
      }));
    }
  });

  const liveTournaments = tournaments.filter((t: any) => t.status === 'live');
  const upcomingTournaments = tournaments.filter((t: any) => t.status === 'registration_open' || t.status === 'upcoming').slice(0, 3);
  const topPlayers = leaderboard.slice(0, 5);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-hero-pattern opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            {liveTournaments.length > 0 && (
              <Badge variant="live" className="mb-6 text-sm px-4 py-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse mr-2" />
                {liveTournaments.length} Tournament{liveTournaments.length > 1 ? 's' : ''} Live Now
              </Badge>
            )}
            
            <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
              Compete. Win. <span className="text-gradient">Earn.</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Kenya's premier gaming tournament platform. Join thousands of gamers competing for real cash prizes with M-Pesa payments.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="xl" variant="gaming" asChild>
                <Link to="/tournaments">
                  Browse Tournaments
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="xl" variant="outline" asChild>
                <Link to="/register">Create Account</Link>
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 mt-16 max-w-lg mx-auto">
              <div>
                <div className="font-display text-3xl font-bold text-primary">1.5K+</div>
                <div className="text-sm text-muted-foreground">Players</div>
              </div>
              <div>
                <div className="font-display text-3xl font-bold text-primary">KES 2.4M</div>
                <div className="text-sm text-muted-foreground">Paid Out</div>
              </div>
              <div>
                <div className="font-display text-3xl font-bold text-primary">48</div>
                <div className="text-sm text-muted-foreground">Tournaments</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Games */}
      <section className="py-16 border-t border-border/50">
        <div className="container mx-auto px-4">
          <h2 className="font-display text-2xl font-bold text-center mb-8">Popular Games</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {games.map((game) => (
              <Link
                key={game.name}
                to={`/tournaments?game=${game.name.toLowerCase().replace(' ', '')}`}
                className="p-4 rounded-xl bg-card border border-border/50 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition-all text-center group"
              >
                <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">{game.icon}</div>
                <div className="font-semibold text-sm">{game.name}</div>
                <div className="text-xs text-muted-foreground">{game.players} players</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Tournaments */}
      <section className="py-16 bg-gradient-to-b from-background to-card/50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <h2 className="font-display text-2xl font-bold">Featured Tournaments</h2>
            <Button variant="ghost" asChild>
              <Link to="/tournaments">View All <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcomingTournaments.map((tournament) => (
              <TournamentCard key={tournament.id} tournament={tournament} />
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="font-display text-2xl font-bold text-center mb-12">Why GameFlex?</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <div key={feature.title} className="p-6 rounded-xl bg-card border border-border/50 text-center">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-display font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Top Players */}
      <section className="py-16 bg-card/50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <h2 className="font-display text-2xl font-bold">Top Players</h2>
            <Button variant="ghost" asChild>
              <Link to="/leaderboard">Full Leaderboard <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
          <div className="grid gap-3">
            {topPlayers.map((player: any, index: number) => (
              <div key={player.id} className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border/50">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center font-display font-bold ${
                  index === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                  index === 1 ? 'bg-gray-400/20 text-gray-400' :
                  index === 2 ? 'bg-orange-500/20 text-orange-500' :
                  'bg-secondary text-muted-foreground'
                }`}>
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{player.profiles?.username ?? 'Unknown'}</div>
                  <div className="text-sm text-muted-foreground">{player.profiles?.game_handle ?? '-'}</div>
                </div>
                <div className="text-right">
                  <div className="font-display font-bold text-primary">{(player.points ?? 0).toLocaleString()} pts</div>
                  <div className="text-sm text-muted-foreground">{player.wins ?? 0}W - {player.losses ?? 0}L</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center p-12 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30">
            <h2 className="font-display text-3xl font-bold mb-4">Ready to Compete?</h2>
            <p className="text-muted-foreground mb-8">Join thousands of gamers and start winning today.</p>
            <Button size="xl" variant="gaming" asChild>
              <Link to="/register">Get Started Free</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
