import { useCallback, useRef, useState, useEffect } from "react";

export function useHistory<T>(initial: T, max = 50) {
  const [state, setStateInternal] = useState<T>(initial);
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const skipHistory = useRef(false);

  const set = useCallback((next: T | ((p: T) => T), record = true) => {
    setStateInternal((prev) => {
      const value = typeof next === "function" ? (next as any)(prev) : next;
      if (record && !skipHistory.current) {
        past.current.push(prev);
        if (past.current.length > max) past.current.shift();
        future.current = [];
      }
      return value;
    });
  }, [max]);

  const undo = useCallback(() => {
    if (!past.current.length) return;
    const prev = past.current.pop()!;
    setStateInternal((curr) => {
      future.current.push(curr);
      return prev;
    });
  }, []);

  const redo = useCallback(() => {
    if (!future.current.length) return;
    const next = future.current.pop()!;
    setStateInternal((curr) => {
      past.current.push(curr);
      return next;
    });
  }, []);

  const reset = useCallback((v: T) => {
    past.current = [];
    future.current = [];
    setStateInternal(v);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  return { state, set, undo, redo, reset, canUndo: past.current.length > 0, canRedo: future.current.length > 0 };
}
