import { useEffect, useRef, useState } from 'preact/hooks';
import { LESSONS, isLastStep, lessonStart, needsAction, nextLesson, prevPos, stepAt, type TourPos } from '../../core/tour.ts';
import { navigate, useRoute } from '../../router.ts';
import { endTour, openTourMenu, setTourPos, startTour, tourNext, useApp } from '../../store.ts';
import { Icon, Overlay } from '../common.tsx';
import { TourSim } from './Sim.tsx';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 6;
const sameRect = (a: Rect | null, b: Rect | null) => (!a || !b ? a === b : a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height);

/** Inline pixel sizes as strings, so nothing depends on the renderer adding units. */
const box = (o: { top?: number; left?: number; width?: number; height?: number; right?: number; bottom?: number }) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, `${Math.round(v as number)}px`]));

const find = (testid: string): HTMLElement | null => document.querySelector<HTMLElement>(`[data-testid="${testid}"]`);

/** Follows an element on screen (it may move, scroll or appear a moment later) and brings it into view once. */
function useTargetRect(testid: string | undefined, key: string): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null);
  const scrolled = useRef('');
  useEffect(() => {
    setRect(null);
    if (!testid) return;
    const measure = () => {
      const el = find(testid);
      if (!el) return setRect((r) => (r ? null : r));
      const vh = window.visualViewport?.height ?? innerHeight;
      let b = el.getBoundingClientRect();
      if (scrolled.current !== key) {
        scrolled.current = key;
        if (b.top < 70 || b.bottom > vh - 120) {
          el.scrollIntoView({ block: 'center' });
          b = el.getBoundingClientRect();
        }
      }
      const next = { top: b.top, left: b.left, width: b.width, height: b.height };
      setRect((r) => (sameRect(r, next) ? r : next));
    };
    measure();
    const t = setInterval(measure, 120);
    addEventListener('resize', measure);
    return () => {
      clearInterval(t);
      removeEventListener('resize', measure);
    };
  }, [testid, key]);
  return rect;
}

export function TourLayer() {
  const { tour, tourMenu } = useApp();
  if (tour) return tour.menu ? <TourMenu pos={tour.pos} /> : <Coach pos={tour.pos} />;
  if (tourMenu) return <TourMenu />;
  return null;
}

function Coach({ pos }: { pos: TourPos }) {
  const route = useRoute();
  const step = stepAt(pos);
  const lesson = LESSONS[pos.lesson];
  const key = `${pos.lesson}:${pos.step}`;
  const adv = step.advance;
  const advanced = useRef('');
  const [mini, setMini] = useState(false);
  const rect = useTargetRect(step.target, key);

  const go = () => {
    if (advanced.current === key) return;
    advanced.current = key;
    tourNext();
  };

  // go to the screen the step is about
  useEffect(() => {
    setMini(false);
    if (!step.route) return;
    const [path, query = ''] = step.route.split('?');
    const wantPath = path.split('/').filter(Boolean).join('/');
    const queryDiffers = !!query && new URLSearchParams(query).toString() !== route.query.toString();
    if (wantPath !== route.path.join('/') || queryDiffers) navigate(step.route);
  }, [key]);

  // moving on when the person does the thing
  useEffect(() => {
    if (adv?.kind !== 'click' || !step.target) return;
    const on = (e: Event) => {
      if ((e.target as Element | null)?.closest?.(`[data-testid="${step.target}"]`)) setTimeout(go, 80);
    };
    document.addEventListener('click', on, true);
    return () => document.removeEventListener('click', on, true);
  }, [key]);
  useEffect(() => {
    if (adv?.kind === 'route' && route.path.join('/') === adv.path) go();
  }, [key, route.path.join('/')]);
  useEffect(() => {
    if (adv?.kind !== 'present') return;
    const t = setInterval(() => find(adv.testid) && go(), 150);
    return () => clearInterval(t);
  }, [key]);

  const action = needsAction(step);
  const vh = window.visualViewport?.height ?? innerHeight;
  const inReview = route.path[0] === 'review';
  const atTop = step.free || (rect ? rect.top + rect.height / 2 > vh * 0.5 : false);
  const last = isLastStep(pos);
  const lastOfLesson = pos.step === lesson.steps.length - 1;

  const hole = rect && { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 };
  const dim = !step.free;

  if (mini)
    return (
      <div class="tour" data-testid="tour">
        <button class="tour-pill" onClick={() => setMini(false)} data-testid="tour-expand">
          Tour · {lesson.title}
        </button>
      </div>
    );

  return (
    <div class="tour" data-testid="tour" data-step={step.id}>
      {dim && !hole && <div class="tour-scrim" />}
      {dim && hole && (
        <>
          <div class="tour-block" style={box({ top: 0, left: 0, right: 0, height: Math.max(0, hole.top) })} />
          <div class="tour-block" style={box({ top: hole.top + hole.height, left: 0, right: 0, bottom: 0 })} />
          <div class="tour-block" style={box({ top: hole.top, left: 0, width: Math.max(0, hole.left), height: hole.height })} />
          <div class="tour-block" style={box({ top: hole.top, left: hole.left + hole.width, right: 0, height: hole.height })} />
          {(!adv || adv.kind === 'next') && <div class="tour-block clear" style={box({ top: hole.top, left: hole.left, width: hole.width, height: hole.height })} />}
        </>
      )}
      {hole && step.target && <div class="tour-ring" style={box({ top: hole.top, left: hole.left, width: hole.width, height: hole.height  })} data-testid="tour-ring" />}
      <section
        class={`tour-card ${atTop ? 'top' : step.target ? 'bottom' : 'center'} ${inReview ? 'no-tabs compact' : ''}`}
        role="dialog"
        aria-label={`Tour: ${step.title}`}
        data-testid="tour-card"
      >
        <div class="row spread tour-top">
          <span class="muted small">
            Lesson {pos.lesson + 1} of {LESSONS.length} · {lesson.title}
          </span>
          <span class="row" style={{ gap: '2px' }}>
            {step.free && (
              <button class="icon-btn small" aria-label="Hide the tour for now" onClick={() => setMini(true)} data-testid="tour-hide">
                <Icon name="close" />
              </button>
            )}
          </span>
        </div>
        <h3 class="tour-title" data-testid="tour-title">
          {step.title}
        </h3>
        <p class="tour-body">{step.body}</p>
        {step.sim && <TourSim />}
        <div class="dots tour-dots" aria-hidden="true">
          {lesson.steps.map((s, i) => (
            <i key={s.id} class={i === pos.step ? 'on' : ''} />
          ))}
        </div>
        {action ? (
          <div class="row spread tour-actions">
            <span class="muted small">{adv?.kind === 'click' ? 'Tap the highlighted spot to go on.' : 'Go ahead, then it moves on.'}</span>
            <button class="btn ghost small" onClick={go} data-testid="tour-skip-step">
              Skip step
            </button>
          </div>
        ) : (
          <div class="row tour-actions">
            <button class="btn ghost" disabled={pos.lesson === 0 && pos.step === 0} onClick={() => setTourPos(prevPos(pos))} data-testid="tour-back">
              Back
            </button>
            <button class="btn primary grow" onClick={go} data-testid="tour-next">
              {last ? 'Finish' : lastOfLesson ? 'Next lesson' : 'Next'}
            </button>
          </div>
        )}
        <div class="row spread tour-foot">
          <button class="btn ghost small" onClick={() => openTourMenu(true)} data-testid="tour-lessons">
            Lessons
          </button>
          {!last && (
            <button class="btn ghost small" onClick={() => (nextLesson(pos) ? setTourPos(nextLesson(pos)!) : tourNext())} data-testid="tour-skip-lesson">
              Skip lesson
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

/** The list of lessons: pick one to jump to it, or leave the tour. */
function TourMenu({ pos }: { pos?: TourPos }) {
  const { settings } = useApp();
  const done = settings.tour.done;
  const close = () => openTourMenu(false);
  return (
    <Overlay onClose={close} label="Tour lessons">
      <div class="sheet stack" data-testid="tour-menu">
        <h2>Tour lessons</h2>
        <div class="hint-text">About five minutes in all. Practice verses only, so nothing you do in the tour is saved.</div>
        <div class="stack" style={{ '--gap': '8px' } as never}>
          {LESSONS.map((l, i) => {
            const ticked = done.includes(l.id) || (!!pos && i < pos.lesson);
            return (
              <button
                key={l.id}
                class={`btn block tour-lesson ${pos?.lesson === i ? 'primary' : ''}`}
                onClick={() => (pos ? (setTourPos(lessonStart(i)), close()) : startTour(lessonStart(i)))}
                data-testid={`tour-lesson-${l.id}`}
              >
                <span class="tour-tick" aria-hidden="true">
                  {ticked ? '✓' : i + 1}
                </span>
                <span class="tour-lesson-text">
                  <b>{l.title}</b>
                  <small>{l.blurb}</small>
                </span>
              </button>
            );
          })}
        </div>
        {pos ? (
          <div class="row">
            <button class="btn grow" onClick={() => endTour(false)} data-testid="tour-exit">
              Leave the tour
            </button>
            <button class="btn ghost" onClick={close}>
              Back to it
            </button>
          </div>
        ) : (
          <button class="btn ghost block" onClick={close}>
            Close
          </button>
        )}
      </div>
    </Overlay>
  );
}
