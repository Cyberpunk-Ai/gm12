import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { PostCard, type PostRow } from './post-card';
import { Loader2 } from 'lucide-react';

interface Props {
  scope?: 'home' | 'following' | 'trending' | 'user';
  userId?: string;
}

export function Feed({ scope = 'home', userId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['feed-posts', scope, userId, user?.id],
    queryFn: async () => {
      let q = supabase.from('posts').select('*').eq('is_archived', false);
      if (scope === 'user' && userId) q = q.eq('user_id', userId);
      if (scope === 'following' && user) {
        const { data: follows } = await supabase.from('user_follows').select('following_id').eq('follower_id', user.id);
        const ids = (follows ?? []).map((f: any) => f.following_id);
        if (ids.length === 0) return [] as PostRow[];
        q = q.in('user_id', ids);
      }
      if (scope === 'trending') q = q.order('likes_count', { ascending: false });
      else q = q.order('created_at', { ascending: false });
      q = q.limit(50);
      const { data } = await q;
      if (!data || data.length === 0) return [] as PostRow[];

      const postIds = data.map((p: any) => p.id);
      const userIds = [...new Set(data.map((p: any) => p.user_id))];
      const [{ data: media }, { data: profiles }, likesRes, savesRes, repostsRes] = await Promise.all([
        supabase.from('post_media').select('*').in('post_id', postIds).order('position'),
        supabase.from('profiles').select('user_id, username, avatar_url').in('user_id', userIds),
        user ? supabase.from('post_likes').select('post_id').eq('user_id', user.id).in('post_id', postIds) : Promise.resolve({ data: [] as any[] }),
        user ? supabase.from('saved_posts').select('post_id').eq('user_id', user.id).in('post_id', postIds) : Promise.resolve({ data: [] as any[] }),
        user ? supabase.from('post_reposts').select('post_id').eq('user_id', user.id).in('post_id', postIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      const pMap = new Map(profiles?.map((p: any) => [p.user_id, p]) ?? []);
      const mMap = new Map<string, any[]>();
      (media ?? []).forEach((m: any) => {
        const arr = mMap.get(m.post_id) ?? []; arr.push(m); mMap.set(m.post_id, arr);
      });
      const liked = new Set((likesRes.data ?? []).map((r: any) => r.post_id));
      const saved = new Set((savesRes.data ?? []).map((r: any) => r.post_id));
      const reposted = new Set((repostsRes.data ?? []).map((r: any) => r.post_id));

      return data.map((p: any) => ({
        ...p, profile: pMap.get(p.user_id) ?? null,
        media: mMap.get(p.id) ?? [],
        liked: liked.has(p.id), saved: saved.has(p.id), reposted: reposted.has(p.id),
      })) as PostRow[];
    },
  });

  useEffect(() => {
    const ch = supabase.channel('feed-posts-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => qc.invalidateQueries({ queryKey: ['feed-posts'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_likes' }, () => qc.invalidateQueries({ queryKey: ['feed-posts'] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (posts.length === 0) return <div className="text-center py-16 text-muted-foreground">No posts yet.</div>;

  return <div className="max-w-[500px] mx-auto">{posts.map((p) => <PostCard key={p.id} post={p} />)}</div>;
}
