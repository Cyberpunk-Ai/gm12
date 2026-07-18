import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { formatDistanceToNow } from 'date-fns';
import { Heart, Eye, Trash2, Image as ImageIcon, Share2, Lock } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';
import { StatusComments } from '@/components/social/status-comments';
import { useToast } from '@/hooks/use-toast';
import { FollowButton } from '@/components/social/follow-button';

export function StatusFeed() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: statuses = [], isLoading } = useQuery({
    queryKey: ['user-statuses'],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_statuses')
        .select('*')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });
      
      if (!data) return [];
      
      const userIds = [...new Set(data.map(s => s.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url')
        .in('user_id', userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) ?? []);
      
      // Get user's likes
      let userLikes: string[] = [];
      if (user) {
        const { data: likes } = await supabase
          .from('status_likes')
          .select('status_id')
          .eq('user_id', user.id);
        userLikes = likes?.map(l => l.status_id) ?? [];
      }
      
      return data.map(s => ({
        ...s,
        profile: profileMap.get(s.user_id),
        isLiked: userLikes.includes(s.id)
      }));
    }
  });

  // Subscribe to real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('statuses-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_statuses' },
        () => queryClient.invalidateQueries({ queryKey: ['user-statuses'] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const likeMutation = useMutation({
    mutationFn: async ({ statusId, isLiked }: { statusId: string; isLiked: boolean }) => {
      if (!user) throw new Error('Not authenticated');
      
      if (isLiked) {
        await supabase
          .from('status_likes')
          .delete()
          .eq('status_id', statusId)
          .eq('user_id', user.id);
        
        await supabase
          .from('user_statuses')
          .update({ likes_count: Math.max(0, (statuses.find(s => s.id === statusId)?.likes_count ?? 1) - 1) })
          .eq('id', statusId);
      } else {
        await supabase
          .from('status_likes')
          .insert({ status_id: statusId, user_id: user.id });
        
        await supabase
          .from('user_statuses')
          .update({ likes_count: (statuses.find(s => s.id === statusId)?.likes_count ?? 0) + 1 })
          .eq('id', statusId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-statuses'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (statusId: string) => {
      const { error } = await supabase
        .from('user_statuses')
        .delete()
        .eq('id', statusId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-statuses'] });
    }
  });

  // Increment view count on view
  const incrementView = async (statusId: string) => {
    const currentViews = statuses.find(s => s.id === statusId)?.views_count ?? 0;
    await supabase
      .from('user_statuses')
      .update({ views_count: currentViews + 1 })
      .eq('id', statusId);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-muted" />
                <div className="h-4 bg-muted rounded w-24" />
              </div>
              <div className="h-20 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (statuses.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No status updates yet</p>
        <p className="text-sm">Be the first to share what's on your mind!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {statuses.map(status => (
        <Card 
          key={status.id} 
          className="overflow-hidden"
          onMouseEnter={() => incrementView(status.id)}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <Link to={`/player/${status.user_id}`}>
                  <Avatar className="h-10 w-10 transition-transform hover:scale-105">
                    <AvatarImage src={status.profile?.avatar_url} />
                    <AvatarFallback>
                      {status.profile?.username?.charAt(0).toUpperCase() ?? '?'}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                <div>
                  <div className="flex items-center gap-2">
                    <Link to={`/player/${status.user_id}`} className="font-medium hover:text-primary transition-colors">
                      {status.profile?.username ?? 'Unknown'}
                    </Link>
                    {user && user.id !== status.user_id && (
                      <FollowButton 
                        userId={status.user_id} 
                        username={status.profile?.username}
                        size="sm"
                        variant="ghost"
                        showText={false}
                        className="h-7 w-7 p-0"
                      />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(status.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
              {user?.id === status.user_id && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteMutation.mutate(status.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            {status.content && (
              <p className="text-sm mb-3 whitespace-pre-wrap">{status.content}</p>
            )}

            {status.media_url && (
              <div className="rounded-lg overflow-hidden mb-3">
                {status.media_type === 'video' ? (
                  <video
                    src={status.media_url}
                    controls
                    className="w-full max-h-96 object-cover"
                  />
                ) : (
                  <img
                    src={status.media_url}
                    alt="Status media"
                    className="w-full max-h-96 object-cover"
                  />
                )}
              </div>
            )}

            <div className="flex items-center gap-4 pt-2 border-t border-border/50">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => user && likeMutation.mutate({ statusId: status.id, isLiked: status.isLiked })}
                disabled={!user || likeMutation.isPending}
                className={cn(status.isLiked && "text-destructive")}
              >
                <Heart className={cn("h-4 w-4 mr-1", status.isLiked && "fill-current")} />
                {status.likes_count}
              </Button>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Eye className="h-4 w-4" />
                {status.views_count}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/social?status=${status.id}`);
                  toast({ title: 'Link copied!', description: 'Share this status with others' });
                }}
              >
                <Share2 className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                <Lock className="h-3 w-3" />
                <span>Encrypted</span>
                <span className="mx-1">•</span>
                <span>Expires {formatDistanceToNow(new Date(status.expires_at), { addSuffix: true })}</span>
              </div>
            </div>
            
            {/* Comments Section */}
            <StatusComments statusId={status.id} commentsCount={status.comments_count ?? 0} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
