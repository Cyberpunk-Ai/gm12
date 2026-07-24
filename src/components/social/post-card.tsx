import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Heart, MessageCircle, Send, Bookmark, Repeat2, ChevronLeft, ChevronRight, MoreHorizontal, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { MediaImage, MediaVideo } from './media-image';
import { PostCommentsSheet } from './post-comments-sheet';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export interface PostMedia { id: string; media_path: string; media_type: string; position: number; }
export interface PostRow {
  id: string; user_id: string; caption: string | null; location: string | null;
  likes_count: number; comments_count: number; reposts_count: number; created_at: string;
  profile?: { username: string; avatar_url: string | null } | null;
  media: PostMedia[];
  liked?: boolean; saved?: boolean; reposted?: boolean;
}

export function PostCard({ post }: { post: PostRow }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [idx, setIdx] = useState(0);
  const [openComments, setOpenComments] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  // Autoplay when in view
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const v = videoRefs.current[idx];
        if (!v) return;
        if (entry.isIntersecting && entry.intersectionRatio > 0.6) v.play().catch(() => {});
        else v.pause();
      });
    }, { threshold: [0, 0.6, 1] });
    io.observe(el);
    return () => io.disconnect();
  }, [idx]);

  const media = post.media ?? [];
  const current = media[idx];

  const like = useMutation({
    mutationFn: async () => {
      if (!user) return;
      if (post.liked) await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', user.id);
      else await supabase.from('post_likes').insert({ post_id: post.id, user_id: user.id });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feed-posts'] }),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!user) return;
      if (post.saved) await supabase.from('saved_posts').delete().eq('post_id', post.id).eq('user_id', user.id);
      else await supabase.from('saved_posts').insert({ post_id: post.id, user_id: user.id });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feed-posts'] }),
  });

  const repost = useMutation({
    mutationFn: async () => {
      if (!user) return;
      if (post.reposted) await supabase.from('post_reposts').delete().eq('post_id', post.id).eq('user_id', user.id);
      else await supabase.from('post_reposts').insert({ post_id: post.id, user_id: user.id });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['feed-posts'] }); toast({ title: post.reposted ? 'Removed repost' : 'Reposted' }); },
  });

  const del = useMutation({
    mutationFn: async () => { await supabase.from('posts').delete().eq('id', post.id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feed-posts'] }),
  });

  const share = () => {
    const url = `${window.location.origin}/social?post=${post.id}`;
    if (navigator.share) navigator.share({ url }).catch(() => {});
    else { navigator.clipboard.writeText(url); toast({ title: 'Link copied' }); }
  };

  const doubleTapLike = () => {
    if (!user) return;
    if (!post.liked) like.mutate();
    setShowHeart(true);
    setTimeout(() => setShowHeart(false), 800);
  };

  return (
    <article ref={containerRef} className="bg-card border border-border/60 rounded-xl overflow-hidden mb-6">
      {/* Header */}
      <div className="flex items-center justify-between p-3">
        <Link to={`/player/${post.user_id}`} className="flex items-center gap-3">
          <Avatar className="h-9 w-9 ring-2 ring-primary/30">
            <AvatarImage src={post.profile?.avatar_url ?? undefined} />
            <AvatarFallback>{post.profile?.username?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
          </Avatar>
          <div>
            <div className="text-sm font-semibold leading-none">{post.profile?.username ?? 'user'}</div>
            {post.location && <div className="text-xs text-muted-foreground mt-0.5">{post.location}</div>}
          </div>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-5 w-5" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={share}>Copy link</DropdownMenuItem>
            {user?.id === post.user_id && (
              <DropdownMenuItem className="text-destructive" onClick={() => del.mutate()}>
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Media carousel */}
      {current && (
        <div className="relative bg-black" onDoubleClick={doubleTapLike}>
          {current.media_type === 'video' ? (
            <MediaVideo
              bucket="posts"
              path={current.media_path}
              className="w-full max-h-[600px] object-contain aspect-square"
              autoPlay
              muted
              loop
              playsInline
            />
          ) : (
            <MediaImage bucket="posts" path={current.media_path} className="w-full max-h-[600px] object-contain aspect-square" />
          )}
          {showHeart && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Heart className="h-24 w-24 text-white drop-shadow-xl fill-white animate-ping" />
            </div>
          )}
          {media.length > 1 && (
            <>
              {idx > 0 && (
                <button onClick={() => setIdx((i) => i - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 rounded-full p-1">
                  <ChevronLeft className="h-5 w-5 text-white" />
                </button>
              )}
              {idx < media.length - 1 && (
                <button onClick={() => setIdx((i) => i + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 rounded-full p-1">
                  <ChevronRight className="h-5 w-5 text-white" />
                </button>
              )}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                {media.map((_, i) => (
                  <span key={i} className={cn('h-1.5 w-1.5 rounded-full', i === idx ? 'bg-white' : 'bg-white/50')} />
                ))}
              </div>
              <div className="absolute top-2 right-2 bg-black/60 text-white text-xs rounded-full px-2 py-0.5">
                {idx + 1}/{media.length}
              </div>
            </>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="px-3 pt-2 flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => user && like.mutate()}>
          <Heart className={cn('h-6 w-6', post.liked && 'fill-destructive text-destructive')} />
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setOpenComments(true)}>
          <MessageCircle className="h-6 w-6" />
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={share}>
          <Send className="h-6 w-6" />
        </Button>
        <Button variant="ghost" size="icon" className={cn('h-9 w-9', post.reposted && 'text-primary')} onClick={() => user && repost.mutate()}>
          <Repeat2 className="h-6 w-6" />
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9 ml-auto" onClick={() => user && save.mutate()}>
          <Bookmark className={cn('h-6 w-6', post.saved && 'fill-foreground')} />
        </Button>
      </div>

      <div className="px-3 pb-3 text-sm">
        {post.likes_count > 0 && <div className="font-semibold">{post.likes_count.toLocaleString()} likes</div>}
        {post.caption && (
          <div className="mt-1">
            <Link to={`/player/${post.user_id}`} className="font-semibold mr-2">{post.profile?.username ?? 'user'}</Link>
            <span className="whitespace-pre-wrap break-words">{post.caption}</span>
          </div>
        )}
        {post.comments_count > 0 && (
          <button className="text-muted-foreground text-sm mt-1" onClick={() => setOpenComments(true)}>
            View all {post.comments_count} comments
          </button>
        )}
        <div className="text-xs text-muted-foreground uppercase mt-1">
          {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
        </div>
      </div>

      <Sheet open={openComments} onOpenChange={setOpenComments}>
        <SheetContent side="bottom" className="h-[85vh] p-0 flex flex-col">
          <SheetHeader className="p-4 border-b border-border">
            <SheetTitle>Comments</SheetTitle>
          </SheetHeader>
          <div className="flex-1 min-h-0">
            <PostCommentsSheet postId={post.id} />
          </div>
        </SheetContent>
      </Sheet>
    </article>
  );
}
