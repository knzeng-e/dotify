import { describe, expect, it, vi } from 'vitest';
import { createSheetHistory } from './sheetHistory';
import { historyStateObject, SHEET_HISTORY_KEY } from './routing';

function fixture() {
  const entries: unknown[] = [{ dotifyView: 'listen' }, { dotifyView: 'player', unrelated: 'preserved' }];
  let index = 1;
  const tasks: (() => void)[] = [];
  const history = {
    get state() {
      return entries[index];
    },
    pushState(state: unknown) {
      entries.splice(++index, entries.length, state);
    },
    replaceState(state: unknown) {
      entries[index] = state;
    },
    back: vi.fn()
  };
  const sheets = createSheetHistory(
    history,
    () => 'https://dotify.example/',
    task => tasks.push(task)
  );
  return {
    history,
    sheets,
    flush() {
      while (tasks.length) tasks.shift()!();
    },
    pop() {
      index--;
      sheets.onPop();
    },
    forward() {
      index++;
      sheets.onPop();
    },
    length: () => entries.length
  };
}

describe('contextual sheet history', () => {
  it('Back closes the sheet on the underlying page and Forward does not revive it', () => {
    const f = fixture();
    const close = vi.fn();
    const release = f.sheets.open(close);
    expect(f.history.state).toMatchObject({ dotifyView: 'player', unrelated: 'preserved' });
    f.pop();
    expect(close).toHaveBeenCalledOnce();
    release();
    f.flush();
    expect(f.history.back).not.toHaveBeenCalled();
    f.forward();
    expect(f.history.state).not.toHaveProperty(SHEET_HISTORY_KEY);
  });

  it('manual close removes the transient entry once', () => {
    const f = fixture();
    f.sheets.open(vi.fn())();
    f.flush();
    expect(f.history.back).toHaveBeenCalledOnce();
    f.pop();
    f.flush();
    expect(f.history.state).toEqual({ dotifyView: 'player', unrelated: 'preserved' });
  });

  it('effect replay and sheet replacement reuse a single entry', () => {
    const f = fixture();
    const firstClose = vi.fn();
    const secondClose = vi.fn();
    f.sheets.open(firstClose)();
    f.sheets.open(secondClose);
    f.flush();
    expect(f.length()).toBe(3);
    expect(f.history.back).not.toHaveBeenCalled();
    f.pop();
    expect(firstClose).not.toHaveBeenCalled();
    expect(secondClose).toHaveBeenCalledOnce();
  });

  it('waits for an in-flight close before attaching a quickly reopened sheet', () => {
    const f = fixture();
    f.sheets.open(vi.fn())();
    f.flush();
    const close = vi.fn();
    f.sheets.open(close);
    f.pop();
    f.flush();
    expect(close).not.toHaveBeenCalled();
    expect(f.history.state).toHaveProperty(SHEET_HISTORY_KEY);
    f.pop();
    expect(close).toHaveBeenCalledOnce();
  });

  it('does not undo an explicit destination change during dismissal', () => {
    const f = fixture();
    const release = f.sheets.open(vi.fn());
    f.history.pushState({ ...historyStateObject(f.history.state), dotifyView: 'you' });
    release();
    f.flush();
    expect(f.history.back).not.toHaveBeenCalled();
    expect(f.history.state).toEqual({ dotifyView: 'you', unrelated: 'preserved' });
  });

  it('still permits manual dismissal when the host rejects history writes', () => {
    const f = fixture();
    vi.spyOn(f.history, 'pushState').mockImplementation(() => {
      throw new Error('Host restriction');
    });
    expect(() => f.sheets.open(vi.fn())()).not.toThrow();
    f.flush();
    expect(f.history.back).not.toHaveBeenCalled();
  });
});
