import React, { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { DotsIcon } from './TrackControls/DotsIcon';

export interface TrackMenuItem {
  id: string;
  label?: string;
  content: ReactNode;
}

export interface TrackMenuProps {
  items: TrackMenuItem[] | ((onClose: () => void) => TrackMenuItem[]);
}

const MenuContainer = styled.div`
  position: relative;
  display: inline-block;
`;

const MenuButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: inherit;
  opacity: 0.7;

  &:hover {
    opacity: 1;
  }
`;

const DROPDOWN_MIN_WIDTH = 180;

interface DropdownProps {
  readonly $top: number;
  readonly $left: number;
}

// Position is an inline style: it changes on every scroll frame while the menu is
// open, and a template interpolation would generate a CSS class per position.
const Dropdown = styled.div.attrs<DropdownProps>((p) => ({
  style: { top: `${p.$top}px`, left: `${p.$left}px` },
}))<DropdownProps>`
  position: fixed;
  z-index: 10000;
  background: ${(p) => p.theme.timescaleBackgroundColor ?? '#222'};
  color: ${(p) => p.theme.textColor ?? 'inherit'};
  border: 1px solid rgba(128, 128, 128, 0.4);
  border-radius: 6px;
  padding: 0.5rem 0;
  min-width: ${DROPDOWN_MIN_WIDTH}px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
`;

const Divider = styled.hr`
  border: none;
  border-top: 1px solid rgba(128, 128, 128, 0.3);
  margin: 0.35rem 0;
`;

export const TrackMenu: React.FC<TrackMenuProps> = ({ items: itemsProp }) => {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const items = typeof itemsProp === 'function' ? itemsProp(close) : itemsProp;
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const dropHeight = dropdownRef.current?.offsetHeight ?? 160;

    // Prefer opening to the right of the button
    let left = rect.right + 4;
    if (left + DROPDOWN_MIN_WIDTH > vw) {
      left = rect.left - DROPDOWN_MIN_WIDTH - 4;
    }
    left = Math.max(4, Math.min(left, vw - DROPDOWN_MIN_WIDTH - 4));

    // Align top with the button, push up if it would overflow viewport
    let top = rect.top;
    if (top + dropHeight > vh - 4) {
      top = Math.max(4, rect.bottom - dropHeight);
    }

    setDropdownPos((prev) => (prev.top === top && prev.left === left ? prev : { top, left }));
  }, []);

  // Position on open, refine after mount, reposition on scroll/resize
  useEffect(() => {
    if (!open) return;
    updatePosition();

    // At most one measurement per animation frame, however many scroll or resize
    // events arrive in between.
    let frameId: number | null = null;
    const scheduleUpdate = () => {
      if (frameId !== null) return;
      frameId = requestAnimationFrame(() => {
        frameId = null;
        updatePosition();
      });
    };

    // Measure again on the next frame, once the dropdown has been laid out
    scheduleUpdate();

    // Capture phase: scroll events don't bubble, and the scrolling ancestor may be
    // any element. Passive: the handler never calls preventDefault.
    const scrollOptions = { capture: true, passive: true };
    window.addEventListener('scroll', scheduleUpdate, scrollOptions);
    window.addEventListener('resize', scheduleUpdate);
    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      window.removeEventListener('scroll', scheduleUpdate, scrollOptions);
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [open, updatePosition]);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <MenuContainer>
      <MenuButton
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        title="Track menu"
        aria-label="Track menu"
      >
        <DotsIcon size={16} />
      </MenuButton>
      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <Dropdown
            ref={dropdownRef}
            $top={dropdownPos.top}
            $left={dropdownPos.left}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {items.map((item, index) => (
              <React.Fragment key={item.id}>
                {index > 0 && <Divider />}
                {item.content}
              </React.Fragment>
            ))}
          </Dropdown>,
          document.body
        )}
    </MenuContainer>
  );
};
