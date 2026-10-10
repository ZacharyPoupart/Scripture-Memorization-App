import type { ComponentChildren, JSX } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { formatRef } from "../core/reference.ts";
import { formatDays, formatDuration } from "../core/dates.ts";
import {
  DAILY_REVIEWS,
  graduationTarget,
  progressDays,
  daysInPile,
  type VerseStatus,
} from "../core/schedule.ts";
import { progressRing, type Ring } from "../core/today.ts";
import type { AppData, Pile, Verse } from "../core/types.ts";
import { navigate } from "../router.ts";

export const PILE_INFO: Record<
  Pile,
  { label: string; short: string; blurb: string }
> = {
  daily: {
    label: "Daily",
    short: "Daily",
    blurb: "New verses. Reviewed 3 times a day.",
  },
  weekly: {
    label: "Weekly",
    short: "Weekly",
    blurb: "Getting solid. Reviewed once a week.",
  },
  monthly: {
    label: "Monthly",
    short: "Monthly",
    blurb: "Well known. Reviewed once a month.",
  },
  yearly: {
    label: "Yearly",
    short: "Yearly",
    blurb: "Kept for life. Reviewed once a year.",
  },
};

const ICONS: Record<string, string> = {
  home: "M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  piles: "M4 6h16M4 12h16M4 18h16",
  plus: "M12 5v14M5 12h14",
  gear: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 13a7.6 7.6 0 0 0 0-2l2-1.5-2-3.5-2.4 1a7.6 7.6 0 0 0-1.7-1L15 3.5h-4L10.7 6a7.6 7.6 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7.6 7.6 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7.6 7.6 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7.6 7.6 0 0 0 1.7-1l2.4 1 2-3.5z",
  back: "M15 5l-7 7 7 7",
  close: "M6 6l12 12M18 6 6 18",
  flame:
    "M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-8.5z",
  check: "M5 12.5l4.5 4.5L19 7.5",
  external:
    "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  chart: "M5 20V11M12 20V4M19 20v-6",
};

export function Icon({
  name,
  fill,
}: {
  name: keyof typeof ICONS | string;
  fill?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={fill ? "currentColor" : "none"}
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

export function PileBadge({ pile }: { pile: Pile }) {
  return (
    <span class={`chip pile-badge pile-${pile}`}>{PILE_INFO[pile].label}</span>
  );
}

export function Seg<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div class="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  label,
  hint,
  checked,
  onChange,
  disabled,
  testid,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  testid?: string;
}) {
  return (
    <div class="row spread toggle-row">
      <div class="grow">
        <div>{label}</div>
        {hint && <div class="hint-text">{hint}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        class="switch"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        data-testid={testid}
      >
        <i />
      </button>
    </div>
  );
}

export function CheckMark({ size = 56 }: { size?: number }) {
  return (
    <svg
      class="checkmark"
      width={size}
      height={size}
      viewBox="0 0 52 52"
      aria-hidden="true"
    >
      <circle
        cx="26"
        cy="26"
        r="24"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        opacity="0.25"
      />
      <path
        d="M15 27l8 8 15-17"
        fill="none"
        stroke="currentColor"
        stroke-width="4"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Overlay({
  children,
  onClose,
  center,
  label,
}: {
  children: ComponentChildren;
  onClose?: () => void;
  center?: boolean;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Parents pass a fresh onClose on every render. The effect below must NOT re-run for that (its cleanup gives focus
  // back to the opener, which would kick keyboard focus out of the dialog on every re-render), so it reads the latest one from here.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    // Accessibility: move focus into the dialog, keep Tab inside it, and give focus back when it closes.
    const opener = document.activeElement as HTMLElement | null;
    const root = ref.current;
    const items = () =>
      [...(root?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
    // Only a field explicitly marked autofocus takes focus (it may raise the keyboard on purpose); otherwise the dialog
    // itself does, so opening a picker never pops the on-screen keyboard over the thing you're about to tap.
    if (root && !root.contains(document.activeElement))
      (items().find((el) => el.matches("[autofocus]")) ?? root).focus({
        preventScroll: true,
      });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return closeRef.current?.();
      if (e.key !== "Tab") return;
      const list = items();
      if (!list.length) return e.preventDefault();
      const first = list[0];
      const last = list[list.length - 1];
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          !root?.contains(document.activeElement))
      )
        (e.preventDefault(), last.focus());
      else if (
        !e.shiftKey &&
        (document.activeElement === last ||
          !root?.contains(document.activeElement))
      )
        (e.preventDefault(), first.focus());
    };
    addEventListener("keydown", onKey);
    return () => {
      removeEventListener("keydown", onKey);
      // Give focus back, unless it has already moved somewhere deliberate (e.g. into the next dialog that replaced this one).
      const active = document.activeElement;
      const stillHere =
        !active || active === document.body || !!root?.contains(active);
      if (stillHere && opener && document.contains(opener))
        opener.focus({ preventScroll: true });
    };
  }, []);
  return (
    <div
      class={`overlay ${center ? "center-modal" : ""}`}
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      onPointerDown={(e) => e.target === ref.current && closeRef.current?.()}
    >
      {children}
    </div>
  );
}

export function Confirm({
  title,
  body,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: ComponentChildren;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Overlay center onClose={onCancel} label={title}>
      <div class="modal stack">
        <h2>{title}</h2>
        <div class="muted">{body}</div>
        <div class="row">
          <button class="btn grow" onClick={onCancel}>
            Cancel
          </button>
          <button
            class={`btn grow ${danger ? "danger" : "primary"}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

const CONFETTI_COLORS = [
  "#e9b44c",
  "#2f8a8f",
  "#e07a5f",
  "#81b29a",
  "#6c63ff",
  "#f2cc8f",
];
export function Confetti({ count = 46 }: { count?: number }) {
  const pieces = Array.from({ length: count }, (_, i) => ({
    left: (i * 37) % 100,
    delay: (i % 12) * 0.08,
    dur: 2.2 + ((i * 13) % 10) / 10,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  }));
  return (
    <div class="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <i
          key={i}
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- verse status wording

export function statusLabel(s: VerseStatus): { text: string; cls: string } {
  switch (s.state) {
    case "ready":
      if (s.daysUntilDue !== undefined && s.daysUntilDue < 0)
        return {
          text: `Ready · overdue ${formatDays(-s.daysUntilDue)}`,
          cls: "status-overdue",
        };
      return {
        text:
          s.daysUntilDue === 0
            ? "Ready · due today"
            : s.countedToday > 0
              ? `Ready · ${s.countedToday} of ${DAILY_REVIEWS} done`
              : "Ready for review",
        cls: "status-ready",
      };
    case "waiting":
      return {
        text: `Next review in ${formatDuration(s.waitMs ?? 0)} · ${s.countedToday} of ${DAILY_REVIEWS} done`,
        cls: "status-wait",
      };
    case "done":
      return { text: "Done for today · all 3 reviews", cls: "muted" };
    default:
      return {
        text: `Next review in ${formatDays(s.daysUntilDue ?? 0)}`,
        cls: "muted",
      };
  }
}

export function pileProgress(data: AppData, v: Verse, now: number) {
  const target = graduationTarget(v.pile);
  const days = daysInPile(v, now);
  const earned = progressDays(data, v, now);
  return {
    target,
    days,
    earned,
    pct: target ? Math.min(100, Math.round((earned / target) * 100)) : 100,
  };
}

/** "How many days has this verse already been in the pile?" A plain range slider with a live caption. */
export function DaysSlider({
  value,
  max,
  onChange,
  testid,
}: {
  value: number;
  max: number;
  onChange: (n: number) => void;
  testid?: string;
}) {
  const caption =
    value === 0
      ? "Starts fresh (day 0)"
      : `${value} day${value === 1 ? "" : "s"} already in this pile`;
  return (
    <div class="days-slider">
      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={Math.min(value, max)}
        aria-label="Days already in this pile"
        aria-valuetext={caption}
        onInput={(e) => onChange(Number(e.currentTarget.value))}
        data-testid={testid}
      />
      <div
        class="small muted"
        aria-live="polite"
        data-testid={testid ? `${testid}-caption` : undefined}
      >
        {caption}
      </div>
    </div>
  );
}

/** Glanceable progress toward the next pile. Colour comes from the surrounding .pile-* class. */
export function ProgressRing({ ring }: { ring: Ring }) {
  const R = 14;
  const C = 2 * Math.PI * R;
  return (
    <span
      class={`pring ${ring.state}`}
      role="img"
      aria-label={ring.label}
      title={ring.label}
      data-testid="progress-ring"
      data-state={ring.state}
    >
      <svg viewBox="0 0 36 36" width="36" height="36" aria-hidden="true">
        <circle class="pring-track" cx="18" cy="18" r={R} />
        {ring.state === "yearly" ? (
          <path class="pring-check" d="M11.5 18.5l4.5 4.5 8.5-9.5" />
        ) : (
          <circle
            class="pring-arc"
            cx="18"
            cy="18"
            r={R}
            stroke-dasharray={`${(C * ring.fraction).toFixed(2)} ${C.toFixed(2)}`}
            transform="rotate(-90 18 18)"
          />
        )}
        {ring.state === "frozen" && (
          <path class="pring-pause" d="M15 14v8M21 14v8" />
        )}
      </svg>
      {ring.state !== "yearly" && ring.state !== "frozen" && (
        <b aria-hidden="true">{ring.earned}</b>
      )}
    </span>
  );
}

export function VerseCard({
  data,
  verse,
  now,
  status,
}: {
  data: AppData;
  verse: Verse;
  now: number;
  status: VerseStatus;
}) {
  const ring = progressRing(data, verse, now);
  const label = statusLabel(status);
  const open = () => navigate(`/verse/${verse.id}`);
  return (
    <button
      class={`card tap pile-${verse.pile}`}
      onClick={open}
      data-testid="verse-card"
      data-verse-id={verse.id}
    >
      <div class="row spread">
        <span class="verse-ref">{formatRef(verse)}</span>
        <span class="row">
          <span class="chip">{verse.translation}</span>
          <PileBadge pile={verse.pile} />
        </span>
      </div>
      <div class="verse-snippet" style={{ margin: "6px 0 8px" }}>
        {verse.text}
      </div>
      {verse.topic && (
        <div style={{ marginBottom: "8px" }}>
          <span class="chip">#{verse.topic}</span>
        </div>
      )}
      <div class="row spread small">
        <span class={label.cls} data-testid="status">
          {label.text}
        </span>
        <ProgressRing ring={ring} />
      </div>
    </button>
  );
}

let fieldId = 0;
export function Field({
  label,
  children,
  error,
  hint,
  group,
}: {
  label: string;
  children: ComponentChildren;
  error?: string | null;
  hint?: string;
  group?: boolean;
}) {
  // A <label> wrapping several buttons would become the accessible name of the first button, so groups
  // of buttons (segmented controls, mode pickers) use a labelled role="group" instead.
  if (group) {
    const id = `fld-${++fieldId}`;
    return (
      <div class="field" role="group" aria-labelledby={id}>
        <span id={id} class="field-label">
          {label}
        </span>
        {children}
        {error && <div class="error-text">{error}</div>}
        {hint && !error && <div class="hint-text">{hint}</div>}
      </div>
    );
  }
  return (
    <label class="field">
      <span>{label}</span>
      {children}
      {error && <div class="error-text">{error}</div>}
      {hint && !error && <div class="hint-text">{hint}</div>}
    </label>
  );
}

export type Props<T = unknown> = T & JSX.IntrinsicAttributes;
