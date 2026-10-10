import { useEffect } from "preact/hooks";
import { dismissToast, getState, useApp } from "../store.ts";
import { navigate } from "../router.ts";
import { Icon } from "./common.tsx";

const TABS = [
  { path: "/", label: "Today", icon: "home" },
  { path: "/piles", label: "Piles", icon: "piles" },
  { path: "/add", label: "Add", icon: "plus" },
  { path: "/stats", label: "Stats", icon: "chart" },
  { path: "/settings", label: "Settings", icon: "gear" },
] as const;

export function TabBar({ current }: { current: string }) {
  return (
    <nav class="tabbar" aria-label="Main">
      {TABS.map((t) => (
        <a
          key={t.path}
          class="tab"
          href={`#${t.path}`}
          aria-current={current === t.path ? "page" : undefined}
          onClick={(e) => (e.preventDefault(), navigate(t.path))}
        >
          <Icon name={t.icon} />
          <span>{t.label}</span>
        </a>
      ))}
    </nav>
  );
}

export function ToastHost({ tabs }: { tabs: boolean }) {
  const { toast } = useApp();
  if (!toast) return null;
  return (
    <div
      class={`toast ${tabs ? "" : "no-tabs"}`}
      role="status"
      data-testid="toast"
    >
      <span class="grow">{toast.message}</span>
      {toast.action && (
        <button
          onClick={() => {
            toast.action!.run();
            dismissToast();
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}

/** Keep #app exactly as tall as the visible area, so the on-screen keyboard never covers or pushes content. */
export function useVisibleViewport() {
  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;
    const apply = () => {
      const h = vv?.height ?? window.innerHeight;
      const top = vv?.offsetTop ?? 0;
      root.style.setProperty("--app-h", `${Math.round(h)}px`);
      root.style.setProperty("--app-top", `${Math.round(top)}px`);
      if (top > 0) window.scrollTo(0, 0);
    };
    apply();
    vv?.addEventListener("resize", apply);
    vv?.addEventListener("scroll", apply);
    addEventListener("resize", apply);
    addEventListener("orientationchange", apply);
    return () => {
      vv?.removeEventListener("resize", apply);
      vv?.removeEventListener("scroll", apply);
      removeEventListener("resize", apply);
      removeEventListener("orientationchange", apply);
    };
  }, []);
}

export function UpdateBanner({ onReload }: { onReload: () => void }) {
  const { updateReady } = useApp();
  if (!updateReady) return null;
  return (
    <div class="banner-update" role="status">
      <span>A new version is ready.</span>
      <button onClick={onReload}>Update</button>
    </div>
  );
}

export const currentState = getState;
