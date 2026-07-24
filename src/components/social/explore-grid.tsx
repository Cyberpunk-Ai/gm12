import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Play, Images } from 'lucide-react';
import { MediaImage, MediaVideo } from './media-image';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { PostCard, type PostRow } from './post-card';
import { cn } from '@/lib/utils';

export function ExploreGrid({ query }: { query?: string }) {
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['explore', query],
    queryFn: async () => {
      let q = supabase.from('posts').select('*').eq('is_archived', false).order('likes_count', { ascending: false }).limit(60);
      if (query) q = q.ilike('caption', `%${query}%`);
      const { data } = await q;
      if (!data || data.length === 0) return [] as PostRow[];
      const ids = data.map((p: any) => p.id);
      const userIds = [...new Set(data.map((p: any) => p.user_id))];
      const [{ data: media }, { data: profiles }] = await Promise.all([
        supabase.from('post_media').select('*').in('post_id', ids).order('position'),
        supabase.from('profiles').select('user_id, username, avatar_url').in('user_id', userIds),
      ]);
      const mMap = new Map<string, any[]>();
      (media ?? []).forEach((m: any) => { const a = mMap.get(m.post_id) ?? []; a.push(m); mMap.set(m.post_id, a); });
      const pMap = new Map(profiles?.map((p: any) => [p.user_id, p]) ?? []);
      return data.map((p: any) => ({ ...p, media: mMap.get(p.id) ?? [], profile: pMap.get(p.user_id) })) as PostRow[];
    },
  });

  const [selected, setSelected] = useState<PostRow | null>(null);

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (posts.length === 0) return <div className="text-center py-16 text-muted-foreground">Nothing to explore yet.</div>;

  return (
    <>
      <div className="grid grid-cols-3 gap-1 md:gap-2">
        {posts.map((p, i) => {
          const first = p.media?.[0];
          if (!first) return null;
          const isVideo = first.media_type === 'video';
          const tall = i % 7 === 0;
          return (
            <button
              key={p.id}
              onClick={() => setSelected(p)}
              className={cn('relative aspect-square overflow-hidden bg-muted group', tall && 'row-span-2 aspect-[1/2]')}
            >
              <HoverMedia bucket="posts" path={first.media_path} isVideo={isVideo} />
              <div className="absolute top-1.5 right-1.5 text-white drop-shadow flex items-center gap-1">
                {isVideo && <Play className="h-4 w-4 fill-white" />}
                {p.media.length > 1 && <Images className="h-4 w-4" />}
              </div>
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-4 text-white text-sm font-semibold">
                <span>❤ {p.likes_count}</span>
                <span>💬 {p.comments_count}</span>
              </div>
            </button>
          );
        })}
      </div>
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-[500px] p-0 bg-transparent border-0 shadow-none">
          {selected && <PostCard post={selected} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function HoverMedia({ bucket, path, isVideo }: { bucket: string; path: string; isVideo: boolean }) {
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className="absolute inset-0"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {isVideo && hovered ? (
        <MediaVideo bucket={bucket} path={path} className="w-full h-full object-cover" autoPlay muted loop playsInline />
      ) : (
        <MediaImage bucket={bucket} path={path} className="w-full h-full object-cover" />
      )}
    </div>
  );
}
