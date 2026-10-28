/**
 * iPhone only raises the keyboard when focus is asked for inside a tap, and "Type it out" asks after the screen has
 * loaded (and again for every verse, on a timer). A hidden field takes focus during the tap and holds it between
 * verses, so the keyboard comes up and stays up; the real field takes over from it.
 */
let holder: HTMLInputElement | null = null;

export function primeKeyboard(): void {
  if (typeof document === 'undefined') return;
  if (!holder) {
    holder = document.createElement('input');
    holder.type = 'text';
    holder.setAttribute('aria-hidden', 'true');
    holder.tabIndex = -1;
    holder.autocapitalize = 'off';
    holder.autocomplete = 'off';
    holder.spellcheck = false;
    holder.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0;font-size:16px;caret-color:transparent;pointer-events:none';
    document.body.appendChild(holder);
  }
  holder.focus({ preventScroll: true });
}

export function releaseKeyboard(): void {
  holder?.remove();
  holder = null;
}
