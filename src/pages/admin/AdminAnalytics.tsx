import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StatsChart } from '@/components/stats-chart';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Eye, Globe, Smartphone, Monitor, Tablet, Wifi, MapPin, Download } from 'lucide-react';
import { format, subDays } from 'date-fns';

type Row = {
  id: string;
  user_id: string | null;
  session_id: string | null;
  path: string | null;
  page_title: string | null;
  device_type: string | null;
  device_vendor: string | null;
  device_model: string | null;
  os_name: string | null;
  os_version: string | null;
  browser_name: string | null;
  browser_version: string | null;
  language: string | null;
  timezone: string | null;
  ip_address: string | null;
  isp: string | null;
  country: string | null;
  country_code: string | null;
  region: string | null;
  city: string | null;
  connection_type: string | null;
  screen_resolution: string | null;
  referrer: string | null;
  created_at: string;
};

const RANGES = [
  { label: 'Last 24 hours', days: 1 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
];

function counts<T>(items: T[], pick: (t: T) => string | null | undefined) {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = pick(it) || 'Unknown';
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function toCsv(rows: Row[]) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    if (v == null) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  return [headers.join(','), ...rows.map(r => headers.map(h => escape((r as any)[h])).join(','))].join('\n');
}

export default function AdminAnalytics() {
  const [days, setDays] = useState(7);
  const [search, setSearch] = useState('');

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['admin-analytics', days],
    queryFn: async () => {
      const since = subDays(new Date(), days).toISOString();
      const { data, error } = await supabase
        .from('user_analytics')
        .select('*')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      [r.path, r.country, r.city, r.isp, r.device_vendor, r.device_model, r.browser_name, r.os_name, r.ip_address]
        .some(v => v?.toLowerCase().includes(q)),
    );
  }, [rows, search]);

  const stats = useMemo(() => {
    const uniqueUsers = new Set(filtered.filter(r => r.user_id).map(r => r.user_id)).size;
    const uniqueSessions = new Set(filtered.map(r => r.session_id)).size;
    const uniqueCountries = new Set(filtered.filter(r => r.country).map(r => r.country)).size;
    return {
      pageviews: filtered.length,
      users: uniqueUsers,
      sessions: uniqueSessions,
      countries: uniqueCountries,
    };
  }, [filtered]);

  const dailyChart = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (let i = 0; i < days; i++) {
      const d = format(subDays(new Date(), days - 1 - i), 'MMM dd');
      buckets[d] = 0;
    }
    for (const r of filtered) {
      const d = format(new Date(r.created_at), 'MMM dd');
      if (buckets[d] !== undefined) buckets[d]++;
    }
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [filtered, days]);

  const topPages = counts(filtered, r => r.path).slice(0, 8);
  const topDevices = counts(filtered, r => (r.device_vendor ? `${r.device_vendor} ${r.device_model ?? ''}`.trim() : r.device_type ?? 'Desktop'));
  const deviceTypes = counts(filtered, r => r.device_type);
  const topBrowsers = counts(filtered, r => r.browser_name);
  const topOS = counts(filtered, r => r.os_name);
  const topCountries = counts(filtered, r => r.country);
  const topISPs = counts(filtered, r => r.isp).slice(0, 10);
  const topCities = counts(filtered, r => (r.city ? `${r.city}, ${r.country ?? ''}`.trim() : null)).slice(0, 10);

  const download = () => {
    const csv = toCsv(filtered);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gameflex-analytics-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold">User Analytics</h1>
          <p className="text-sm text-muted-foreground">Devices, networks, locations and page visits</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Search path, country, ISP…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-56"
          />
          <Select value={String(days)} onValueChange={v => setDays(Number(v))}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RANGES.map(r => <SelectItem key={r.days} value={String(r.days)}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={download}>
            <Download className="h-4 w-4 mr-2" /> CSV
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Kpi icon={<Eye className="h-5 w-5 text-primary" />} label="Pageviews" value={stats.pageviews} />
        <Kpi icon={<Users className="h-5 w-5 text-blue-500" />} label="Signed-in users" value={stats.users} />
        <Kpi icon={<Wifi className="h-5 w-5 text-green-500" />} label="Sessions" value={stats.sessions} />
        <Kpi icon={<Globe className="h-5 w-5 text-purple-500" />} label="Countries" value={stats.countries} />
      </div>

      {/* Traffic chart */}
      <div className="rounded-xl bg-card border border-border/50 p-6 mb-6">
        <h2 className="font-display font-bold mb-4">Traffic</h2>
        <StatsChart data={dailyChart} type="area" primaryColor="hsl(200, 100%, 50%)" />
      </div>

      {/* Breakdown grids */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Panel title="Device type" icon={<Smartphone className="h-4 w-4" />} items={deviceTypes} />
        <Panel title="Top devices (vendor / model)" icon={<Tablet className="h-4 w-4" />} items={topDevices.slice(0, 10)} />
        <Panel title="Browsers" icon={<Monitor className="h-4 w-4" />} items={topBrowsers} />
        <Panel title="Operating systems" icon={<Monitor className="h-4 w-4" />} items={topOS} />
        <Panel title="Countries" icon={<Globe className="h-4 w-4" />} items={topCountries.slice(0, 10)} />
        <Panel title="Cities" icon={<MapPin className="h-4 w-4" />} items={topCities} />
        <Panel title="Network / ISP" icon={<Wifi className="h-4 w-4" />} items={topISPs} />
        <Panel title="Top pages" icon={<Eye className="h-4 w-4" />} items={topPages} />
      </div>

      {/* Recent events table */}
      <div className="rounded-xl bg-card border border-border/50 p-6">
        <h2 className="font-display font-bold mb-4">Recent events</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border/50">
                <th className="py-2 pr-4">Time</th>
                <th className="py-2 pr-4">Path</th>
                <th className="py-2 pr-4">Device</th>
                <th className="py-2 pr-4">OS / Browser</th>
                <th className="py-2 pr-4">Location</th>
                <th className="py-2 pr-4">ISP</th>
                <th className="py-2 pr-4">IP</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">Loading…</td></tr>}
              {!isLoading && filtered.slice(0, 100).map(r => (
                <tr key={r.id} className="border-b border-border/30">
                  <td className="py-2 pr-4 whitespace-nowrap">{format(new Date(r.created_at), 'MMM dd, HH:mm')}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{r.path}</td>
                  <td className="py-2 pr-4">{[r.device_vendor, r.device_model].filter(Boolean).join(' ') || r.device_type || 'Desktop'}</td>
                  <td className="py-2 pr-4">{[r.os_name, r.browser_name].filter(Boolean).join(' / ')}</td>
                  <td className="py-2 pr-4">{[r.city, r.country].filter(Boolean).join(', ') || '—'}</td>
                  <td className="py-2 pr-4">{r.isp ?? '—'}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{r.ip_address ?? '—'}</td>
                </tr>
              ))}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">No events in this range</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl bg-card border border-border/50 p-4">
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs text-muted-foreground">{label}</span></div>
      <div className="font-display text-2xl font-bold">{value.toLocaleString()}</div>
    </div>
  );
}

function Panel({ title, icon, items }: { title: string; icon: React.ReactNode; items: [string, number][] }) {
  const max = items[0]?.[1] ?? 1;
  return (
    <div className="rounded-xl bg-card border border-border/50 p-6">
      <div className="flex items-center gap-2 mb-4"><span className="text-muted-foreground">{icon}</span><h3 className="font-display font-bold">{title}</h3></div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data</p>
      ) : (
        <div className="space-y-2">
          {items.map(([k, v]) => (
            <div key={k}>
              <div className="flex justify-between text-sm mb-1">
                <span className="truncate mr-2">{k}</span>
                <span className="text-muted-foreground">{v}</span>
              </div>
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${(v / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
