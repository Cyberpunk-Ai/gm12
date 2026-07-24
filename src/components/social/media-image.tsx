import { useEffect, useState } from 'react';
import { getSignedUrl } from '@/lib/storage-url';
import { cn } from '@/lib/utils';

interface Props {
  bucket: string;
  path: string;
  alt?: string;
  className?: string;
  onClick?: () => void;
}

export function MediaImage({ bucket, path, alt = '', className, onClick }: Props) {
  const [url, setUrl] = useState<string>('');
  useEffect(() => {
    let mounted = true;
    getSignedUrl(bucket, path).then((u) => mounted && setUrl(u));
    return () => { mounted = false; };
  }, [bucket, path]);
  if (!url) return <div className={cn('bg-muted animate-pulse', className)} />;
  return <img src={url} alt={alt} className={className} onClick={onClick} loading="lazy" />;
}

export function MediaVideo({ bucket, path, className, autoPlay, muted = true, loop = true, controls, playsInline = true, onMouseEnter, onMouseLeave }: {
  bucket: string; path: string; className?: string; autoPlay?: boolean;
  muted?: boolean; loop?: boolean; controls?: boolean; playsInline?: boolean;
  onMouseEnter?: React.MouseEventHandler<HTMLVideoElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLVideoElement>;
}) {
  const [url, setUrl] = useState<string>('');
  useEffect(() => {
    let mounted = true;
    getSignedUrl(bucket, path).then((u) => mounted && setUrl(u));
    return () => { mounted = false; };
  }, [bucket, path]);
  if (!url) return <div className={cn('bg-muted animate-pulse', className)} />;
  return (
    <video
      src={url}
      className={className}
      autoPlay={autoPlay}
      muted={muted}
      loop={loop}
      controls={controls}
      playsInline={playsInline}
      preload="metadata"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    />
  );
}
