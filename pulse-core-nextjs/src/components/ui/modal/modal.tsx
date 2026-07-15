'use client';

import {
  type MouseEventHandler,
  type PropsWithChildren,
  type RefObject,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

type ModalContextValue = {
  open: boolean;
  setOpen: (next: boolean) => void;
  contentId: string;
  titleId?: string;
  descriptionId?: string;
  registerTitleId: (id: string | undefined) => void;
  registerDescriptionId: (id: string | undefined) => void;
};

const ModalContext = createContext<ModalContextValue | null>(null);

function useModalContext() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('Modal components must be used within <Modal>.');
  return ctx;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusable(container: HTMLElement) {
  const nodes = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return nodes.filter((el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));
}

function lockScroll() {
  const doc = document.documentElement;
  const body = document.body;
  const previousOverflow = body.style.overflow;
  const previousPaddingRight = body.style.paddingRight;
  const scrollbarWidth = window.innerWidth - doc.clientWidth;
  body.style.overflow = 'hidden';
  if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
  return () => {
    body.style.overflow = previousOverflow;
    body.style.paddingRight = previousPaddingRight;
  };
}

export type ModalProps = PropsWithChildren<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>;

export function Modal({ open, onOpenChange, children }: Readonly<ModalProps>) {
  const contentId = useId();
  const [titleId, setTitleId] = useState<string | undefined>(undefined);
  const [descriptionId, setDescriptionId] = useState<string | undefined>(undefined);

  const registerTitleId = useCallback((id: string | undefined) => setTitleId(id), [setTitleId]);
  const registerDescriptionId = useCallback((id: string | undefined) => setDescriptionId(id), [setDescriptionId]);

  const value = useMemo<ModalContextValue>(
    () => ({
      open,
      setOpen: onOpenChange,
      contentId,
      titleId,
      descriptionId,
      registerTitleId,
      registerDescriptionId,
    }),
    [open, onOpenChange, contentId, titleId, descriptionId, registerTitleId, registerDescriptionId],
  );

  return <ModalContext.Provider value={value}>{children}</ModalContext.Provider>;
}

export type ModalPortalProps = PropsWithChildren<{
  /** Override portal container; defaults to document.body */
  container?: Element | null;
}>;

export function ModalPortal({ container, children }: Readonly<ModalPortalProps>) {
  const { open } = useModalContext();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Defer setState to avoid synchronous setState in effect
    setTimeout(() => setMounted(true), 0);
  }, []);

  if (!open || !mounted) return null;
  const target = container ?? document.body;
  return createPortal(children, target);
}

export type ModalOverlayProps = {
  className?: string;
  /** If true, clicking the backdrop closes the modal. */
  closeOnClick?: boolean;
};

export function ModalOverlay({ className, closeOnClick = true }: Readonly<ModalOverlayProps>) {
  const { open, setOpen, contentId } = useModalContext();
  if (!open) return null;

  return (
    <div
      aria-hidden="true"
      data-modal-overlay=""
      className={cn('fixed inset-0 z-[100]', className)}
      onMouseDown={(e) => {
        if (!closeOnClick) return;
        // Only close when the actual overlay is clicked, not bubbled from content.
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      {/* keep overlay focusable for some SR/keyboard combos; content will take focus */}
      <span className="sr-only" id={`${contentId}-overlay`}>
        Modal backdrop
      </span>
    </div>
  );
}

export type ModalContentProps = PropsWithChildren<{
  className?: string;
  /** If true, pressing Escape closes the modal. */
  closeOnEscape?: boolean;
  /** Provide the element to receive focus on open (preferred). */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** If provided, finds first matching element in content and focuses it. */
  initialFocusSelector?: string;
  /** Called when the modal closes via escape/backdrop (not via explicit buttons). */
  onRequestClose?: () => void;
}>;

export function ModalContent({
  className,
  closeOnEscape = true,
  initialFocusRef,
  initialFocusSelector,
  onRequestClose,
  children,
}: Readonly<ModalContentProps>) {
  const { open, setOpen, contentId, titleId, descriptionId } = useModalContext();
  const contentRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Scroll lock + focus restore
  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const unlock = lockScroll();
    return () => {
      unlock();
      // Restore focus to the opener (or last focused) after close.
      restoreFocusRef.current?.focus?.();
      restoreFocusRef.current = null;
    };
  }, [open]);

  // Initial focus
  useLayoutEffect(() => {
    if (!open) return;
    const content = contentRef.current;
    if (!content) return;

    const target =
      initialFocusRef?.current ??
      (initialFocusSelector ? (content.querySelector(initialFocusSelector) as HTMLElement | null) : null) ??
      getFocusable(content)[0] ??
      content;

    target?.focus?.();
  }, [open, initialFocusRef, initialFocusSelector]);

  // Escape + focus trap
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (!contentRef.current) return;

      if (event.key === 'Escape' && closeOnEscape) {
        event.preventDefault();
        onRequestClose?.();
        setOpen(false);
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = getFocusable(contentRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        contentRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || !contentRef.current.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, closeOnEscape, onRequestClose, setOpen]);

  if (!open) return null;

  return (
    <div
      id={contentId}
      ref={contentRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      tabIndex={-1}
      data-modal-content=""
      className={cn('fixed z-[101] outline-none', className)}
      onMouseDown={(e) => {
        // prevent overlay handler from seeing content clicks
        e.stopPropagation();
      }}
    >
      {children}
    </div>
  );
}

export type ModalTitleProps = PropsWithChildren<{ className?: string }>;
export function ModalTitle({ className, children }: Readonly<ModalTitleProps>) {
  const id = useId();
  const { registerTitleId } = useModalContext();
  useEffect(() => {
    registerTitleId(id);
    return () => registerTitleId(undefined);
  }, [id, registerTitleId]);
  return (
    <h2 id={id} className={className}>
      {children}
    </h2>
  );
}

export type ModalDescriptionProps = PropsWithChildren<{ className?: string }>;
export function ModalDescription({ className, children }: Readonly<ModalDescriptionProps>) {
  const id = useId();
  const { registerDescriptionId } = useModalContext();
  useEffect(() => {
    registerDescriptionId(id);
    return () => registerDescriptionId(undefined);
  }, [id, registerDescriptionId]);
  return (
    <p id={id} className={className}>
      {children}
    </p>
  );
}

export type ModalCloseProps = PropsWithChildren<{
  className?: string;
  'aria-label'?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}>;

export function ModalClose({ className, children, ...props }: Readonly<ModalCloseProps>) {
  const { setOpen } = useModalContext();
  return (
    <button
      type="button"
      {...props}
      className={className}
      onClick={(e) => {
        props.onClick?.(e as any);
        setOpen(false);
      }}
    >
      {children}
    </button>
  );
}

