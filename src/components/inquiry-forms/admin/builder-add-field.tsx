"use client";

/**
 * Inquiry Forms builder - the grouped "Add field" menu.
 * A menu (no inputs), so it may close on an outside click; Escape closes it too and the
 * arrow keys move between items.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  AlignLeft,
  Building2,
  CalendarDays,
  CircleDollarSign,
  CircleDot,
  Clock,
  Hash,
  ListChecks,
  Mail,
  MapPin,
  MessageSquare,
  PartyPopper,
  Phone,
  Plus,
  SquareChevronDown,
  StickyNote,
  Type,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { FIELD_TEMPLATES, FIELD_TEMPLATE_GROUPS, type FieldTemplateId } from "./builder-catalog";
import { addFieldMenuOffset } from "./builder-add-field-position";
import { btn } from "./builder-ui";

export const TEMPLATE_ICONS: Record<FieldTemplateId, LucideIcon> = {
  full_name: User,
  email: Mail,
  phone: Phone,
  company: Building2,
  event_date: CalendarDays,
  event_time: Clock,
  event_location: MapPin,
  guest_count: Users,
  event_type: PartyPopper,
  single_choice: CircleDot,
  multiple_choice: ListChecks,
  dropdown: SquareChevronDown,
  short_text: Type,
  long_text: AlignLeft,
  number: Hash,
  budget: CircleDollarSign,
  contact_preference: MessageSquare,
  text_block: StickyNote,
};

export function AddFieldMenu({
  onAdd,
  disabled,
  label = "Add field",
  variant = "primary",
}: {
  onAdd: (templateId: FieldTemplateId) => void;
  disabled?: boolean;
  label?: string;
  variant?: "primary" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  const [offsetX, setOffsetX] = useState(0);
  const menuId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
    const onPointer = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  /** Open with the menu pulled left when it would run past the screen (phones). */
  const openMenu = () => {
    const left = buttonRef.current?.getBoundingClientRect().left ?? 0;
    setOffsetX(addFieldMenuOffset({ buttonLeft: left, viewportWidth: window.innerWidth }));
    setOpen(true);
  };

  const close = (focusButton: boolean) => {
    setOpen(false);
    if (focusButton) buttonRef.current?.focus();
  };

  const onMenuKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? []);
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      items[(i + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === "Tab") {
      close(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        className={variant === "primary" ? btn.primary : btn.secondary}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            openMenu();
          }
        }}
      >
        <Plus className="h-4 w-4" aria-hidden /> {label}
      </button>
      {open ? (
        <div
          id={menuId}
          ref={menuRef}
          role="menu"
          aria-label="Add a field"
          onKeyDown={onMenuKeyDown}
          style={offsetX ? { left: offsetX } : undefined}
          className="absolute left-0 top-full z-40 mt-1.5 grid w-[min(34rem,calc(100vw-2.5rem))] grid-cols-1 gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] backdrop-blur-md p-3 text-[var(--foreground)] shadow-2xl sm:grid-cols-2"
        >
          {FIELD_TEMPLATE_GROUPS.map((group) => (
            <div key={group.id} role="group" aria-labelledby={`${menuId}-${group.id}`} className="min-w-0">
              <p
                id={`${menuId}-${group.id}`}
                className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]"
              >
                {group.label}
              </p>
              <div className="flex flex-col">
                {group.templates.map((id) => {
                  const t = FIELD_TEMPLATES[id];
                  const Icon = TEMPLATE_ICONS[id];
                  return (
                    <button
                      key={id}
                      type="button"
                      role="menuitem"
                      tabIndex={-1}
                      onClick={() => {
                        close(false);
                        onAdd(id);
                      }}
                      className="flex min-w-0 items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-[var(--surface-hover)] focus-visible:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand)]" aria-hidden />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{t.label}</span>
                        <span className="block truncate text-xs text-[var(--muted)]">{t.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
