import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StatsChart } from '@/components/stats-chart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Users, DollarSign, Trophy, Activity, TrendingUp, Repeat, Filter, Globe } from 'lucide-react';
import { format, subDays, startOfDay, differenceInDays } from 'date-fns';

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

export default function AdminAnalytics() {
  const [range, setRange] = useState<RangeKey>('30');
  const days = parseInt(range, 10);
  const startDate = useMemo(() => startOfDay(subDays(new Date(), days - 1)), [days]);
  const prevStart = useMemo(() => startOfDay(subDays(new Date(), days * 2 - 1)), [days]);

  // ---------- Core KPIs ----------
  const { data: kpis } = useQuery({
    queryKey: ['analytics-kpis', range],
    queryFn: async () => {
      const [
        { count: totalUsers },
        { count: newUsers },
        { count: prevNewUsers },
        { data: revenue },
        { data: prevRevenue },
        { count: tournaments },
        { count: matches },
        { count: registrations },
        { data: activeSessions },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', startDate.toISOString()),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', prevStart.toISOString()).lt('created_at', startDate.toISOString()),
        supabase.from('payments').select('amount, created_at').eq('status', 'verified').gte('created_at', startDate.toISOString()),
        supabase.from('payments').select('amount').eq('status', 'verified').gte('created_at', prevStart.toISOString()).lt('created_at', startDate.toISOString()),
        supabase.from('tournaments').select('*', { count: 'exact', head: true }).gte('created_at', startDate.toISOString()),
        supabase.from('matches').select('*', { count: 'exact', head: true }).gte('created_at', startDate.toISOString()),
        supabase.from('registrations').select('*', { count: 'exact', head: true }).gte('created_at', startDate.toISOString()),
        supabase.from('user_analytics').select('user_id, session_id, created_at').gte('created_at', startDate.toISOString()).limit(50000),
      ]);
      const rev = (revenue ?? []).reduce((s, p) => s + Number(p.amount), 0);
      const prevRev = (prevRevenue ?? []).reduce((s, p) => s + Number(p.amount), 0);
      const uniqUsers = new Set((activeSessions ?? []).map(r => r.user_id).filter(Boolean)).size;
      const uniqSessions = new Set((activeSessions ?? []).map(r => r.session_id).filter(Boolean)).size;
      const growthUsers = prevNewUsers ? ((newUsers! - prevNewUsers) / prevNewUsers) * 100 : 0;
      const growthRev = prevRev ? ((rev - prevRev) / prevRev) * 100 : 0;
      return {
        totalUsers: totalUsers ?? 0,
        newUsers: newUsers ?? 0,
        growthUsers,
        revenue: rev,
        growthRev,
        tournaments: tournaments ?? 0,
        matches: matches ?? 0,
        registrations: registrations ?? 0,
        activeUsers: uniqUsers,
        sessions: uniqSessions,
        arpu: uniqUsers ? rev / uniqUsers : 0,
      };
    },
  });

  // ---------- Time series ----------
  const { data: series = [] } = useQuery({
    queryKey: ['analytics-series', range],
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

  // ---------- Funnel: pageview -> signup -> registration -> paid ----------
  const { data: funnel } = useQuery({
    queryKey: ['analytics-funnel', range],
    queryFn: async () => {
      const [{ data: visits }, { count: signups }, { count: regs }, { count: paid }] = await Promise.all([
        supabase.from('user_analytics').select('session_id').gte('created_at', startDate.toISOString()).limit(50000),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', startDate.toISOString()),
        supabase.from('registrations').select('*', { count: 'exact', head: true }).gte('created_at', startDate.toISOString()),
        supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'verified').gte('created_at', startDate.toISOString()),
      ]);
      const visitors = new Set((visits ?? []).map(v => v.session_id).filter(Boolean)).size;
      return [
        { stage: 'Visitors', count: visitors },
        { stage: 'Signups', count: signups ?? 0 },
        { stage: 'Registrations', count: regs ?? 0 },
        { stage: 'Paid', count: paid ?? 0 },
      ];
    },
  });

  // ---------- Cohort retention (weekly signup cohorts, weeks 0..3) ----------
  const { data: cohorts = [] } = useQuery({
    queryKey: ['analytics-cohorts'],
    queryFn: async () => {
      const cohortStart = startOfDay(subDays(new Date(), 56)); // 8 weeks back
      const [{ data: profiles }, { data: events }] = await Promise.all([
        supabase.from('profiles').select('user_id, created_at').gte('created_at', cohortStart.toISOString()),
        supabase.from('user_analytics').select('user_id, created_at').gte('created_at', cohortStart.toISOString()).not('user_id', 'is', null).limit(50000),
      ]);
      const weekKey = (d: Date) => {
        const diff = Math.floor(differenceInDays(d, cohortStart) / 7);
        return `W${diff + 1}`;
      };
      const cohortMap: Record<string, { users: Set<string>; retention: Record<number, Set<string>> }> = {};
      profiles?.forEach(p => {
        const created = new Date(p.created_at);
        const k = weekKey(created);
        if (!cohortMap[k]) cohortMap[k] = { users: new Set(), retention: {} };
        cohortMap[k].users.add(p.user_id);
      });
      const userCohort = new Map<string, { key: string; created: Date }>();
      profiles?.forEach(p => userCohort.set(p.user_id, { key: weekKey(new Date(p.created_at)), created: new Date(p.created_at) }));
      events?.forEach(e => {
        const info = userCohort.get(e.user_id!);
        if (!info) return;
        const w = Math.floor(differenceInDays(new Date(e.created_at), info.created) / 7);
        if (w < 0 || w > 3) return;
        if (!cohortMap[info.key].retention[w]) cohortMap[info.key].retention[w] = new Set();
        cohortMap[info.key].retention[w].add(e.user_id!);
      });
      return Object.entries(cohortMap)
        .sort(([a], [b]) => parseInt(a.slice(1)) - parseInt(b.slice(1)))
        .map(([k, v]) => ({
          cohort: k,
          size: v.users.size,
          w0: v.retention[0]?.size ?? 0,
          w1: v.retention[1]?.size ?? 0,
          w2: v.retention[2]?.size ?? 0,
          w3: v.retention[3]?.size ?? 0,
        }));
    },
  });

  // ---------- Top games / Top pages / Geo ----------
  const { data: topGames = [] } = useQuery({
    queryKey: ['analytics-top-games', range],
    queryFn: async () => {
      const { data } = await supabase.from('tournaments').select('game, current_participants').gte('created_at', startDate.toISOString());
      const map = new Map<string, number>();
      data?.forEach(t => map.set(t.game, (map.get(t.game) ?? 0) + (t.current_participants ?? 0)));
      return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
    },
  });

  const { data: topPages = [] } = useQuery({
    queryKey: ['analytics-top-pages', range],
    queryFn: async () => {
      const { data } = await supabase.from('user_analytics').select('path').gte('created_at', startDate.toISOString()).limit(50000);
      const map = new Map<string, number>();
      data?.forEach(r => { if (r.path) map.set(r.path, (map.get(r.path) ?? 0) + 1); });
      return [...map.entries()].map(([path, hits]) => ({ path, hits })).sort((a, b) => b.hits - a.hits).slice(0, 10);
    },
  });

  const { data: geo = [] } = useQuery({
    queryKey: ['analytics-geo', range],
    queryFn: async () => {
      const { data } = await supabase.from('user_analytics').select('country').gte('created_at', startDate.toISOString()).not('country', 'is', null).limit(50000);
      const map = new Map<string, number>();
      data?.forEach(r => { if (r.country) map.set(r.country, (map.get(r.country) ?? 0) + 1); });
      return [...map.entries()].map(([country, visits]) => ({ country, visits })).sort((a, b) => b.visits - a.visits).slice(0, 10);
    },
  });

  const exportAll = () => {
    download(`gameflex-analytics-${range}d.csv`, toCSV(series.map(s => ({ date: s.name, ...s }))));
  };

  const kpiCards = [
    { label: 'Total Users', value: kpis?.totalUsers ?? 0, icon: Users, color: 'text-primary', bg: 'from-primary/20 to-primary/5 border-primary/30' },
    { label: 'New Users', value: kpis?.newUsers ?? 0, delta: kpis?.growthUsers, icon: TrendingUp, color: 'text-blue-400', bg: 'from-blue-500/20 to-blue-500/5 border-blue-500/30' },
    { label: 'Revenue (KES)', value: Math.round(kpis?.revenue ?? 0).toLocaleString(), delta: kpis?.growthRev, icon: DollarSign, color: 'text-green-400', bg: 'from-green-500/20 to-green-500/5 border-green-500/30' },
    { label: 'ARPU (KES)', value: Math.round(kpis?.arpu ?? 0).toLocaleString(), icon: DollarSign, color: 'text-emerald-400', bg: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30' },
    { label: 'Active Users', value: kpis?.activeUsers ?? 0, icon: Activity, color: 'text-purple-400', bg: 'from-purple-500/20 to-purple-500/5 border-purple-500/30' },
    { label: 'Sessions', value: kpis?.sessions ?? 0, icon: Repeat, color: 'text-orange-400', bg: 'from-orange-500/20 to-orange-500/5 border-orange-500/30' },
    { label: 'Tournaments', value: kpis?.tournaments ?? 0, icon: Trophy, color: 'text-yellow-400', bg: 'from-yellow-500/20 to-yellow-500/5 border-yellow-500/30' },
    { label: 'Registrations', value: kpis?.registrations ?? 0, icon: Filter, color: 'text-pink-400', bg: 'from-pink-500/20 to-pink-500/5 border-pink-500/30' },
  ];

  const funnelMax = Math.max(...(funnel?.map(f => f.count) ?? [1]), 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Analytics Engine</h1>
          <p className="text-sm text-muted-foreground">KPIs, cohorts, funnels, geography & exports</p>
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
          <Button variant="outline" size="sm" onClick={exportAll}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map((k) => (
          <div key={k.label} className={`rounded-xl bg-gradient-to-br border p-4 ${k.bg}`}>
            <k.icon className={`h-5 w-5 mb-2 ${k.color}`} />
            <div className="font-display text-2xl font-bold">{k.value}</div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">{k.label}</div>
              {typeof k.delta === 'number' && (
                <span className={`text-[10px] font-semibold ${k.delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {k.delta >= 0 ? '+' : ''}{k.delta.toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="trends" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="funnel">Funnel</TabsTrigger>
          <TabsTrigger value="cohorts">Retention</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="geo">Geography</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card><CardHeader><CardTitle className="text-base">Revenue</CardTitle></CardHeader>
              <CardContent><StatsChart data={series.map(s => ({ name: s.name, value: s.revenue }))} type="area" primaryColor="hsl(142,76%,45%)" /></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">New Signups</CardTitle></CardHeader>
              <CardContent><StatsChart data={series.map(s => ({ name: s.name, value: s.signups }))} type="bar" primaryColor="hsl(200,100%,55%)" /></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Registrations</CardTitle></CardHeader>
              <CardContent><StatsChart data={series.map(s => ({ name: s.name, value: s.registrations }))} type="area" primaryColor="hsl(280,100%,60%)" /></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Top Games (participants)</CardTitle></CardHeader>
              <CardContent><StatsChart data={topGames} type="bar" primaryColor="hsl(45,100%,55%)" /></CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="funnel">
          <Card>
            <CardHeader><CardTitle className="text-base">Conversion Funnel</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {funnel?.map((f, i) => {
                const pct = (f.count / funnelMax) * 100;
                const conv = i > 0 && funnel[i - 1].count ? ((f.count / funnel[i - 1].count) * 100).toFixed(1) : null;
                return (
                  <div key={f.stage}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{f.stage}</span>
                      <span className="text-muted-foreground">{f.count.toLocaleString()} {conv && <span className="ml-2 text-xs">({conv}%)</span>}</span>
                    </div>
                    <div className="h-8 rounded-lg bg-secondary overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-primary to-purple-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              <Button variant="outline" size="sm" onClick={() => download('funnel.csv', toCSV(funnel ?? []))}>
                <Download className="h-4 w-4 mr-2" /> Export funnel
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cohorts">
          <Card>
            <CardHeader><CardTitle className="text-base">Weekly Signup Cohorts — Retention</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-muted-foreground">
                    <th className="py-2 pr-4">Cohort</th><th className="pr-4">Users</th>
                    <th className="pr-4">W0</th><th className="pr-4">W1</th><th className="pr-4">W2</th><th>W3</th>
                  </tr></thead>
                  <tbody>
                    {cohorts.map(c => {
                      const cell = (n: number) => {
                        const pct = c.size ? (n / c.size) * 100 : 0;
                        const bg = `hsl(142, 76%, ${Math.max(15, 45 - pct / 3)}%)`;
                        return <td className="pr-4 py-1"><span className="inline-block px-2 py-1 rounded text-white text-xs font-medium" style={{ background: bg }}>{pct.toFixed(0)}%</span></td>;
                      };
                      return (
                        <tr key={c.cohort} className="border-t border-border/40">
                          <td className="py-2 pr-4 font-medium">{c.cohort}</td>
                          <td className="pr-4">{c.size}</td>
                          {cell(c.w0)}{cell(c.w1)}{cell(c.w2)}{cell(c.w3)}
                        </tr>
                      );
                    })}
                    {!cohorts.length && <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">No cohort data yet</td></tr>}
                  </tbody>
                </table>
              </div>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => download('cohorts.csv', toCSV(cohorts))}>
                <Download className="h-4 w-4 mr-2" /> Export cohorts
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content">
          <Card>
            <CardHeader><CardTitle className="text-base">Top Pages</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {topPages.map(p => (
                  <div key={p.path} className="flex items-center justify-between p-2 rounded bg-secondary/40">
                    <span className="font-mono text-xs truncate max-w-[70%]">{p.path}</span>
                    <span className="text-sm font-semibold">{p.hits.toLocaleString()}</span>
                  </div>
                ))}
                {!topPages.length && <p className="text-center text-muted-foreground py-6">No pageview data</p>}
              </div>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => download('top-pages.csv', toCSV(topPages))}>
                <Download className="h-4 w-4 mr-2" /> Export
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="geo">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" /> Visitors by Country</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {geo.map(g => {
                  const pct = geo[0] ? (g.visits / geo[0].visits) * 100 : 0;
                  return (
                    <div key={g.country}>
                      <div className="flex justify-between text-sm mb-1"><span>{g.country}</span><span className="text-muted-foreground">{g.visits}</span></div>
                      <div className="h-2 rounded bg-secondary overflow-hidden"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
                    </div>
                  );
                })}
                {!geo.length && <p className="text-center text-muted-foreground py-6">No geo data yet</p>}
              </div>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => download('geo.csv', toCSV(geo))}>
                <Download className="h-4 w-4 mr-2" /> Export
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
