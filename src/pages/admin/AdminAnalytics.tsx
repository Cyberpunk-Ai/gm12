import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StatsChart } from '@/components/stats-chart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Download, Users, DollarSign, Trophy, Activity, TrendingUp, Repeat,
  Globe, Brain, Gauge, Radio, Target, ShieldAlert
} from 'lucide-react';
import { format, subDays, startOfDay, differenceInDays, differenceInHours } from 'date-fns';

type RangeKey = '7' | '30' | '90';

function toCSV(rows: Record<string, any>[]) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n');
}

function download(name: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

const fmtKES = (n: number) => `KES ${Math.round(n).toLocaleString()}`;

export default function AdminAnalytics() {
  const [range, setRange] = useState<RangeKey>('30');
  const days = parseInt(range, 10);
  const startDate = useMemo(() => startOfDay(subDays(new Date(), days - 1)), [days]);
  const prevStart = useMemo(() => startOfDay(subDays(new Date(), days * 2 - 1)), [days]);

  // ========== EXECUTIVE / CORE KPIs ==========
  const { data: exec } = useQuery({
    queryKey: ['exec', range],
    queryFn: async () => {
      const now = new Date();
      const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const todayStart = startOfDay(now);
      const weekStart = subDays(now, 7);
      const monthStart = subDays(now, 30);

      const [
        { count: totalUsers },
        { count: newUsers },
        { count: prevNewUsers },
        { data: revRange },
        { data: prevRevRange },
        { data: todayRev },
        { data: weekRev },
        { data: monthRev },
        { count: liveTournaments },
        { count: activeTournaments },
        { data: onlineNow },
        { data: sessions },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', startDate.toISOString()),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', prevStart.toISOString()).lt('created_at', startDate.toISOString()),
        supabase.from('payments').select('amount').eq('status', 'verified').gte('created_at', startDate.toISOString()),
        supabase.from('payments').select('amount').eq('status', 'verified').gte('created_at', prevStart.toISOString()).lt('created_at', startDate.toISOString()),
        supabase.from('payments').select('amount').eq('status', 'verified').gte('created_at', todayStart.toISOString()),
        supabase.from('payments').select('amount').eq('status', 'verified').gte('created_at', weekStart.toISOString()),
        supabase.from('payments').select('amount').eq('status', 'verified').gte('created_at', monthStart.toISOString()),
        supabase.from('tournaments').select('*', { count: 'exact', head: true }).eq('status', 'live'),
        supabase.from('tournaments').select('*', { count: 'exact', head: true }).in('status', ['live', 'registration_open', 'upcoming']),
        supabase.from('user_analytics').select('user_id').gte('created_at', fiveMinAgo.toISOString()).limit(5000),
        supabase.from('user_analytics').select('user_id, session_id, created_at').gte('created_at', startDate.toISOString()).limit(50000),
      ]);
      const sum = (rows: any[] | null) => (rows ?? []).reduce((s, p) => s + Number(p.amount), 0);
      const rev = sum(revRange), prevRev = sum(prevRevRange);
      const uniqUsers = new Set((sessions ?? []).map(r => r.user_id).filter(Boolean)).size;
      const uniqSessions = new Set((sessions ?? []).map(r => r.session_id).filter(Boolean)).size;
      const online = new Set((onlineNow ?? []).map(r => r.user_id).filter(Boolean)).size;
      return {
        totalUsers: totalUsers ?? 0,
        newUsers: newUsers ?? 0,
        growthUsers: prevNewUsers ? (((newUsers ?? 0) - prevNewUsers) / prevNewUsers) * 100 : 0,
        revenue: rev,
        growthRev: prevRev ? ((rev - prevRev) / prevRev) * 100 : 0,
        todayRev: sum(todayRev),
        weekRev: sum(weekRev),
        monthRev: sum(monthRev),
        liveTournaments: liveTournaments ?? 0,
        activeTournaments: activeTournaments ?? 0,
        onlineNow: online,
        activeUsers: uniqUsers,
        sessions: uniqSessions,
        arpu: uniqUsers ? rev / uniqUsers : 0,
      };
    },
    staleTime: 60_000,
  });

  // ========== TIME SERIES ==========
  const { data: series = [] } = useQuery({
    queryKey: ['series', range],
    queryFn: async () => {
      const [{ data: pays }, { data: signups }, { data: regs }] = await Promise.all([
        supabase.from('payments').select('amount, created_at').eq('status', 'verified').gte('created_at', startDate.toISOString()),
        supabase.from('profiles').select('created_at').gte('created_at', startDate.toISOString()),
        supabase.from('registrations').select('created_at').gte('created_at', startDate.toISOString()),
      ]);
      const buckets: Record<string, { revenue: number; signups: number; registrations: number }> = {};
      for (let i = 0; i < days; i++) {
        const d = format(subDays(new Date(), days - 1 - i), 'MMM dd');
        buckets[d] = { revenue: 0, signups: 0, registrations: 0 };
      }
      pays?.forEach(p => { const d = format(new Date(p.created_at), 'MMM dd'); if (buckets[d]) buckets[d].revenue += Number(p.amount); });
      signups?.forEach(p => { const d = format(new Date(p.created_at), 'MMM dd'); if (buckets[d]) buckets[d].signups += 1; });
      regs?.forEach(p => { const d = format(new Date(p.created_at), 'MMM dd'); if (buckets[d]) buckets[d].registrations += 1; });
      return Object.entries(buckets).map(([name, v]) => ({ name, ...v }));
    },
  });

  // ========== USER ANALYTICS (module 1) ==========
  const { data: userAnalytics } = useQuery({
    queryKey: ['user-analytics', range],
    queryFn: async () => {
      const dauStart = subDays(new Date(), 1);
      const wauStart = subDays(new Date(), 7);
      const mauStart = subDays(new Date(), 30);
      const [{ data: ev }, { data: countries }, { data: devices }] = await Promise.all([
        supabase.from('user_analytics').select('user_id, created_at, duration_ms').gte('created_at', mauStart.toISOString()).limit(50000),
        supabase.from('user_analytics').select('country').gte('created_at', startDate.toISOString()).not('country', 'is', null).limit(50000),
        supabase.from('user_analytics').select('device_type').gte('created_at', startDate.toISOString()).not('device_type', 'is', null).limit(50000),
      ]);
      const dau = new Set(ev?.filter(e => new Date(e.created_at) >= dauStart).map(e => e.user_id).filter(Boolean)).size;
      const wau = new Set(ev?.filter(e => new Date(e.created_at) >= wauStart).map(e => e.user_id).filter(Boolean)).size;
      const mau = new Set(ev?.map(e => e.user_id).filter(Boolean)).size;
      const playtimeSec = (ev ?? []).reduce((s, e) => s + Number(e.duration_ms ?? 0), 0) / 1000;
      const countryMap = new Map<string, number>();
      countries?.forEach(c => c.country && countryMap.set(c.country, (countryMap.get(c.country) ?? 0) + 1));
      const deviceMap = new Map<string, number>();
      devices?.forEach(d => d.device_type && deviceMap.set(d.device_type, (deviceMap.get(d.device_type) ?? 0) + 1));
      return {
        dau, wau, mau,
        stickiness: mau ? (dau / mau) * 100 : 0,
        playtimeHours: playtimeSec / 3600,
        countries: [...countryMap.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10),
        devices: [...deviceMap.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
      };
    },
  });

  // ========== TOURNAMENT ANALYTICS (module 2) ==========
  const { data: tournamentRows = [] } = useQuery({
    queryKey: ['tournament-analytics', range],
    queryFn: async () => {
      const { data: tourneys } = await supabase.from('tournaments').select('*').gte('created_at', startDate.toISOString()).order('created_at', { ascending: false }).limit(500);
      if (!tourneys?.length) return [];
      const ids = tourneys.map(t => t.id);
      const [{ data: regs }, { data: pays }, { data: matches }] = await Promise.all([
        supabase.from('registrations').select('tournament_id, status').in('tournament_id', ids),
        supabase.from('payments').select('tournament_id, amount').in('tournament_id', ids).eq('status', 'verified'),
        supabase.from('matches').select('tournament_id, status').in('tournament_id', ids),
      ]);
      const regMap = new Map<string, { joined: number; checked: number }>();
      regs?.forEach(r => {
        const cur = regMap.get(r.tournament_id) ?? { joined: 0, checked: 0 };
        cur.joined++;
        if (r.status === 'confirmed') cur.checked++;
        regMap.set(r.tournament_id, cur);
      });
      const payMap = new Map<string, number>();
      pays?.forEach(p => payMap.set(p.tournament_id!, (payMap.get(p.tournament_id!) ?? 0) + Number(p.amount)));
      const matchMap = new Map<string, { total: number; done: number }>();
      matches?.forEach(m => {
        const cur = matchMap.get(m.tournament_id) ?? { total: 0, done: 0 };
        cur.total++; if (m.status === 'completed') cur.done++;
        matchMap.set(m.tournament_id, cur);
      });
      return tourneys.map(t => {
        const r = regMap.get(t.id) ?? { joined: 0, checked: 0 };
        const m = matchMap.get(t.id) ?? { total: 0, done: 0 };
        const revenue = payMap.get(t.id) ?? 0;
        const duration = t.end_date && t.start_date ? differenceInHours(new Date(t.end_date), new Date(t.start_date)) : null;
        return {
          id: t.id, title: t.title, game: t.game, status: t.status,
          entry_fee: Number(t.entry_fee), prize_pool: Number(t.prize_pool),
          joined: r.joined, checked_in: r.checked,
          completion_rate: m.total ? (m.done / m.total) * 100 : 0,
          revenue, profit: revenue - Number(t.prize_pool),
          duration_hours: duration,
        };
      });
    },
  });

  // ========== PLAYER PERFORMANCE (module 3) ==========
  const { data: players = [] } = useQuery({
    queryKey: ['player-perf', range],
    queryFn: async () => {
      const { data: stats } = await supabase
        .from('leaderboard_stats')
        .select('user_id, wins, losses, points, earnings, tournaments_played')
        .order('points', { ascending: false })
        .limit(100);
      if (!stats?.length) return [];
      const userIds = stats.map(s => s.user_id);
      const { data: profs } = await supabase.from('profiles').select('user_id, username, avatar_url').in('user_id', userIds);
      const profMap = new Map(profs?.map(p => [p.user_id, p]) ?? []);
      return stats.map((s, i) => {
        const total = (s.wins ?? 0) + (s.losses ?? 0);
        return {
          rank: i + 1,
          user_id: s.user_id,
          username: profMap.get(s.user_id)?.username ?? 'Unknown',
          avatar: profMap.get(s.user_id)?.avatar_url,
          matches: total,
          wins: s.wins ?? 0,
          losses: s.losses ?? 0,
          win_rate: total ? ((s.wins ?? 0) / total) * 100 : 0,
          xp: s.points ?? 0,
          earnings: Number(s.earnings ?? 0),
          tournaments: s.tournaments_played ?? 0,
        };
      });
    },
  });

  // ========== REVENUE ANALYTICS (module 4) ==========
  const { data: revenue } = useQuery({
    queryKey: ['revenue', range],
    queryFn: async () => {
      const [{ data: pays }, { data: listings }] = await Promise.all([
        supabase.from('payments').select('amount, tournament_id, created_at, method, status').gte('created_at', startDate.toISOString()),
        supabase.from('marketplace_listings').select('price, status, created_at').gte('created_at', startDate.toISOString()),
      ]);
      const verified = pays?.filter(p => p.status === 'verified') ?? [];
      const tournamentRev = verified.filter(p => p.tournament_id).reduce((s, p) => s + Number(p.amount), 0);
      const walletRev = verified.filter(p => !p.tournament_id).reduce((s, p) => s + Number(p.amount), 0);
      const marketplaceRev = (listings ?? []).filter(l => l.status === 'sold').reduce((s, l) => s + Number(l.price), 0);
      const total = tournamentRev + walletRev + marketplaceRev;
      const byMethod = new Map<string, number>();
      verified.forEach(p => byMethod.set(p.method ?? 'other', (byMethod.get(p.method ?? 'other') ?? 0) + Number(p.amount)));
      return {
        total, tournamentRev, walletRev, marketplaceRev,
        subscriptionRev: 0, sponsorshipRev: 0, adRev: 0,
        byMethod: [...byMethod.entries()].map(([name, value]) => ({ name, value })),
      };
    },
  });

  // ========== BEHAVIOUR (module 5) ==========
  const { data: behaviour } = useQuery({
    queryKey: ['behaviour', range],
    queryFn: async () => {
      const [{ data: ev }, { count: visits }, { count: signups }, { count: regs }, { count: paid }] = await Promise.all([
        supabase.from('user_analytics').select('event_type, session_id, duration_ms').gte('created_at', startDate.toISOString()).limit(50000),
        supabase.from('user_analytics').select('*', { count: 'exact', head: true }).gte('created_at', startDate.toISOString()),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', startDate.toISOString()),
        supabase.from('registrations').select('*', { count: 'exact', head: true }).gte('created_at', startDate.toISOString()),
        supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'verified').gte('created_at', startDate.toISOString()),
      ]);
      const evMap = new Map<string, number>();
      ev?.forEach(e => e.event_type && evMap.set(e.event_type, (evMap.get(e.event_type) ?? 0) + 1));
      const sessionDur = new Map<string, number>();
      ev?.forEach(e => e.session_id && sessionDur.set(e.session_id, (sessionDur.get(e.session_id) ?? 0) + Number(e.duration_ms ?? 0)));
      const avgSession = sessionDur.size ? [...sessionDur.values()].reduce((a, b) => a + b, 0) / sessionDur.size / 1000 : 0;
      return {
        events: [...evMap.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 12),
        totalEvents: visits ?? 0,
        avgSessionSec: avgSession,
        funnel: [
          { stage: 'Visitors', count: new Set(ev?.map(e => e.session_id).filter(Boolean)).size },
          { stage: 'Signups', count: signups ?? 0 },
          { stage: 'Registrations', count: regs ?? 0 },
          { stage: 'Paid', count: paid ?? 0 },
        ],
      };
    },
  });

  // ========== GROWTH (module 6) ==========
  const { data: growth } = useQuery({
    queryKey: ['growth', range],
    queryFn: async () => {
      const [{ data: refs }, { data: countries }, { data: games }] = await Promise.all([
        supabase.from('referrals').select('status'),
        supabase.from('user_analytics').select('country, created_at').gte('created_at', startDate.toISOString()).not('country', 'is', null).limit(50000),
        supabase.from('tournaments').select('game, current_participants').gte('created_at', startDate.toISOString()),
      ]);
      const totalRefs = refs?.length ?? 0;
      const converted = refs?.filter(r => r.status === 'converted' || r.status === 'completed').length ?? 0;
      const countryGrowth = new Map<string, number>();
      countries?.forEach(c => c.country && countryGrowth.set(c.country, (countryGrowth.get(c.country) ?? 0) + 1));
      const gameGrowth = new Map<string, number>();
      games?.forEach(g => gameGrowth.set(g.game, (gameGrowth.get(g.game) ?? 0) + (g.current_participants ?? 0)));
      return {
        totalReferrals: totalRefs,
        conversionRate: totalRefs ? (converted / totalRefs) * 100 : 0,
        topCountries: [...countryGrowth.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8),
        topGames: [...gameGrowth.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8),
      };
    },
  });

  // ========== AI METRICS (module 7) ==========
  const { data: aiMetrics = [] } = useQuery({
    queryKey: ['ai', range],
    queryFn: async () => {
      const { data: profs } = await supabase.from('profiles').select('user_id, username, created_at, wallet_balance').limit(200);
      if (!profs?.length) return [];
      const ids = profs.map(p => p.user_id);
      const [{ data: stats }, { data: pays }, { data: recent }] = await Promise.all([
        supabase.from('leaderboard_stats').select('user_id, wins, losses, points, earnings').in('user_id', ids),
        supabase.from('payments').select('user_id, amount, status').in('user_id', ids),
        supabase.from('user_analytics').select('user_id, created_at').in('user_id', ids).order('created_at', { ascending: false }).limit(50000),
      ]);
      const statMap = new Map(stats?.map(s => [s.user_id, s]) ?? []);
      const lastSeen = new Map<string, Date>();
      recent?.forEach(r => { if (r.user_id && !lastSeen.has(r.user_id)) lastSeen.set(r.user_id, new Date(r.created_at)); });
      const spend = new Map<string, { total: number; failed: number }>();
      pays?.forEach(p => {
        if (!p.user_id) return;
        const cur = spend.get(p.user_id) ?? { total: 0, failed: 0 };
        if (p.status === 'verified') cur.total += Number(p.amount);
        if (p.status === 'rejected') cur.failed++;
        spend.set(p.user_id, cur);
      });
      return profs.map(p => {
        const s = statMap.get(p.user_id);
        const wins = s?.wins ?? 0, losses = s?.losses ?? 0;
        const total = wins + losses;
        const wr = total ? wins / total : 0;
        const skill = Math.round((wr * 60 + Math.min(total, 50) * 0.8) * 10) / 10; // 0..100ish
        const last = lastSeen.get(p.user_id);
        const daysIdle = last ? differenceInDays(new Date(), last) : 999;
        const churn = Math.min(100, daysIdle * 5);
        const sp = spend.get(p.user_id) ?? { total: 0, failed: 0 };
        const fraud = Math.min(100, sp.failed * 20);
        const engagement = Math.max(0, 100 - churn) * 0.7 + Math.min(30, total);
        return {
          user_id: p.user_id, username: p.username,
          skill, engagement: Math.round(engagement), churn, fraud,
          spend: sp.total, last_seen_days: daysIdle,
        };
      }).sort((a, b) => b.engagement - a.engagement);
    },
  });

  const range_ = range;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Analytics Engine</h1>
          <p className="text-sm text-muted-foreground">8 modules · live data · CSV export</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="executive" className="w-full">
        <TabsList className="grid w-full grid-cols-4 md:grid-cols-8 h-auto">
          <TabsTrigger value="executive" className="text-xs"><Gauge className="h-3.5 w-3.5 mr-1" />Exec</TabsTrigger>
          <TabsTrigger value="users" className="text-xs"><Users className="h-3.5 w-3.5 mr-1" />Users</TabsTrigger>
          <TabsTrigger value="tournaments" className="text-xs"><Trophy className="h-3.5 w-3.5 mr-1" />Tourneys</TabsTrigger>
          <TabsTrigger value="players" className="text-xs"><Target className="h-3.5 w-3.5 mr-1" />Players</TabsTrigger>
          <TabsTrigger value="revenue" className="text-xs"><DollarSign className="h-3.5 w-3.5 mr-1" />Revenue</TabsTrigger>
          <TabsTrigger value="behaviour" className="text-xs"><Activity className="h-3.5 w-3.5 mr-1" />Behaviour</TabsTrigger>
          <TabsTrigger value="growth" className="text-xs"><TrendingUp className="h-3.5 w-3.5 mr-1" />Growth</TabsTrigger>
          <TabsTrigger value="ai" className="text-xs"><Brain className="h-3.5 w-3.5 mr-1" />AI</TabsTrigger>
        </TabsList>

        {/* ============ EXECUTIVE ============ */}
        <TabsContent value="executive" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Online now" value={exec?.onlineNow ?? 0} icon={Radio} color="text-green-400" bg="from-green-500/20 to-green-500/5 border-green-500/30" />
            <KpiCard label="Live tournaments" value={exec?.liveTournaments ?? 0} icon={Trophy} color="text-yellow-400" bg="from-yellow-500/20 to-yellow-500/5 border-yellow-500/30" />
            <KpiCard label="Today's revenue" value={fmtKES(exec?.todayRev ?? 0)} icon={DollarSign} color="text-emerald-400" bg="from-emerald-500/20 to-emerald-500/5 border-emerald-500/30" />
            <KpiCard label="This week" value={fmtKES(exec?.weekRev ?? 0)} icon={DollarSign} color="text-teal-400" bg="from-teal-500/20 to-teal-500/5 border-teal-500/30" />
            <KpiCard label="This month" value={fmtKES(exec?.monthRev ?? 0)} icon={DollarSign} color="text-cyan-400" bg="from-cyan-500/20 to-cyan-500/5 border-cyan-500/30" />
            <KpiCard label="Total users" value={(exec?.totalUsers ?? 0).toLocaleString()} icon={Users} color="text-primary" bg="from-primary/20 to-primary/5 border-primary/30" />
            <KpiCard label={`New users (${range_}d)`} value={exec?.newUsers ?? 0} delta={exec?.growthUsers} icon={TrendingUp} color="text-blue-400" bg="from-blue-500/20 to-blue-500/5 border-blue-500/30" />
            <KpiCard label="ARPU" value={fmtKES(exec?.arpu ?? 0)} icon={DollarSign} color="text-purple-400" bg="from-purple-500/20 to-purple-500/5 border-purple-500/30" />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card><CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">Revenue trend</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => download(`revenue-${range_}d.csv`, toCSV(series.map(s => ({ date: s.name, revenue: s.revenue }))))}><Download className="h-4 w-4" /></Button>
            </CardHeader><CardContent><StatsChart data={series.map(s => ({ name: s.name, value: s.revenue }))} type="area" primaryColor="hsl(142,76%,45%)" /></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Signups trend</CardTitle></CardHeader>
              <CardContent><StatsChart data={series.map(s => ({ name: s.name, value: s.signups }))} type="bar" primaryColor="hsl(200,100%,55%)" /></CardContent></Card>
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <Card><CardHeader><CardTitle className="text-base">Top-revenue tournaments</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {[...tournamentRows].sort((a, b) => b.revenue - a.revenue).slice(0, 5).map(t => (
                  <div key={t.id} className="flex justify-between p-2 rounded bg-secondary/50">
                    <span className="truncate mr-2">{t.title}</span>
                    <span className="font-semibold text-green-400">{fmtKES(t.revenue)}</span>
                  </div>
                ))}
                {!tournamentRows.length && <p className="text-muted-foreground text-center py-4">No data</p>}
              </CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Top spenders</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {aiMetrics.slice().sort((a, b) => b.spend - a.spend).slice(0, 5).map(p => (
                  <div key={p.user_id} className="flex justify-between p-2 rounded bg-secondary/50">
                    <span className="truncate mr-2">{p.username}</span>
                    <span className="font-semibold text-emerald-400">{fmtKES(p.spend)}</span>
                  </div>
                ))}
                {!aiMetrics.length && <p className="text-muted-foreground text-center py-4">No data</p>}
              </CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-red-400" />Churn risk</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {aiMetrics.slice().sort((a, b) => b.churn - a.churn).slice(0, 5).map(p => (
                  <div key={p.user_id} className="flex justify-between p-2 rounded bg-secondary/50">
                    <span className="truncate mr-2">{p.username}</span>
                    <Badge variant="destructive" className="text-[10px]">{p.churn.toFixed(0)}%</Badge>
                  </div>
                ))}
                {!aiMetrics.length && <p className="text-muted-foreground text-center py-4">No data</p>}
              </CardContent></Card>
          </div>
        </TabsContent>

        {/* ============ USERS ============ */}
        <TabsContent value="users" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="DAU" value={userAnalytics?.dau ?? 0} icon={Users} color="text-primary" bg="from-primary/20 to-primary/5 border-primary/30" />
            <KpiCard label="WAU" value={userAnalytics?.wau ?? 0} icon={Users} color="text-blue-400" bg="from-blue-500/20 to-blue-500/5 border-blue-500/30" />
            <KpiCard label="MAU" value={userAnalytics?.mau ?? 0} icon={Users} color="text-purple-400" bg="from-purple-500/20 to-purple-500/5 border-purple-500/30" />
            <KpiCard label="Stickiness" value={`${(userAnalytics?.stickiness ?? 0).toFixed(1)}%`} icon={Repeat} color="text-orange-400" bg="from-orange-500/20 to-orange-500/5 border-orange-500/30" />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <Card><CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">Top countries</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => download('countries.csv', toCSV(userAnalytics?.countries ?? []))}><Download className="h-4 w-4" /></Button>
            </CardHeader><CardContent><StatsChart data={userAnalytics?.countries ?? []} type="bar" primaryColor="hsl(280,100%,60%)" /></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Device split</CardTitle></CardHeader>
              <CardContent><StatsChart data={userAnalytics?.devices ?? []} type="bar" primaryColor="hsl(45,100%,55%)" /></CardContent></Card>
          </div>
          <Card><CardHeader><CardTitle className="text-base">Total playtime</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-display font-bold">{(userAnalytics?.playtimeHours ?? 0).toFixed(1)} <span className="text-base text-muted-foreground">hours (last 30d)</span></p></CardContent></Card>
        </TabsContent>

        {/* ============ TOURNAMENTS ============ */}
        <TabsContent value="tournaments" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Tournament performance ({tournamentRows.length})</CardTitle>
              <Button variant="outline" size="sm" onClick={() => download('tournaments.csv', toCSV(tournamentRows))}><Download className="h-4 w-4 mr-2" />Export</Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[900px]">
                  <thead className="text-left text-muted-foreground text-xs">
                    <tr><th className="py-2 pr-3">Tournament</th><th className="pr-3">Game</th><th className="pr-3">Joined</th><th className="pr-3">Checked</th><th className="pr-3">Complete</th><th className="pr-3">Revenue</th><th className="pr-3">Profit</th><th>Hours</th></tr>
                  </thead>
                  <tbody>
                    {tournamentRows.map(t => (
                      <tr key={t.id} className="border-t border-border/40">
                        <td className="py-2 pr-3 font-medium truncate max-w-[200px]">{t.title}</td>
                        <td className="pr-3"><Badge variant="secondary" className="text-[10px]">{t.game}</Badge></td>
                        <td className="pr-3">{t.joined}</td>
                        <td className="pr-3">{t.checked_in}</td>
                        <td className="pr-3">{t.completion_rate.toFixed(0)}%</td>
                        <td className="pr-3 text-green-400">{fmtKES(t.revenue)}</td>
                        <td className={`pr-3 ${t.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtKES(t.profit)}</td>
                        <td>{t.duration_hours ?? '—'}</td>
                      </tr>
                    ))}
                    {!tournamentRows.length && <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No tournaments in range</td></tr>}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ PLAYERS ============ */}
        <TabsContent value="players" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Player performance leaderboard</CardTitle>
              <Button variant="outline" size="sm" onClick={() => download('players.csv', toCSV(players))}><Download className="h-4 w-4 mr-2" />Export</Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead className="text-left text-muted-foreground text-xs">
                    <tr><th className="py-2 pr-3">#</th><th className="pr-3">Player</th><th className="pr-3">Matches</th><th className="pr-3">W</th><th className="pr-3">L</th><th className="pr-3">Win rate</th><th className="pr-3">XP</th><th>Earnings</th></tr>
                  </thead>
                  <tbody>
                    {players.map(p => (
                      <tr key={p.user_id} className="border-t border-border/40">
                        <td className="py-2 pr-3 font-bold text-primary">#{p.rank}</td>
                        <td className="pr-3">{p.username}</td>
                        <td className="pr-3">{p.matches}</td>
                        <td className="pr-3 text-green-400">{p.wins}</td>
                        <td className="pr-3 text-red-400">{p.losses}</td>
                        <td className="pr-3">{p.win_rate.toFixed(1)}%</td>
                        <td className="pr-3">{p.xp}</td>
                        <td className="text-emerald-400">{fmtKES(p.earnings)}</td>
                      </tr>
                    ))}
                    {!players.length && <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No player stats yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ REVENUE ============ */}
        <TabsContent value="revenue" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Total revenue" value={fmtKES(revenue?.total ?? 0)} icon={DollarSign} color="text-green-400" bg="from-green-500/20 to-green-500/5 border-green-500/30" />
            <KpiCard label="Tournament" value={fmtKES(revenue?.tournamentRev ?? 0)} icon={Trophy} color="text-yellow-400" bg="from-yellow-500/20 to-yellow-500/5 border-yellow-500/30" />
            <KpiCard label="Wallet" value={fmtKES(revenue?.walletRev ?? 0)} icon={DollarSign} color="text-blue-400" bg="from-blue-500/20 to-blue-500/5 border-blue-500/30" />
            <KpiCard label="Marketplace" value={fmtKES(revenue?.marketplaceRev ?? 0)} icon={DollarSign} color="text-purple-400" bg="from-purple-500/20 to-purple-500/5 border-purple-500/30" />
            <KpiCard label="Subscriptions" value={fmtKES(revenue?.subscriptionRev ?? 0)} icon={DollarSign} color="text-muted-foreground" bg="from-muted/20 to-muted/5 border-muted/30" />
            <KpiCard label="Sponsorship" value={fmtKES(revenue?.sponsorshipRev ?? 0)} icon={DollarSign} color="text-muted-foreground" bg="from-muted/20 to-muted/5 border-muted/30" />
            <KpiCard label="Advertising" value={fmtKES(revenue?.adRev ?? 0)} icon={DollarSign} color="text-muted-foreground" bg="from-muted/20 to-muted/5 border-muted/30" />
            <KpiCard label="ARPU" value={fmtKES(exec?.arpu ?? 0)} icon={DollarSign} color="text-emerald-400" bg="from-emerald-500/20 to-emerald-500/5 border-emerald-500/30" />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <Card><CardHeader><CardTitle className="text-base">Revenue trend</CardTitle></CardHeader>
              <CardContent><StatsChart data={series.map(s => ({ name: s.name, value: s.revenue }))} type="area" primaryColor="hsl(142,76%,45%)" /></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">By payment method</CardTitle></CardHeader>
              <CardContent><StatsChart data={revenue?.byMethod ?? []} type="bar" primaryColor="hsl(200,100%,55%)" /></CardContent></Card>
          </div>
        </TabsContent>

        {/* ============ BEHAVIOUR ============ */}
        <TabsContent value="behaviour" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Total events" value={(behaviour?.totalEvents ?? 0).toLocaleString()} icon={Activity} color="text-primary" bg="from-primary/20 to-primary/5 border-primary/30" />
            <KpiCard label="Avg session" value={`${Math.round(behaviour?.avgSessionSec ?? 0)}s`} icon={Repeat} color="text-blue-400" bg="from-blue-500/20 to-blue-500/5 border-blue-500/30" />
            <KpiCard label="Sessions" value={exec?.sessions ?? 0} icon={Users} color="text-purple-400" bg="from-purple-500/20 to-purple-500/5 border-purple-500/30" />
            <KpiCard label="Active users" value={exec?.activeUsers ?? 0} icon={Users} color="text-emerald-400" bg="from-emerald-500/20 to-emerald-500/5 border-emerald-500/30" />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <Card><CardHeader><CardTitle className="text-base">Event distribution</CardTitle></CardHeader>
              <CardContent><StatsChart data={behaviour?.events ?? []} type="bar" primaryColor="hsl(280,100%,60%)" height={280} /></CardContent></Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Conversion funnel</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {(() => {
                  const f = behaviour?.funnel ?? [];
                  const max = Math.max(...f.map(x => x.count), 1);
                  return f.map((x, i) => {
                    const conv = i > 0 && f[i - 1].count ? ((x.count / f[i - 1].count) * 100).toFixed(1) : null;
                    return (
                      <div key={x.stage}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium">{x.stage}</span>
                          <span className="text-muted-foreground">{x.count.toLocaleString()} {conv && <span className="text-xs ml-2">({conv}%)</span>}</span>
                        </div>
                        <div className="h-6 rounded bg-secondary overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-primary to-purple-500" style={{ width: `${(x.count / max) * 100}%` }} />
                        </div>
                      </div>
                    );
                  });
                })()}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============ GROWTH ============ */}
        <TabsContent value="growth" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="New users" value={exec?.newUsers ?? 0} delta={exec?.growthUsers} icon={TrendingUp} color="text-primary" bg="from-primary/20 to-primary/5 border-primary/30" />
            <KpiCard label="Referrals" value={growth?.totalReferrals ?? 0} icon={Users} color="text-blue-400" bg="from-blue-500/20 to-blue-500/5 border-blue-500/30" />
            <KpiCard label="Referral conv." value={`${(growth?.conversionRate ?? 0).toFixed(1)}%`} icon={Target} color="text-green-400" bg="from-green-500/20 to-green-500/5 border-green-500/30" />
            <KpiCard label="Countries" value={growth?.topCountries.length ?? 0} icon={Globe} color="text-purple-400" bg="from-purple-500/20 to-purple-500/5 border-purple-500/30" />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <Card><CardHeader><CardTitle className="text-base">Country growth</CardTitle></CardHeader>
              <CardContent><StatsChart data={growth?.topCountries ?? []} type="bar" primaryColor="hsl(200,100%,55%)" /></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Game growth</CardTitle></CardHeader>
              <CardContent><StatsChart data={growth?.topGames ?? []} type="bar" primaryColor="hsl(45,100%,55%)" /></CardContent></Card>
          </div>
        </TabsContent>

        {/* ============ AI ============ */}
        <TabsContent value="ai" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">AI metrics per user</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Skill · engagement · churn · fraud · spend</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => download('ai-metrics.csv', toCSV(aiMetrics))}><Download className="h-4 w-4 mr-2" />Export</Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead className="text-left text-muted-foreground text-xs">
                    <tr><th className="py-2 pr-3">Player</th><th className="pr-3">Skill</th><th className="pr-3">Engagement</th><th className="pr-3">Churn risk</th><th className="pr-3">Fraud score</th><th className="pr-3">Spend</th><th>Last seen</th></tr>
                  </thead>
                  <tbody>
                    {aiMetrics.map(p => (
                      <tr key={p.user_id} className="border-t border-border/40">
                        <td className="py-2 pr-3 font-medium">{p.username}</td>
                        <td className="pr-3">{p.skill}</td>
                        <td className="pr-3">{p.engagement}</td>
                        <td className="pr-3"><Badge variant={p.churn > 60 ? 'destructive' : p.churn > 30 ? 'secondary' : 'default'} className="text-[10px]">{p.churn.toFixed(0)}%</Badge></td>
                        <td className="pr-3"><Badge variant={p.fraud > 40 ? 'destructive' : 'secondary'} className="text-[10px]">{p.fraud.toFixed(0)}</Badge></td>
                        <td className="pr-3 text-emerald-400">{fmtKES(p.spend)}</td>
                        <td className="text-muted-foreground">{p.last_seen_days >= 999 ? 'never' : `${p.last_seen_days}d ago`}</td>
                      </tr>
                    ))}
                    {!aiMetrics.length && <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No data</td></tr>}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({ label, value, delta, icon: Icon, color, bg }: { label: string; value: any; delta?: number; icon: any; color: string; bg: string }) {
  return (
    <div className={`rounded-xl bg-gradient-to-br border p-4 ${bg}`}>
      <Icon className={`h-5 w-5 mb-2 ${color}`} />
      <div className="font-display text-xl font-bold truncate">{value}</div>
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground truncate">{label}</div>
        {typeof delta === 'number' && (
          <span className={`text-[10px] font-semibold ${delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}
