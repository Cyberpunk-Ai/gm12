import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Heart, Send, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { EmojiPicker } from './emoji-picker';

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  likes_count: number;
  created_at: string;
  profile?: { username: string; avatar_url: string | null };
  liked?: boolean;
  replies?: Comment[];
}

export function PostCommentsSheet({ postId }: { postId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);

  const { data: comments = [] } = useQuery({
    queryKey: ['post-comments', postId],
    queryFn: async () => {
      const { data } = await supabase
        .from('post_comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      if (!data) return [] as Comment[];
      const ids = [...new Set(data.map((c: any) => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles').select('user_id, username, avatar_url').in('user_id', ids);
      const pMap = new Map(profiles?.map((p: any) => [p.user_id, p]) ?? []);
      let liked = new Set<string>();
      if (user) {
        const { data: myLikes } = await supabase.from('comment_likes').select('comment_id').eq('user_id', user.id);
        liked = new Set((myLikes ?? []).map((l: any) => l.comment_id));
      }
      const enriched: Comment[] = data.map((c: any) => ({ ...c, profile: pMap.get(c.user_id), liked: liked.has(c.id) }));
      // Nest replies
      const roots = enriched.filter((c) => !c.parent_id);
      const replies = enriched.filter((c) => c.parent_id);
      for (const r of roots) r.replies = replies.filter((x) => x.parent_id === r.id);
      return roots;
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`post-comments-${postId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_comments', filter: `post_id=eq.${postId}` },
        () => qc.invalidateQueries({ queryKey: ['post-comments', postId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [postId, qc]);

  const addComment = useMutation({
    mutationFn: async () => {
      if (!user || !text.trim()) return;
      const { error } = await supabase.from('post_comments').insert({
        post_id: postId, user_id: user.id, content: text.trim(),
        parent_id: replyTo?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { setText(''); setReplyTo(null); qc.invalidateQueries({ queryKey: ['post-comments', postId] }); },
  });

  const toggleLike = useMutation({
    mutationFn: async (c: Comment) => {
      if (!user) return;
      if (c.liked) await supabase.from('comment_likes').delete().eq('comment_id', c.id).eq('user_id', user.id);
      else await supabase.from('comment_likes').insert({ comment_id: c.id, user_id: user.id });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['post-comments', postId] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from('post_comments').delete().eq('id', id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['post-comments', postId] }),
  });

  const renderComment = (c: Comment, depth = 0) => (
    <div key={c.id} className={cn('flex gap-3', depth > 0 && 'ml-10 mt-2')}>
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarImage src={c.profile?.avatar_url ?? undefined} />
        <AvatarFallback>{c.profile?.username?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="text-sm">
          <span className="font-semibold mr-2">{c.profile?.username ?? 'user'}</span>
          <span className="break-words">{c.content}</span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span>{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
          {c.likes_count > 0 && <span>{c.likes_count} likes</span>}
          {user && depth === 0 && (
            <button className="font-semibold" onClick={() => setReplyTo(c)}>Reply</button>
          )}
          {user?.id === c.user_id && (
            <button onClick={() => del.mutate(c.id)}><Trash2 className="h-3 w-3" /></button>
          )}
        </div>
        {c.replies?.map((r) => renderComment(r, depth + 1))}
      </div>
      <button
        onClick={() => user && toggleLike.mutate(c)}
        className="mt-1 text-muted-foreground"
        aria-label="Like comment"
      >
        <Heart className={cn('h-3.5 w-3.5', c.liked && 'fill-destructive text-destructive')} />
      </button>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        {comments.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-10">No comments yet. Start the conversation.</div>
        ) : comments.map((c) => renderComment(c))}
      </div>
      {user && (
        <div className="border-t border-border p-3">
          {replyTo && (
            <div className="text-xs text-muted-foreground mb-2 flex items-center justify-between">
              <span>Replying to <b>@{replyTo.profile?.username}</b></span>
              <button onClick={() => setReplyTo(null)}>Cancel</button>
            </div>
          )}
          <form
            onSubmit={(e) => { e.preventDefault(); addComment.mutate(); }}
            className="flex items-center gap-1"
          >
            <EmojiPicker onPick={(e) => setText((t) => t + e)} />
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 border-0 focus-visible:ring-0 h-9"
            />
            <Button type="submit" size="sm" variant="ghost" className="text-primary font-semibold" disabled={!text.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
