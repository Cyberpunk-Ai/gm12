import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { UserPlus, UserMinus, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface FollowButtonProps {
  userId: string;
  username?: string;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'outline' | 'ghost';
  className?: string;
  showText?: boolean;
}

export function FollowButton({ 
  userId, 
  username, 
  size = 'default', 
  variant = 'default',
  className,
  showText = true 
}: FollowButtonProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check if already following
  const { data: isFollowing = false, isLoading: checkingFollow } = useQuery({
    queryKey: ['is-following', user?.id, userId],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from('user_follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', userId)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user && user.id !== userId
  });

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      
      if (isFollowing) {
        const { error } = await supabase
          .from('user_follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_follows')
          .insert({ follower_id: user.id, following_id: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['is-following', user?.id, userId] });
      queryClient.invalidateQueries({ queryKey: ['player-profile', userId] });
      queryClient.invalidateQueries({ queryKey: ['user-statuses'] });
      toast({
        title: isFollowing ? 'Unfollowed' : 'Following!',
        description: isFollowing 
          ? `You unfollowed ${username || 'this user'}` 
          : `You're now following ${username || 'this user'}`
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update follow status',
        variant: 'destructive'
      });
    }
  });

  // Don't show button for own profile or when not logged in
  if (!user || user.id === userId) {
    return null;
  }

  return (
    <Button
      size={size}
      variant={isFollowing ? 'outline' : variant}
      className={cn(className)}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        followMutation.mutate();
      }}
      disabled={followMutation.isPending || checkingFollow}
    >
      {followMutation.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isFollowing ? (
        <>
          <UserMinus className="h-4 w-4" />
          {showText && <span className="ml-2">Unfollow</span>}
        </>
      ) : (
        <>
          <UserPlus className="h-4 w-4" />
          {showText && <span className="ml-2">Follow</span>}
        </>
      )}
    </Button>
  );
}
