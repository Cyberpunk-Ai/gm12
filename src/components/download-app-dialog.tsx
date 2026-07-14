import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Smartphone, Share, Plus, Monitor, Check } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface DownloadAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DownloadAppDialog({ open, onOpenChange }: DownloadAppDialogProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) setPlatform('ios');
    else if (/android/.test(ua)) setPlatform('android');
    else setPlatform('desktop');

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const installedHandler = () => setInstalled(true);

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Get the GameFlex App
          </DialogTitle>
          <DialogDescription>
            Install GameFlex on your device for a faster, app-like experience.
          </DialogDescription>
        </DialogHeader>

        {installed ? (
          <div className="flex items-center gap-2 p-4 rounded-lg bg-primary/10 text-primary">
            <Check className="h-5 w-5" />
            <span className="font-medium">GameFlex is installed on this device.</span>
          </div>
        ) : deferredPrompt ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Tap the button below to install GameFlex directly.
            </p>
            <Button onClick={handleInstall} className="w-full" size="lg">
              <Download className="h-4 w-4 mr-2" />
              Install GameFlex
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {platform === 'ios' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Smartphone className="h-4 w-4" /> On iPhone / iPad (Safari)
                </div>
                <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                  <li className="flex gap-2 items-start"><span>1.</span> Tap the <Share className="inline h-4 w-4" /> <b>Share</b> button in Safari.</li>
                  <li className="flex gap-2 items-start"><span>2.</span> Scroll and tap <Plus className="inline h-4 w-4" /> <b>Add to Home Screen</b>.</li>
                  <li className="flex gap-2 items-start"><span>3.</span> Tap <b>Add</b>. GameFlex will appear on your home screen.</li>
                </ol>
              </div>
            )}
            {platform === 'android' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Smartphone className="h-4 w-4" /> On Android (Chrome)
                </div>
                <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                  <li>Open the browser menu (⋮ top-right).</li>
                  <li>Tap <b>Install app</b> or <b>Add to Home Screen</b>.</li>
                  <li>Confirm to install GameFlex.</li>
                </ol>
              </div>
            )}
            {platform === 'desktop' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Monitor className="h-4 w-4" /> On Desktop (Chrome / Edge)
                </div>
                <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                  <li>Click the install icon in the address bar (right side).</li>
                  <li>Or open the browser menu → <b>Install GameFlex</b>.</li>
                  <li>Launch it like any other app from your desktop.</li>
                </ol>
              </div>
            )}
            <p className="text-xs text-muted-foreground pt-2 border-t border-border/50">
              GameFlex works offline for browsing recently viewed pages once installed.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
