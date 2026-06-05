import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Image, Video, X, Loader2, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function CreateStatus() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [content, setContent] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'text'>('text');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    
    if (!isVideo && !isImage) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image or video file',
        variant: 'destructive'
      });
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please select a file under 10MB',
        variant: 'destructive'
      });
      return;
    }
    
    setMediaFile(file);
    setMediaType(isVideo ? 'video' : 'image');
    setMediaPreview(URL.createObjectURL(file));
  };

  const removeMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType('text');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const createStatusMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      if (!content.trim() && !mediaFile) throw new Error('Please add content or media');
      
      let mediaUrl = null;
      
      if (mediaFile) {
        const fileExt = mediaFile.name.split('.').pop();
        const filePath = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('status-media')
          .upload(filePath, mediaFile);
        
        if (uploadError) throw uploadError;
        
        const { data: urlData } = supabase.storage
          .from('status-media')
          .getPublicUrl(filePath);
        
        mediaUrl = urlData.publicUrl;
      }
      
      const { error } = await supabase.from('user_statuses').insert({
        user_id: user.id,
        content: content.trim() || null,
        media_url: mediaUrl,
        media_type: mediaFile ? mediaType : 'text'
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      setContent('');
      removeMedia();
      queryClient.invalidateQueries({ queryKey: ['user-statuses'] });
      toast({
        title: 'Status posted!',
        description: 'Your status will be visible for 24 hours'
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to post status',
        variant: 'destructive'
      });
    }
  });

  if (!user) return null;

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={profile?.avatar_url} />
            <AvatarFallback>{profile?.username?.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          
          <div className="flex-1 space-y-3">
            <Textarea
              placeholder="What's on your mind? Share something hype! 🔥"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[80px] resize-none"
            />
            
            {mediaPreview && (
              <div className="relative inline-block">
                {mediaType === 'video' ? (
                  <video
                    src={mediaPreview}
                    className="max-h-48 rounded-lg"
                    controls
                  />
                ) : (
                  <img
                    src={mediaPreview}
                    alt="Preview"
                    className="max-h-48 rounded-lg"
                  />
                )}
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6"
                  onClick={removeMedia}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Image className="h-4 w-4 mr-1" />
                  Photo
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Video className="h-4 w-4 mr-1" />
                  Video
                </Button>
              </div>
              
              <Button
                onClick={() => createStatusMutation.mutate()}
                disabled={createStatusMutation.isPending || (!content.trim() && !mediaFile)}
              >
                {createStatusMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Post Status
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
