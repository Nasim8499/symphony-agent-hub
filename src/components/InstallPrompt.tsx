"use client";

import { useCallback, useEffect, useState } from "react";
import { IconBolt, IconExternal, IconMonitor, IconPlus, IconX } from "./icons";

type BipEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const KEY = "bu:install-dismissed";

/** Custom install/download prompts for desktop, tablet and mobile (APK/PWA package triggers). */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BipEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [android, setAndroid] = useState(false);
  const [open, setOpen] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    if (standalone) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInstalled(true);
      return;
    }
    const ua = navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
     
    setIos(isIos);
     
    setAndroid(/Android/i.test(ua));
     
    setOpen(localStorage.getItem(KEY) !== "1");

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BipEvent);
      setOpen(true);
    };
    const onInstalled = () => {
      setInstalled(true);
      setOpen(false);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = useCallback(() => {
    setOpen(false);
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
  }, []);

  const install = useCallback(async () => {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        setInstalled(true);
        setOpen(false);
      }
      setDeferred(null);
      return;
    }
    setShowHelp(true);
  }, [deferred]);

  if (installed || !open) return null;

  const platform = ios ? "iOS" : android ? "Android" : "Desktop";

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-white/10 bg-elevated/95 p-3 shadow-[0_16px_50px_-12px_rgba(0,0,0,0.45)] backdrop-blur-md fade-up">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 text-[#fff]">
              <IconMonitor width={18} height={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-white">Install Symphony</p>
              <p className="mt-0.5 text-[11.5px] leading-snug text-neutral-400">
                {platform === "iOS"
                  ? "Add to your Home Screen for a full-screen, offline-ready app."
                  : "Install as an app — own window, home screen icon and offline shell."}
              </p>
            </div>
            <button onClick={dismiss} aria-label="Dismiss install prompt" className="rounded-md p-1 text-neutral-500 hover:bg-white/10 hover:text-white">
              <IconX width={14} height={14} />
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={install} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-white text-[13px] font-medium text-black hover:bg-neutral-200">
              <IconPlus width={14} height={14} /> Install app
            </button>
            {android && (
              <a
                href="https://cloud.browser-use.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/10 px-3 text-[13px] font-medium text-neutral-300 hover:bg-white/5"
              >
                <IconBolt width={13} height={13} /> APK <IconExternal width={11} height={11} />
              </a>
            )}
          </div>
        </div>
      </div>

      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setShowHelp(false)}>
          <div className="w-full max-w-md rounded-t-2xl border border-white/10 bg-elevated p-5 shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-white">Install on {platform}</h3>
            <ol className="mt-3 space-y-2.5 text-[13px] leading-relaxed text-neutral-300">
              {ios ? (
                <>
                  <li>1. Tap the <span className="text-white">Share</span> button in Safari.</li>
                  <li>2. Scroll and tap <span className="text-white">Add to Home Screen</span>.</li>
                  <li>3. Confirm — Symphony opens full-screen with its own icon.</li>
                </>
              ) : android ? (
                <>
                  <li>1. Open the browser menu (⋮) in Chrome.</li>
                  <li>2. Tap <span className="text-white">Install app</span> or <span className="text-white">Add to Home screen</span>.</li>
                  <li>3. Confirm — the standalone app installs with its own icon.</li>
                </>
              ) : (
                <>
                  <li>1. Look for the <span className="text-white">install icon</span> in your browser&apos;s address bar.</li>
                  <li>2. Or open the browser menu → <span className="text-white">Install Symphony</span>.</li>
                  <li>3. Confirm — it installs as a desktop app with its own window.</li>
                </>
              )}
            </ol>
            <button onClick={() => setShowHelp(false)} className="mt-4 h-9 w-full rounded-lg bg-white text-[13px] font-medium text-black hover:bg-neutral-200">
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
