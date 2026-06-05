import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2, Upload, Link as LinkIcon } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth-context';

const statusLabels: Record<string, string> = { 
  live: 'Live', 
  upcoming: 'Upcoming', 
  registration_open: 'Open', 
  registration_closed: 'Closed', 
  completed: 'Done', 
  cancelled: 'Cancelled' 
};

export default function AdminTournaments() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    game: 'fifa' as const,
    format: 'single_elimination' as const,
    entry_fee: 0,
    prize_pool: 0,
    max_participants: 16,
    start_date: '',
    registration_deadline: '',
    rules: '',
    group_link: ''
  });

  const { data: tournaments = [] } = useQuery({
    queryKey: ['admin-tournaments'],
    queryFn: async () => {
      const { data } = await supabase
        .from('tournaments')
        .select('*')
        .order('created_at', { ascending: false });
      return data ?? [];
    }
  });

  const uploadImage = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const { error } = await supabase.storage
      .from('tournament-images')
      .upload(fileName, file);
    
    if (error) throw error;
    
    const { data: { publicUrl } } = supabase.storage
      .from('tournament-images')
      .getPublicUrl(fileName);
    
    return publicUrl;
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      let imageUrl = null;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      const { error } = await supabase.from('tournaments').insert({
        title: data.title,
        description: data.description,
        game: data.game,
        format: data.format,
        entry_fee: data.entry_fee,
        prize_pool: data.prize_pool,
        max_participants: data.max_participants,
        start_date: new Date(data.start_date).toISOString(),
        registration_deadline: new Date(data.registration_deadline).toISOString(),
        rules: data.rules,
        group_link: data.group_link || null,
        image_url: imageUrl,
        created_by: user?.id
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tournaments'] });
      toast({ title: 'Tournament Created', description: 'New tournament has been created' });
      setIsOpen(false);
      setImageFile(null);
      setFormData({ title: '', description: '', game: 'fifa', format: 'single_elimination', entry_fee: 0, prize_pool: 0, max_participants: 16, start_date: '', registration_deadline: '', rules: '', group_link: '' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tournaments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tournaments'] });
      toast({ title: 'Tournament Deleted' });
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'upcoming' | 'registration_open' | 'registration_closed' | 'live' | 'completed' | 'cancelled' }) => {
      const { error } = await supabase.from('tournaments').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tournaments'] });
      toast({ title: 'Status Updated' });
    }
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">Manage Tournaments</h1>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button variant="default"><Plus className="h-4 w-4 mr-2" />Create Tournament</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Tournament</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required />
                </div>
                
                {/* Image Upload */}
                <div className="col-span-2">
                  <Label htmlFor="image">Tournament Image</Label>
                  <div className="mt-2 flex items-center gap-4">
                    <Input 
                      id="image" 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                      className="flex-1"
                    />
                    {imageFile && (
                      <img 
                        src={URL.createObjectURL(imageFile)} 
                        alt="Preview" 
                        className="h-16 w-24 object-cover rounded"
                      />
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="game">Game</Label>
                  <Select value={formData.game} onValueChange={(v) => setFormData({ ...formData, game: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['fifa', 'cod', 'pubg', 'fortnite', 'apex', 'valorant', 'other'].map(g => <SelectItem key={g} value={g}>{g.toUpperCase()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="format">Format</Label>
                  <Select value={formData.format} onValueChange={(v) => setFormData({ ...formData, format: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['single_elimination', 'double_elimination', 'round_robin', 'swiss'].map(f => <SelectItem key={f} value={f}>{f.replace('_', ' ')}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="entry_fee">Entry Fee (KES)</Label>
                  <Input id="entry_fee" type="number" value={formData.entry_fee} onChange={(e) => setFormData({ ...formData, entry_fee: +e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="prize_pool">Prize Pool (KES)</Label>
                  <Input id="prize_pool" type="number" value={formData.prize_pool} onChange={(e) => setFormData({ ...formData, prize_pool: +e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="max_participants">Max Participants</Label>
                  <Input id="max_participants" type="number" value={formData.max_participants} onChange={(e) => setFormData({ ...formData, max_participants: +e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input id="start_date" type="datetime-local" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="registration_deadline">Registration Deadline</Label>
                  <Input id="registration_deadline" type="datetime-local" value={formData.registration_deadline} onChange={(e) => setFormData({ ...formData, registration_deadline: e.target.value })} required />
                </div>
                
                {/* Group Link */}
                <div className="col-span-2">
                  <Label htmlFor="group_link">Group Link (WhatsApp/Telegram)</Label>
                  <div className="relative">
                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="group_link" 
                      value={formData.group_link} 
                      onChange={(e) => setFormData({ ...formData, group_link: e.target.value })} 
                      placeholder="https://chat.whatsapp.com/..."
                      className="pl-10"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Players will be given this link after payment confirmation</p>
                </div>

                <div className="col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="rules">Rules</Label>
                  <Textarea id="rules" value={formData.rules} onChange={(e) => setFormData({ ...formData, rules: e.target.value })} />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Tournament'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
        <div className="grid grid-cols-8 gap-4 p-4 bg-secondary/50 text-sm font-semibold text-muted-foreground">
          <div className="col-span-2">Tournament</div>
          <div>Game</div>
          <div>Prize</div>
          <div>Players</div>
          <div>Status</div>
          <div>Group</div>
          <div>Actions</div>
        </div>
        {tournaments.map((t: any) => (
          <div key={t.id} className="grid grid-cols-8 gap-4 p-4 border-t border-border/50 items-center text-sm">
            <div className="col-span-2 flex items-center gap-3">
              {t.image_url && <img src={t.image_url} alt="" className="h-10 w-14 object-cover rounded" />}
              <span className="font-semibold truncate">{t.title}</span>
            </div>
            <div className="uppercase">{t.game}</div>
            <div>KES {Number(t.prize_pool).toLocaleString()}</div>
            <div>{t.current_participants}/{t.max_participants}</div>
            <div>
              <Select value={t.status} onValueChange={(status: 'upcoming' | 'registration_open' | 'registration_closed' | 'live' | 'completed' | 'cancelled') => updateStatusMutation.mutate({ id: t.id, status })}>
                <SelectTrigger className="h-8 text-xs">
                  <Badge variant={t.status === 'live' ? 'destructive' : t.status === 'registration_open' ? 'default' : 'secondary'}>{statusLabels[t.status] ?? t.status}</Badge>
                </SelectTrigger>
                <SelectContent>
                {['upcoming', 'registration_open', 'registration_closed', 'live', 'completed', 'cancelled'].map(s => (
                    <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              {t.group_link ? (
                <a href={t.group_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs">
                  <LinkIcon className="h-4 w-4 inline mr-1" />Link
                </a>
              ) : <span className="text-muted-foreground text-xs">None</span>}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost"><Edit className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate(t.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
        {tournaments.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">No tournaments found</div>
        )}
      </div>
    </div>
  );
}
