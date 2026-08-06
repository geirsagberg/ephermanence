import type { CSSProperties } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { css } from '../../styled-system/css';
import type { ThoughtAuthoringPresentation } from '../spatialFieldScene';

export type DraftPosition = { x: number; y: number };

type SpatialThoughtComposerProps = {
  dismissOnCancel?: boolean;
  cancelTargetScale?: number;
  openScale?: number;
  position: DraftPosition;
  initialText?: string;
  label?: string;
  visualId: string;
  tone: number;
  elevation: ThoughtAuthoringPresentation['elevation'];
  onCancel: () => void;
  onExitComplete: () => void;
  onKeep: (text: string) => void;
  onVisualChange: (presentation?: ThoughtAuthoringPresentation) => void;
  targetScaleForText: (text: string) => number;
};

export function SpatialThoughtComposer({
  dismissOnCancel = false,
  cancelTargetScale = 0.25,
  openScale = 0.25,
  position,
  initialText = '',
  label = 'New thought at this position',
  visualId,
  tone,
  elevation,
  onCancel,
  onExitComplete,
  onKeep,
  onVisualChange,
  targetScaleForText,
}: SpatialThoughtComposerProps) {
  const [text, setText] = useState(initialText);
  const [exit, setExit] = useState<'cancel-close' | 'cancel-dismiss' | 'keep' | null>(
    null,
  );
  const [closeScale, setCloseScale] = useState(0.25);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const savedRef = useRef(false);
  const pendingTextRef = useRef('');

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus();
    const end = textarea.value.length;
    textarea.setSelectionRange(end, end);
  }, []);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = '0';
    const contentHeight = Math.ceil(textarea.scrollHeight);
    textarea.style.height = `${Math.min(contentHeight, 112)}px`;
    textarea.style.overflowY = contentHeight > 112 ? 'auto' : 'hidden';
  }, [text]);

  useLayoutEffect(() => {
    onVisualChange({
      id: visualId,
      position,
      tone,
      openScale,
      phase: exit ?? 'open',
      closeScale,
      text:
        exit === 'keep'
          ? pendingTextRef.current
          : exit === 'cancel-close'
            ? initialText
            : undefined,
      elevation,
    });
  }, [
    closeScale,
    elevation,
    exit,
    initialText,
    onVisualChange,
    openScale,
    position,
    tone,
    visualId,
  ]);

  useLayoutEffect(() => () => onVisualChange(), [onVisualChange]);

  const keep = useCallback(() => {
    const next = text.trim();
    if (!next || savedRef.current) return;
    savedRef.current = true;
    pendingTextRef.current = next;
    setCloseScale(targetScaleForText(next));
    setExit('keep');
  }, [targetScaleForText, text]);

  const cancel = useCallback(() => {
    if (savedRef.current) return;
    savedRef.current = true;
    if (!dismissOnCancel) setCloseScale(cancelTargetScale);
    setExit(dismissOnCancel ? 'cancel-dismiss' : 'cancel-close');
  }, [cancelTargetScale, dismissOnCancel]);

  useEffect(() => {
    if (!exit) return;
    const suppressClick = (event: MouseEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    window.addEventListener('click', suppressClick, true);
    return () => window.removeEventListener('click', suppressClick, true);
  }, [exit]);

  useEffect(() => {
    const saveOnTapAway = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || formRef.current?.contains(target)) return;
      event.preventDefault();
      event.stopPropagation();
      if (text.trim()) {
        keep();
      } else {
        cancel();
      }
    };
    window.addEventListener('pointerdown', saveOnTapAway, true);
    return () => window.removeEventListener('pointerdown', saveOnTapAway, true);
  }, [cancel, keep, text]);

  return (
    <form
      ref={formRef}
      className={composerClass}
      data-exit={exit ?? undefined}
      style={
        {
          left: position.x,
          top: position.y,
          '--composer-open-scale': openScale,
          '--composer-close-scale': closeScale,
        } as CSSProperties &
          Record<'--composer-open-scale' | '--composer-close-scale', string | number>
      }
      onSubmit={(event) => {
        event.preventDefault();
        keep();
      }}
      onAnimationEnd={() => {
        if (!exit) return;
        if (exit === 'keep') onKeep(pendingTextRef.current);
        else onCancel();
        onExitComplete();
      }}
    >
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            cancel();
          }
          if (
            event.key === 'Enter' &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            keep();
          }
        }}
        placeholder="A thought…"
        maxLength={220}
        rows={1}
        aria-label={label}
      />
    </form>
  );
}

const composerClass = css({
  position: 'fixed',
  zIndex: 10,
  display: 'grid',
  width: '210px',
  height: '210px',
  placeItems: 'center',
  padding: '28px',
  border: 0,
  borderRadius: '50%',
  background: 'transparent',
  transform: 'translate(-50%, -50%)',
  animation: 'composerBloom 240ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
  '&[data-exit]': {
    pointerEvents: 'none',
  },
  '&[data-exit="cancel-dismiss"]': {
    animation: 'composerDismiss 180ms ease-in both',
  },
  '&[data-exit="cancel-close"], &[data-exit="keep"]': {
    animation: 'composerClose 200ms cubic-bezier(0.4, 0, 0.2, 1) both',
  },
  '& textarea': {
    width: '100%',
    height: 'auto',
    maxHeight: '112px',
    overflowY: 'hidden',
    padding: 0,
    border: 0,
    background: 'transparent',
    color: '#26312d',
    fontFamily: 'serif',
    fontSize: '18px',
    lineHeight: 1.18,
    textAlign: 'center',
    outline: 0,
    resize: 'none',
    '&::placeholder': {
      color: 'rgb(38 49 45 / 38%)',
    },
  },
});
