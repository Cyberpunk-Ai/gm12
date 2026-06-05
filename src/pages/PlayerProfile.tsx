import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Trophy, Gamepad2, Users, TrendingUp, Star, 
  UserPlus, UserMinus, MessageCircle, ArrowLeft,
  Medal, Target, Flame
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function PlayerProfile() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch player profile
  const { data: player, isLoading } = useQuery({
    queryKey: ['player-profile', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', id)
        .single();
      return data;
    },
    enabled: !!id
  });

  // Fetch player stats
  const { data: stats } = useQuery({
    queryKey: ['player-stats', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('leaderboard_stats')
        .select('*')
        .eq('user_id', id)
        .single();
      return data;
    },
    enabled: !!id
  });

  // Fetch player achievements
  const { data: achievements = [] } = useQuery({
    queryKey: ['player-achievements', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_achievements')
        .select('*, achievements(*)')
        .eq('user_id', id);
      return data ?? [];
    },
    enabled: !!id
  });

  // Check if following
  const { data: isFollowing = false } = useQuery({
    queryKey: ['is-following', user?.id, id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from('user_follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user && !!id && user.id !== id
  });

  // Follow mutation
  const followMutation = useMutation({
    mutationFn: async () => {
      if (!user || !id) throw new Error('Not authenticated');
      
      if (isFollowing) {
        await supabase
          .from('user_follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', id);
      } else {
        await supabase
          .from('user_follows')
          .insert({ follower_id: user.id, following_id: id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['is-following', user?.id, id] });
      queryClient.invalidateQueries({ queryKey: ['player-profile', id] });
      toast({
        title: isFollowing ? 'Unfollowed' : 'Following!',
        description: isFollowing ? `You unfollowed ${player?.username}` : `You're now following ${player?.username}`
      });
    }
  });

  // Fetch recent matches
  const { data: recentMatches = [] } = useQuery({
    queryKey: ['player-matches', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('matches')
        .select('*, tournaments(title, game)')
        .or(`player1_id.eq.${id},player2_id.eq.${id}`)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(5);
      return data ?? [];
    },
    enabled: !!id
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-48 bg-muted rounded-2xl" />
          <div className="grid md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-muted rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold mb-4">Player not found</h1>
        <Button asChild>
          <Link to="/leaderboard">Back to Leaderboard</Link>
        </Button>
      </div>
    );
  }

  const winRate = stats?.wins && stats?.losses 
    ? Math.round((stats.wins / (stats.wins + stats.losses)) * 100) 
    : 0;

  const isOwnProfile = user?.id === id;

  return (
    <div className="container mx-auto px-4 py-8">
      <Button variant="ghost" asChild className="mb-6">
        <Link to="/leaderboard">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Leaderboard
        </Link>
      </Button>

      {/* Profile Header */}
      <Card className="mb-8 overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-primary/30 via-accent/20 to-primary/30" />
        <CardContent className="relative pb-6">
          <div className="flex flex-col md:flex-row items-start md:items-end gap-6 -mt-16">
            <Avatar className="h-32 w-32 border-4 border-background">
              <AvatarImage src={player.avatar_url ?? undefined} />
              <AvatarFallback className="text-4xl bg-primary/20">
                {player.username?.charAt(0).toUpperCase() ?? 'U'}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="font-display text-3xl font-bold">{player.username}</h1>
                {player.is_verified && (
                  <Badge className="bg-green-500/20 text-green-400">Verified</Badge>
                )}
              </div>
              <p className="text-muted-foreground mb-3">{player.bio || 'No bio yet'}</p>
              <div className="flex flex-wrap gap-3">
                {player.game_handle && (
                  <Badge variant="secondary" className="gap-1">
                    <Gamepad2 className="h-3 w-3" />
                    {player.game_handle}
                  </Badge>
                )}
                <Badge variant="secondary" className="gap-1">
                  <Users className="h-3 w-3" />
                  {(player as any).followers_count ?? 0} followers
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <Users className="h-3 w-3" />
                  {(player as any).following_count ?? 0} following
                </Badge>
              </div>
            </div>

            {!isOwnProfile && user && (
              <div className="flex gap-2">
                <Button
                  onClick={() => followMutation.mutate()}
                  disabled={followMutation.isPending}
                  variant={isFollowing ? 'outline' : 'default'}
                >
                  {isFollowing ? (
                    <>
                      <UserMinus className="h-4 w-4 mr-2" />
                      Unfollow
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Follow
                    </>
                  )}
                </Button>
                <Button variant="outline" asChild>
                  <Link to={`/messages?user=${id}`}>
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Message
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-gradient-to-br from-yellow-500/20 to-yellow-500/5 border-yellow-500/30">
          <CardContent className="p-6">
            <Trophy className="h-8 w-8 text-yellow-500 mb-2" />
            <div className="font-display text-2xl font-bold">{stats?.wins ?? 0}</div>
            <div className="text-sm text-muted-foreground">Wins</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-primary/20 to-primary/5 border-primary/30">
          <CardContent className="p-6">
            <Target className="h-8 w-8 text-primary mb-2" />
            <div className="font-display text-2xl font-bold">{winRate}%</div>
            <div className="text-sm text-muted-foreground">Win Rate</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-accent/20 to-accent/5 border-accent/30">
          <CardContent className="p-6">
            <Flame className="h-8 w-8 text-accent mb-2" />
            <div className="font-display text-2xl font-bold">{stats?.points ?? 0}</div>
            <div className="text-sm text-muted-foreground">Points</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/20 to-green-500/5 border-green-500/30">
          <CardContent className="p-6">
            <TrendingUp className="h-8 w-8 text-green-500 mb-2" />
            <div className="font-display text-2xl font-bold">KES {((stats?.earnings ?? 0) as number).toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">Earnings</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="achievements" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="achievements" className="gap-2">
            <Medal className="h-4 w-4" />
            Achievements ({achievements.length})
          </TabsTrigger>
          <TabsTrigger value="matches" className="gap-2">
            <Gamepad2 className="h-4 w-4" />
            Recent Matches
          </TabsTrigger>
        </TabsList>

        <TabsContent value="achievements">
          {achievements.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {achievements.map((ua: any) => (
                <Card key={ua.id} className="bg-gradient-to-br from-yellow-500/10 to-transparent border-yellow-500/20">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-yellow-500/20 flex items-center justify-center text-2xl">
                      {ua.achievements?.icon === 'trophy' ? '🏆' : 
                       ua.achievements?.icon === 'star' ? '⭐' : 
                       ua.achievements?.icon === 'medal' ? '🥇' : '🎖️'}
                    </div>
                    <div>
                      <h4 className="font-semibold">{ua.achievements?.name}</h4>
                      <p className="text-sm text-muted-foreground">{ua.achievements?.description}</p>
                      <Badge variant="secondary" className="mt-1 text-xs">+{ua.achievements?.points} pts</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Star className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No achievements earned yet</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="matches">
          {recentMatches.length > 0 ? (
            <div className="space-y-3">
              {recentMatches.map((match: any) => (
                <Card key={match.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{match.tournaments?.title}</p>
                      <p className="text-sm text-muted-foreground capitalize">{match.tournaments?.game} • Round {match.round}</p>
                    </div>
                    <Badge variant={match.winner_id === id ? 'default' : 'secondary'}>
                      {match.winner_id === id ? 'Won' : 'Lost'}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Gamepad2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No matches played yet</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
