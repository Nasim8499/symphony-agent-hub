"use client";

import { useEffect, useState } from "react";
import { IconMoon, IconSun } from "./icons";

export const THEME_KEY = "bu:theme";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(THEME_KEY, next ? "dark" : "light");
    } catch {}
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", next ? "#09090b" : "#ffffff");
  };

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={dark}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className="relative flex h-8 w-[60px] shrink-0 items-center rounded-full border border-white/10 bg-white/[0.04] p-0.5 transition hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60"
    >
      <span className={`absolute top-0.5 h-[26px] w-[26px] rounded-full bg-elevated shadow-sm ring-1 ring-white/10 transition-all duration-200 ${dark ? "left-[30px]" : "left-0.5"}`} />
      <span className={`relative z-10 grid h-[26px] w-[26px] place-items-center transition ${dark ? "text-neutral-500" : "text-orange-400"}`}>
        <IconSun width={14} height={14} />
      </span>
      <span className={`relative z-10 grid h-[26px] w-[26px] place-items-center transition ${dark ? "text-sky-300" : "text-neutral-500"}`}>
        <IconMoon width={13} height={13} />
      </span>
    </button>
  );
}
