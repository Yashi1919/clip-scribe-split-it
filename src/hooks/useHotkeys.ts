
import { useEffect, RefObject } from 'react';

interface HotkeyAction {
  key: string;
  callback: () => void;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}

/**
 * Hook for handling keyboard shortcuts
 * @param actions Array of hotkey actions to register
 * @param targetRef Optional ref to restrict hotkey scope
 */
export const useHotkeys = (
  actions: HotkeyAction[],
  targetRef?: RefObject<HTMLElement>
) => {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      // If we have a target ref and it's not the active element, ignore
      if (targetRef?.current && !targetRef.current.contains(document.activeElement)) {
        return;
      }

      // Check if we're in an input, textarea, or contentEditable element
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Find matching hotkey action
      const action = actions.find(
        (a) =>
          a.key === event.key &&
          (a.ctrlKey === undefined || a.ctrlKey === event.ctrlKey) &&
          (a.altKey === undefined || a.altKey === event.altKey) &&
          (a.shiftKey === undefined || a.shiftKey === event.shiftKey)
      );

      if (action) {
        event.preventDefault();
        action.callback();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [actions, targetRef]);
};
