import { useEffect, useRef, useState } from 'preact/hooks';
import { BOOKS, versesInChapter } from '../core/books.ts';
import { formatRef, refWarning, validateRef, type Ref } from '../core/reference.ts';
import { addVerse, editVerse, liveVerses } from '../core/schedule.ts';
import { TRANSLATIONS } from '../core/types.ts';
import { LookupError, lookupPassage } from '../services/lookup.ts';
import { back, navigate } from '../router.ts';
import { act, showToast, useApp } from '../store.ts';
import { Field, Icon } from './common.tsx';

type Lookup = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ok' } | { kind: 'error'; message: string };

export function AddVerse({ editId }: { editId?: string }) {
  const { data, online } = useApp();
  const existing = editId ? data.verses[editId] : undefined;
  const [book, setBook] = useState<number>(existing?.book ?? 0);
  const [chapter, setChapter] = useState<number>(existing?.chapter ?? 0);
  const [start, setStart] = useState<string>(existing ? String(existing.start) : '');
  const [end, setEnd] = useState<string>(existing && existing.end > existing.start ? String(existing.end) : '');
  const [translation, setTranslation] = useState<string>(existing?.translation ?? data.prefs.value.defaultTranslation);
  const [text, setText] = useState<string>(existing?.text ?? '');
  const [topic, setTopic] = useState<string>(existing?.topic ?? '');
  const [manual, setManual] = useState<boolean>(!!existing);
  const [lookup, setLookup] = useState<Lookup>({ kind: 'idle' });
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const ref: Ref = { book, chapter, start: Number(start) || 0, end: Number(end) || Number(start) || 0 };
  const problem = book && chapter && start ? validateRef(ref) : { field: 'start', message: '' };
  const refOk = !problem;
  const warning = refOk ? refWarning(ref) : null;
  const topics = [...new Set(liveVerses(data).map((v) => v.topic).filter(Boolean))];
  const duplicate = refOk
    ? liveVerses(data).find((v) => v.id !== editId && v.book === ref.book && v.chapter === ref.chapter && v.start === ref.start && v.end === ref.end && v.translation === translation)
    : undefined;

  const doLookup = async (force = false) => {
    if (!refOk) return;
    const id = ++reqId.current;
    if (!online) {
      setLookup({ kind: 'error', message: "You're offline. Type or paste the verse text below." });
      return;
    }
    setLookup({ kind: 'loading' });
    try {
      const t = await lookupPassage(ref, translation);
      if (id !== reqId.current) return;
      setText(t);
      setManual(false);
      setLookup({ kind: 'ok' });
    } catch (e) {
      if (id !== reqId.current) return;
      const msg = e instanceof LookupError && e.code === 'not-found' ? "Couldn't find that passage in this translation. Check the verse numbers, or type the text." : "Couldn't look it up right now. Type or paste the verse text below.";
      setLookup({ kind: 'error', message: msg });
    }
    void force;
  };

  // Automatic lookup once the reference is complete (unless the user typed their own text).
  useEffect(() => {
    if (!refOk || manual) return;
    const t = setTimeout(() => void doLookup(), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book, chapter, start, end, translation, manual, online]);

  const save = () => {
    setError(null);
    const p = validateRef(ref);
    if (!book) return setError('Choose a book.');
    if (!chapter) return setError('Choose a chapter.');
    if (p) return setError(p.message || 'Check the verse numbers.');
    if (!text.trim()) return setError('Add the verse text — look it up, or type/paste it.');
    if (existing) {
      act((d, now) => void editVerse(d, existing.id, { ...ref, translation, text, topic }, now));
      showToast('Saved.');
      back(`/verse/${existing.id}`);
    } else {
      const v = act((d, now) => addVerse(d, { ...ref, translation, text, topic }, now));
      showToast(`Added ${formatRef(v)} to Daily.`, { label: 'Add another', run: () => navigate('/add') });
      navigate('/pile/daily', true);
    }
  };

  const chapters = book ? BOOKS[book - 1].chapters : 0;
  const maxV = book && chapter ? versesInChapter(book, chapter) : undefined;

  return (
    <div class="scroll">
      <div class="narrow stack">
        <div class="page-head">
          {existing && (
            <button class="icon-btn" aria-label="Back" onClick={() => back('/')}>
              <Icon name="back" />
            </button>
          )}
          <h1>{existing ? 'Edit verse' : 'Add a verse'}</h1>
        </div>

        <Field label="Book">
          <select class="input" value={book} onChange={(e) => { setBook(Number(e.currentTarget.value)); setChapter(0); setStart(''); setEnd(''); if (!existing) setManual(false); }} data-testid="book">
            <option value={0}>Choose a book…</option>
            <optgroup label="Old Testament">
              {BOOKS.slice(0, 39).map((b) => (
                <option key={b.n} value={b.n}>{b.name}</option>
              ))}
            </optgroup>
            <optgroup label="New Testament">
              {BOOKS.slice(39).map((b) => (
                <option key={b.n} value={b.n}>{b.name}</option>
              ))}
            </optgroup>
          </select>
        </Field>
        <div class="grid3">
          <Field label="Chapter">
            <select class="input" value={chapter} disabled={!book} onChange={(e) => { setChapter(Number(e.currentTarget.value)); if (!existing) setManual(false); }} data-testid="chapter">
              <option value={0}>—</option>
              {Array.from({ length: chapters }, (_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1}</option>
              ))}
            </select>
          </Field>
          <Field label="Verse">
            <input class="input" type="number" inputMode="numeric" min={1} max={maxV} placeholder={maxV ? `1–${maxV}` : ''} value={start} disabled={!chapter} onInput={(e) => { setStart(e.currentTarget.value); if (!existing) setManual(false); }} data-testid="start" />
          </Field>
          <Field label="To (optional)">
            <input class="input" type="number" inputMode="numeric" min={1} max={maxV} value={end} disabled={!start} onInput={(e) => { setEnd(e.currentTarget.value); if (!existing) setManual(false); }} data-testid="end" />
          </Field>
        </div>
        {problem && problem.message && <div class="error-text">{problem.message}</div>}
        {warning && <div class="hint-text">{warning}</div>}

        <Field label="Translation">
          <select class="input" value={translation} onChange={(e) => { setTranslation(e.currentTarget.value); if (!existing) setManual(false); }} data-testid="translation">
            {TRANSLATIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>

        <Field label="Verse text" hint="Looked up automatically when you're online. You can always type or paste your own.">
          <textarea class="input" value={text} placeholder="The verse text appears here…" onInput={(e) => { setText(e.currentTarget.value); setManual(true); }} data-testid="text" />
        </Field>
        <div class="row">
          <button class="btn small" disabled={!refOk || lookup.kind === 'loading'} onClick={() => void doLookup(true)} data-testid="lookup">
            {lookup.kind === 'loading' ? 'Looking up…' : 'Look up text'}
          </button>
          <span class={`small ${lookup.kind === 'error' ? 'error-text' : 'muted'}`} data-testid="lookup-status" role="status">
            {lookup.kind === 'ok' ? 'Found it.' : lookup.kind === 'error' ? lookup.message : !online ? "Offline — type or paste the text." : ''}
          </span>
        </div>

        <Field label="Topic or label (optional)">
          <input class="input" list="topics" placeholder="e.g. Faith, Anxiety, Gospel" value={topic} onInput={(e) => setTopic(e.currentTarget.value)} data-testid="topic" />
          <datalist id="topics">
            {topics.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Field>

        {duplicate && <div class="banner info small">You already have {formatRef(duplicate)} ({duplicate.translation}) in {duplicate.pile}. You can still add it.</div>}
        {error && <div class="banner bad" role="alert" data-testid="form-error">{error}</div>}
        <button class="btn primary block" onClick={save} data-testid="save-verse">
          {existing ? 'Save changes' : 'Add to Daily'}
        </button>
      </div>
    </div>
  );
}
