/**
 * One gesture on a mixer control (a fader drag, a held arrow key) as one
 * undo step (#843). The mixer setters join changes that carry the same
 * `gesture` id into one step; this helper makes the id, and ends the gesture
 * so that the next change starts a new one.
 *
 * Framework-free: React's sliders and dawcore's elements both use it. One
 * helper per control, so two sliders never share an id. It lives in core,
 * not beside the setters in the engine, because `<daw-editor>` loads the
 * engine with a dynamic `import()`: a value import of the engine would put
 * it back in dawcore's first bundle.
 */

export interface MixerGesture {
  /** The id to pass while a gesture is going on. */
  readonly id: string;
  /** The gesture is over: the next change starts a new one. */
  end(): void;
  /** Ends the gesture on the input's own events; returns the detach function. */
  attach(input: HTMLInputElement): () => void;
}

/**
 * The keys that move a range input. While one is down the browser repeats
 * it, and the input fires `change` on each step: the gesture lasts until the
 * key comes up.
 */
const RANGE_KEYS: ReadonlySet<string> = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'PageUp',
  'PageDown',
  'Home',
  'End',
]);

/**
 * Made once per copy of this module, so two copies of the package installed
 * side by side (each with its own counter) never make the same id.
 */
const ID_PREFIX = Math.random().toString(36).slice(2, 10);
let idCount = 0;

function nextId(): string {
  idCount += 1;
  return `mg-${ID_PREFIX}-${idCount}`;
}

/**
 * Make the gesture helper of one mixer control.
 *
 * ```ts
 * const gesture = createMixerGesture();
 * const detach = gesture.attach(slider);
 * slider.addEventListener('input', () =>
 *   engine.setTrackVolume(trackId, slider.valueAsNumber, { gesture: gesture.id })
 * );
 * ```
 *
 * `attach` ends the gesture on the input's `change` (the end of a pointer
 * drag), except while a key that moves the input is held down; then on that
 * key's `keyup`. A `blur` ends it too. Mute and solo buttons need no helper:
 * each click is a step of its own.
 */
export function createMixerGesture(): MixerGesture {
  let id = nextId();
  const end = (): void => {
    id = nextId();
  };

  const attach = (input: HTMLInputElement): (() => void) => {
    let heldKey: string | null = null;

    const onKeyDown = (event: Event): void => {
      const { key } = event as KeyboardEvent;
      if (RANGE_KEYS.has(key)) heldKey = key;
    };
    const onKeyUp = (event: Event): void => {
      if ((event as KeyboardEvent).key !== heldKey) return;
      heldKey = null;
      end();
    };
    const onChange = (): void => {
      if (heldKey === null) end();
    };
    const onBlur = (): void => {
      heldKey = null;
      end();
    };

    input.addEventListener('keydown', onKeyDown);
    input.addEventListener('keyup', onKeyUp);
    input.addEventListener('change', onChange);
    input.addEventListener('blur', onBlur);
    return () => {
      input.removeEventListener('keydown', onKeyDown);
      input.removeEventListener('keyup', onKeyUp);
      input.removeEventListener('change', onChange);
      input.removeEventListener('blur', onBlur);
    };
  };

  return {
    get id() {
      return id;
    },
    end,
    attach,
  };
}
