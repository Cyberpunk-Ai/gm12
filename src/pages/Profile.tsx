import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { User, Phone, Mail, Gamepad2, Wallet, Trophy, Target, Loader2, Camera, FileText, MessageCircle, Edit } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EditProfileModal } from '@/components/profile/edit-profile-modal';

const Profile = () => {
  const { user, profile, updateProfile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    phone: '',
    game_handle: '',
    bio: '',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        username: profile.username || '',
        phone: profile.phone || '',
        game_handle: profile.game_handle || '',
        bio: (profile as any).bio || '',
      });
    }
  }, [profile]);

  const { data: stats } = useQuery({
    queryKey: ['leaderboard-stats', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('leaderboard_stats')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: registrations } = useQuery({
    queryKey: ['user-registrations', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('registrations')
        .select('*, tournaments(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!user,
  });

  const handleSave = async () => {
    setIsSaving(true);
    const { error } = await updateProfile(formData);
    
    if (error) {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Profile Updated',
        description: 'Your profile has been saved.',
      });
      setIsEditing(false);
    }
    setIsSaving(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast({
        title: 'Upload Failed',
        description: uploadError.message,
        variant: 'destructive',
      });
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    await updateProfile({ avatar_url: publicUrl });
    await refreshProfile();
    toast({
      title: 'Avatar Updated',
      description: 'Your avatar has been changed.',
    });
  };

  if (!user || !profile) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">Please log in to view your profile.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-6">
                <div className="relative group">
                  <Avatar className="w-24 h-24 border-4 border-primary/30">
                    <AvatarImage src={profile.avatar_url || undefined} />
                    <AvatarFallback className="text-2xl bg-primary/20">
                      {profile.username?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                    <Camera className="w-6 h-6 text-white" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                <div>
                  <CardTitle className="text-2xl">{profile.username}</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <Mail className="w-4 h-4" />
                    {profile.email}
                  </CardDescription>
                  {profile.is_verified && (
                    <Badge variant="secondary" className="mt-2">Verified</Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Link to="/messages">
                  <Button variant="outline" size="icon">
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                </Link>
                <Button onClick={() => setShowEditModal(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Profile
                </Button>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Bio Section */}
            {(profile as any).bio && (
              <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">About</p>
                    <p className="text-sm whitespace-pre-wrap">{(profile as any).bio}</p>
                  </div>
                </div>
              </div>
            )}
            
            {isEditing ? (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="username"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="pl-10"
                        placeholder="+254..."
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="game_handle">Game Handle</Label>
                    <div className="relative">
                      <Gamepad2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="game_handle"
                        value={formData.game_handle}
                        onChange={(e) => setFormData({ ...formData, game_handle: e.target.value })}
                        className="pl-10"
                        placeholder="Your in-game name"
                      />
                    </div>
                  </div>
                </div>
                
                <Button onClick={handleSave} disabled={isSaving} className="w-full">
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                  <Phone className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{profile.phone || 'Not set'}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                  <Gamepad2 className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Game Handle</p>
                    <p className="font-medium">{profile.game_handle || 'Not set'}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <Wallet className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Wallet Balance</p>
                    <p className="font-bold text-lg text-primary">KES {profile.wallet_balance || 0}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Card */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              Your Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="text-center p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-3xl font-bold text-green-500">{stats?.wins || 0}</p>
                <p className="text-sm text-muted-foreground">Wins</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-3xl font-bold text-red-500">{stats?.losses || 0}</p>
                <p className="text-sm text-muted-foreground">Losses</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-3xl font-bold text-primary">{stats?.points || 0}</p>
                <p className="text-sm text-muted-foreground">Points</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-3xl font-bold text-yellow-500">KES {stats?.earnings || 0}</p>
                <p className="text-sm text-muted-foreground">Earnings</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Tournaments */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Recent Tournaments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {registrations && registrations.length > 0 ? (
              <div className="space-y-3">
                {registrations.map((reg) => (
                  <div key={reg.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">{reg.tournaments?.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {reg.tournaments?.start_date && new Date(reg.tournaments.start_date).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant={reg.status === 'confirmed' ? 'default' : 'secondary'}>
                      {reg.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No tournament history yet. Join a tournament to get started!
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <EditProfileModal 
        open={showEditModal} 
        onOpenChange={setShowEditModal} 
      />
    </div>
  );
};

export default Profile;
