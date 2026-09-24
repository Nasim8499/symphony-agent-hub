"use client";

import { useEffect, useState } from "react";
import { IconCheck, IconDownload, IconMonitor, IconPlus, IconWifiOff } from "./icons";

type BipEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/** Install / download card for desktop, tablet and mobile (PWA + APK package triggers). */
export default function InstallCard() {
  const [deferred, setDeferred] = useState<BipEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [android, setAndroid] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    // This mount-time sync reads browser APIs; there is no non-effect equivalent.
    if (typeof window === "undefined") return;
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInstalled(standalone);
    const ua = navigator.userAgent;
     
    setIos(/iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
     
    setAndroid(/Android/i.test(ua));
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BipEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      setStatus(choice.outcome === "accepted" ? "Installing…" : "Install dismissed — you can try again any time.");
      if (choice.outcome === "accepted") setInstalled(true);
      setDeferred(null);
      return;
    }
    setStatus(
      ios
        ? "Open the Safari Share menu → Add to Home Screen."
        : android
          ? "Open the Chrome menu (⋮) → Install app / Add to Home screen."
          : "Use your browser's install icon in the address bar, or the browser menu → Install Symphony.",
    );
  };

  const clearCache = async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      setStatus("Offline cache cleared. Reload to re-download the app shell.");
    } catch {
      setStatus("This browser does not expose the cache API.");
    }
  };

  return (
    <section className="rounded-2xl border border-white/[0.07] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 text-[#fff]">
          <IconMonitor width={18} height={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-white">Install Symphony</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-neutral-400">
            Install the dashboard as an app on desktop, tablet or phone — own window, home-screen icon and an offline app shell with automatic updates.
          </p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium ${installed ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-white/10 bg-white/5 text-neutral-400"}`}>
          {installed ? "Installed" : "Not installed"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          onClick={install}
          className="flex items-center gap-3 rounded-xl border border-white/8 p-3 text-left transition press hover:border-white/20"
        >
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/5 text-orange-300">
            {installed ? <IconCheck width={15} height={15} /> : <IconDownload width={15} height={15} />}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-white">{deferred ? "Install app" : "Install / add to home screen"}</p>
            <p className="text-[11px] text-neutral-500">{ios ? "iOS · Safari" : android ? "Android · Chrome" : "Desktop · Chrome / Edge"}</p>
          </div>
        </button>
        <button
          onClick={clearCache}
          className="flex items-center gap-3 rounded-xl border border-white/8 p-3 text-left transition press hover:border-white/20"
        >
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/5 text-neutral-300">
            <IconWifiOff width={15} height={15} />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-white">Reset offline cache</p>
            <p className="text-[11px] text-neutral-500">Clear the cached app shell</p>
          </div>
        </button>
      </div>

      {android && (
        <a
          href="https://cloud.browser-use.com"
          target="_blank"
          rel="noreferrer"
          className="mt-2 flex items-center gap-3 rounded-xl border border-white/8 p-3 text-left transition hover:border-white/20"
        >
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/5 text-sky-300">
            <IconPlus width={15} height={15} />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-white">APK / package download</p>
            <p className="text-[11px] text-neutral-500">Grab the Android package bundle</p>
          </div>
        </a>
      )}

      {status && <p className="mt-3 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2 text-[11.5px] leading-relaxed text-neutral-300 fade-up">{status}</p>}
    </section>
  );
}
