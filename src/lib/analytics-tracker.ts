import { UAParser } from 'ua-parser-js';
import { supabase } from '@/integrations/supabase/client';

const SESSION_KEY = 'gf_analytics_session';
const GEO_KEY = 'gf_analytics_geo';
const GEO_TTL_MS = 1000 * 60 * 60 * 6; // 6h

type Geo = {
  ip?: string;
  isp?: string;
  country?: string;
  country_code?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
};

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

async function getGeo(): Promise<Geo> {
  try {
    const cached = localStorage.getItem(GEO_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.ts < GEO_TTL_MS) return parsed.data as Geo;
    }
  } catch {}

  try {
    const res = await fetch('https://ipapi.co/json/');
    if (!res.ok) return {};
    const j = await res.json();
    const geo: Geo = {
      ip: j.ip,
      isp: j.org,
      country: j.country_name,
      country_code: j.country_code,
      region: j.region,
      city: j.city,
      latitude: j.latitude,
      longitude: j.longitude,
      timezone: j.timezone,
    };
    try {
      localStorage.setItem(GEO_KEY, JSON.stringify({ ts: Date.now(), data: geo }));
    } catch {}
    return geo;
  } catch {
    return {};
  }
}

function getDeviceInfo() {
  const parser = new UAParser(navigator.userAgent);
  const device = parser.getDevice();
  const os = parser.getOS();
  const browser = parser.getBrowser();

  const conn = (navigator as any).connection;
  return {
    device_type: device.type || 'desktop',
    device_vendor: device.vendor || null,
    device_model: device.model || null,
    os_name: os.name || null,
    os_version: os.version || null,
    browser_name: browser.name || null,
    browser_version: browser.version || null,
    screen_resolution: `${window.screen.width}x${window.screen.height}`,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    user_agent: navigator.userAgent,
    connection_type: conn?.effectiveType || null,
  };
}

export async function trackEvent(params: {
  event_type?: string;
  path?: string;
  page_title?: string;
  metadata?: Record<string, any>;
  duration_ms?: number;
}) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const geo = await getGeo();
    const device = getDeviceInfo();
    await supabase.from('user_analytics').insert({
      user_id: user?.id ?? null,
      session_id: getSessionId(),
      event_type: params.event_type ?? 'pageview',
      path: params.path ?? window.location.pathname,
      page_title: params.page_title ?? document.title,
      referrer: document.referrer || null,
      metadata: params.metadata ?? {},
      duration_ms: params.duration_ms ?? null,
      ...device,
      ip_address: geo.ip ?? null,
      isp: geo.isp ?? null,
      country: geo.country ?? null,
      country_code: geo.country_code ?? null,
      region: geo.region ?? null,
      city: geo.city ?? null,
      latitude: geo.latitude ?? null,
      longitude: geo.longitude ?? null,
    });
  } catch (e) {
    // silent — analytics must never break the app
    console.debug('[analytics] track failed', e);
  }
}
