import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useCompactLayout } from '../../hooks/useCompactLayout';

interface ResponsivePanelProps {
  label: string;
  onClose: () => void;
  onMobileOpenChange?: (open: boolean) => void;
  className: string;
  desktopClassName: string;
  as?: 'div' | 'aside';
  children: React.ReactNode;
}

/** Keep desktop popovers; give phone panels their own bounded, scrollable surface. */
export function ResponsivePanel({ label, onClose, onMobileOpenChange, className, desktopClassName, as: Element = 'div', children }: ResponsivePanelProps) {
  const compact = useCompactLayout();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef(onClose);
  const notifyRef = useRef(onMobileOpenChange);
  closeRef.current = onClose;
  notifyRef.current = onMobileOpenChange;

  useEffect(() => {
    if (compact) return;
    const fit = () => {
      const panel = panelRef.current;
      if (panel) panel.style.maxHeight = `${Math.max(0, window.innerHeight - panel.getBoundingClientRect().top - 12)}px`;
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [compact]);

  useEffect(() => {
    if (!compact) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const notify = notifyRef.current;
    notify?.(true);
    const panel = panelRef.current;
    const focusable = () => Array.from(panel?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ) ?? []).filter((node) => node.getClientRects().length > 0);
    (panel?.querySelector<HTMLElement>('[data-panel-close]') ?? focusable()[0] ?? panel)?.focus();

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      } else if (event.key === 'Tab') {
        const items = focusable();
        const first = items[0];
        const last = items[items.length - 1];
        if (!first) { event.preventDefault(); panel?.focus(); return; }
        if (!panel?.contains(document.activeElement) || (event.shiftKey && document.activeElement === first)) {
          event.preventDefault(); (event.shiftKey ? last : first).focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }
    };
    const viewport = window.visualViewport;
    const fitViewport = () => {
      const backdrop = backdropRef.current;
      if (!backdrop) return;
      backdrop.style.top = `${viewport?.offsetTop ?? 0}px`;
      backdrop.style.left = `${viewport?.offsetLeft ?? 0}px`;
      backdrop.style.width = `${viewport?.width ?? window.innerWidth}px`;
      backdrop.style.height = `${viewport?.height ?? window.innerHeight}px`;
    };
    fitViewport();
    document.addEventListener('keydown', handleKey, true);
    window.addEventListener('resize', fitViewport);
    viewport?.addEventListener('resize', fitViewport);
    viewport?.addEventListener('scroll', fitViewport);
    return () => {
      notify?.(false);
      document.removeEventListener('keydown', handleKey, true);
      window.removeEventListener('resize', fitViewport);
      viewport?.removeEventListener('resize', fitViewport);
      viewport?.removeEventListener('scroll', fitViewport);
      if (opener?.isConnected) opener.focus();
    };
  }, [compact]);

  const surface = (
    <Element
      ref={panelRef}
      role={compact ? 'dialog' : undefined}
      aria-modal={compact ? true : undefined}
      aria-label={label}
      tabIndex={compact ? -1 : undefined}
      className={`${className} ${compact ? 'temple-mobile-panel' : `temple-desktop-panel ${desktopClassName}`}`}
    >
      {children}
    </Element>
  );

  return compact ? createPortal(
    <div ref={backdropRef} className="temple-mobile-backdrop" onPointerDown={(event) => {
      if (event.target === event.currentTarget) closeRef.current();
    }}>{surface}</div>, document.body
  ) : surface;
}
