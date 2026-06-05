import { Users, Trophy, DollarSign, Clock, TrendingUp, Activity, Gamepad2, Bell } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StatsChart } from '@/components/stats-chart';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { format, subDays, startOfDay } from 'date-fns';

export default function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [
        { count: totalUsers },
        { count: activeTournaments },
        { data: pendingPaymentsData },
        { data: revenueData },
        { count: totalMatches },
        { count: pendingRegistrations }
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('tournaments').select('*', { count: 'exact', head: true }).in('status', ['live', 'registration_open', 'upcoming']),
        supabase.from('payments').select('*').eq('status', 'pending'),
        supabase.from('payments').select('amount').eq('status', 'verified'),
        supabase.from('matches').select('*', { count: 'exact', head: true }),
        supabase.from('registrations').select('*', { count: 'exact', head: true }).eq('status', 'pending')
      ]);
      
      const totalRevenue = revenueData?.reduce((sum, p) => sum + Number(p.amount), 0) ?? 0;
      
      return {
        totalUsers: totalUsers ?? 0,
        activeTournaments: activeTournaments ?? 0,
        pendingPayments: pendingPaymentsData?.length ?? 0,
        totalRevenue,
        totalMatches: totalMatches ?? 0,
        pendingRegistrations: pendingRegistrations ?? 0
      };
    }
  });

  // Revenue chart data (last 7 days)
  const { data: revenueChartData = [] } = useQuery({
    queryKey: ['admin-revenue-chart'],
    queryFn: async () => {
      const days = 7;
      const startDate = subDays(new Date(), days);
      
      const { data } = await supabase
        .from('payments')
        .select('amount, created_at')
        .eq('status', 'verified')
        .gte('created_at', startDate.toISOString());
      
      // Group by day
      const dailyRevenue: Record<string, number> = {};
      for (let i = 0; i < days; i++) {
        const date = format(subDays(new Date(), days - 1 - i), 'MMM dd');
        dailyRevenue[date] = 0;
      }
      
      data?.forEach(p => {
        const date = format(new Date(p.created_at), 'MMM dd');
        if (dailyRevenue[date] !== undefined) {
          dailyRevenue[date] += Number(p.amount);
        }
      });
      
      return Object.entries(dailyRevenue).map(([name, value]) => ({ name, value }));
    }
  });

  // User signups chart (last 7 days)
  const { data: signupsChartData = [] } = useQuery({
    queryKey: ['admin-signups-chart'],
    queryFn: async () => {
      const days = 7;
      const startDate = subDays(new Date(), days);
      
      const { data } = await supabase
        .from('profiles')
        .select('created_at')
        .gte('created_at', startDate.toISOString());
      
      const dailySignups: Record<string, number> = {};
      for (let i = 0; i < days; i++) {
        const date = format(subDays(new Date(), days - 1 - i), 'MMM dd');
        dailySignups[date] = 0;
      }
      
      data?.forEach(p => {
        const date = format(new Date(p.created_at), 'MMM dd');
        if (dailySignups[date] !== undefined) {
          dailySignups[date] += 1;
        }
      });
      
      return Object.entries(dailySignups).map(([name, value]) => ({ name, value }));
    }
  });

  const { data: pendingPayments = [] } = useQuery({
    queryKey: ['pending-payments'],
    queryFn: async () => {
      const { data: paymentsData } = await supabase
        .from('payments')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (!paymentsData || paymentsData.length === 0) return [];
      
      const userIds = [...new Set(paymentsData.map(p => p.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username')
        .in('user_id', userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) ?? []);
      
      return paymentsData.map(p => ({
        ...p,
        profile: profileMap.get(p.user_id)
      }));
    }
  });

  const { data: liveTournaments = [] } = useQuery({
    queryKey: ['live-tournaments'],
    queryFn: async () => {
      const { data } = await supabase
        .from('tournaments')
        .select('*')
        .eq('status', 'live');
      return data ?? [];
    }
  });

  const { data: recentActivity = [] } = useQuery({
    queryKey: ['admin-recent-activity'],
    queryFn: async () => {
      const { data } = await supabase
        .from('activity_feed')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      return data ?? [];
    }
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">Admin Dashboard</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/payments">
              <Clock className="h-4 w-4 mr-2" />
              {stats?.pendingPayments ?? 0} Pending
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
        <div className="rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 p-4">
          <Users className="h-6 w-6 text-primary mb-2" />
          <div className="font-display text-2xl font-bold">{(stats?.totalUsers ?? 0).toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">Total Users</div>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-yellow-500/20 to-yellow-500/5 border border-yellow-500/30 p-4">
          <Trophy className="h-6 w-6 text-yellow-500 mb-2" />
          <div className="font-display text-2xl font-bold">{stats?.activeTournaments ?? 0}</div>
          <div className="text-xs text-muted-foreground">Active Tournaments</div>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5 border border-green-500/30 p-4">
          <DollarSign className="h-6 w-6 text-green-500 mb-2" />
          <div className="font-display text-2xl font-bold">KES {((stats?.totalRevenue ?? 0) / 1000).toFixed(0)}K</div>
          <div className="text-xs text-muted-foreground">Total Revenue</div>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-500/5 border border-orange-500/30 p-4">
          <Clock className="h-6 w-6 text-orange-500 mb-2" />
          <div className="font-display text-2xl font-bold">{stats?.pendingPayments ?? 0}</div>
          <div className="text-xs text-muted-foreground">Pending Payments</div>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/30 p-4">
          <Gamepad2 className="h-6 w-6 text-blue-500 mb-2" />
          <div className="font-display text-2xl font-bold">{stats?.totalMatches ?? 0}</div>
          <div className="text-xs text-muted-foreground">Total Matches</div>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-500/30 p-4">
          <Bell className="h-6 w-6 text-purple-500 mb-2" />
          <div className="font-display text-2xl font-bold">{stats?.pendingRegistrations ?? 0}</div>
          <div className="text-xs text-muted-foreground">Pending Signups</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <div className="rounded-xl bg-card border border-border/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold">Revenue (7 Days)</h2>
            <TrendingUp className="h-5 w-5 text-green-500" />
          </div>
          <StatsChart data={revenueChartData} type="area" primaryColor="hsl(142, 76%, 45%)" />
        </div>
        <div className="rounded-xl bg-card border border-border/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold">New Users (7 Days)</h2>
            <Users className="h-5 w-5 text-primary" />
          </div>
          <StatsChart data={signupsChartData} type="bar" primaryColor="hsl(200, 100%, 50%)" />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Pending Payments */}
        <div className="rounded-xl bg-card border border-border/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold">Pending Payments</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin/payments">View All</Link>
            </Button>
          </div>
          <div className="space-y-3">
            {pendingPayments.length > 0 ? pendingPayments.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <div>
                  <div className="font-mono text-sm">{p.transaction_code ?? 'N/A'}</div>
                  <div className="text-xs text-muted-foreground">{p.profile?.username}</div>
                </div>
                <span className="font-semibold text-sm">KES {Number(p.amount).toLocaleString()}</span>
              </div>
            )) : <p className="text-muted-foreground text-center py-4">No pending payments</p>}
          </div>
        </div>

        {/* Live Tournaments */}
        <div className="rounded-xl bg-card border border-border/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold">Live Tournaments</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin/tournaments">Manage</Link>
            </Button>
          </div>
          {liveTournaments.length > 0 ? (
            <div className="space-y-3">
              {liveTournaments.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                  <div>
                    <div className="font-semibold text-sm">{t.title}</div>
                    <div className="text-xs text-muted-foreground">{t.current_participants}/{t.max_participants} players</div>
                  </div>
                  <span className="flex items-center gap-1 text-red-400 text-xs">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    LIVE
                  </span>
                </div>
              ))}
            </div>
          ) : <p className="text-muted-foreground text-center py-8">No live tournaments</p>}
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl bg-card border border-border/50 p-6">
          <h2 className="font-display font-bold mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {recentActivity.length > 0 ? recentActivity.map((a: any) => (
              <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
                <Activity className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.activity_type}</p>
                </div>
              </div>
            )) : <p className="text-muted-foreground text-center py-4">No recent activity</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
