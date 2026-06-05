import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { Send, Trash2, Lock, MessageCircle } from 'lucide-react';
import { encryptMessage, decryptMessage } from '@/lib/encryption';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface StatusCommentsProps {
  statusId: string;
  commentsCount: number;
}

interface Comment {
  id: string;
  status_id: string;
  user_id: string;
  content: string;
  is_encrypted: boolean;
  created_at: string;
  profile?: {
    username: string;
    avatar_url: string;
  };
  decryptedContent?: string;
}

export function StatusComments({ statusId, commentsCount }: StatusCommentsProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [newComment, setNewComment] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [decryptedComments, setDecryptedComments] = useState<Map<string, string>>(new Map());

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['status-comments', statusId],
    queryFn: async () => {
      const { data } = await supabase
        .from('status_comments')
        .select('*')
        .eq('status_id', statusId)
        .order('created_at', { ascending: true });

      if (!data) return [];

      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) ?? []);

      return data.map(c => ({
        ...c,
        profile: profileMap.get(c.user_id)
      })) as Comment[];
    },
    enabled: isExpanded
  });

  // Decrypt comments
  useEffect(() => {
    async function decryptComments() {
      const decrypted = new Map<string, string>();
      for (const comment of comments) {
        if (comment.is_encrypted) {
          try {
            decrypted.set(comment.id, await decryptMessage(comment.content));
          } catch {
            decrypted.set(comment.id, comment.content);
          }
        } else {
          decrypted.set(comment.id, comment.content);
        }
      }
      setDecryptedComments(decrypted);
    }
    if (comments.length > 0) {
      decryptComments();
    }
  }, [comments]);

  // Real-time subscription
  useEffect(() => {
    if (!isExpanded) return;

    const channel = supabase
      .channel(`comments-${statusId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'status_comments',
          filter: `status_id=eq.${statusId}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['status-comments', statusId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [statusId, isExpanded, queryClient]);

  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!user) throw new Error('Not authenticated');

      const encryptedContent = await encryptMessage(content);

      const { error } = await supabase.from('status_comments').insert({
        status_id: statusId,
        user_id: user.id,
        content: encryptedContent,
        is_encrypted: true
      });

      if (error) throw error;

      // Update comments count
      await supabase
        .from('user_statuses')
        .update({ comments_count: commentsCount + 1 })
        .eq('id', statusId);
    },
    onSuccess: () => {
      setNewComment('');
      queryClient.invalidateQueries({ queryKey: ['status-comments', statusId] });
      queryClient.invalidateQueries({ queryKey: ['user-statuses'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase
        .from('status_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      // Update comments count
      await supabase
        .from('user_statuses')
        .update({ comments_count: Math.max(0, commentsCount - 1) })
        .eq('id', statusId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['status-comments', statusId] });
      queryClient.invalidateQueries({ queryKey: ['user-statuses'] });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim()) {
      addCommentMutation.mutate(newComment.trim());
    }
  };

  return (
    <div className="border-t border-border/50 pt-3 mt-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full justify-start text-muted-foreground"
      >
        <MessageCircle className="h-4 w-4 mr-2" />
        {commentsCount} Comments
        <Lock className="h-3 w-3 ml-2 opacity-50" />
      </Button>

      {isExpanded && (
        <div className="mt-3 space-y-3">
          {isLoading ? (
            <div className="text-center py-4 text-sm text-muted-foreground">Loading comments...</div>
          ) : comments.length === 0 ? (
            <div className="text-center py-4 text-sm text-muted-foreground">No comments yet. Be the first!</div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {comments.map((comment) => (
                <div key={comment.id} className="flex items-start gap-2 p-2 rounded-lg bg-secondary/30">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={comment.profile?.avatar_url} />
                    <AvatarFallback className="text-xs">
                      {comment.profile?.username?.charAt(0).toUpperCase() ?? '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{comment.profile?.username ?? 'Unknown'}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                      </span>
                      {comment.is_encrypted && <Lock className="h-2.5 w-2.5 text-muted-foreground" />}
                    </div>
                    <p className="text-sm break-words">
                      {decryptedComments.get(comment.id) ?? '...'}
                    </p>
                  </div>
                  {user?.id === comment.user_id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteCommentMutation.mutate(comment.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {user && (
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="flex-1 h-8 text-sm"
              />
              <Button
                type="submit"
                size="icon"
                className="h-8 w-8"
                disabled={!newComment.trim() || addCommentMutation.isPending}
              >
                <Send className="h-3 w-3" />
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
