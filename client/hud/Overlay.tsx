import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type OverlayVariant = "modal" | "bottom" | "side" | "popover";
const stack: HTMLElement[] = [];
let originalOverflow = "";
let originalInert = false;
/** One interaction policy for every HUD overlay, including nested inspection. */
export function Overlay({
  title,
  children,
  onClose,
  mandatory = false,
  variant = "modal",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  mandatory?: boolean;
  variant?: OverlayVariant;
}) {
  const ref = useRef<HTMLElement>(null),
    close = useRef(onClose),
    required = useRef(mandatory),
    id = useId();
  close.current = onClose;
  required.current = mandatory;
  useEffect(() => {
    const dialog = ref.current!,
      previous = document.activeElement as HTMLElement | null;
    if (!stack.length) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const app = document.getElementById("root");
      if (app) {
        originalInert = app.inert;
        app.inert = true;
      }
    }
    stack.push(dialog);
    const focusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]',
        ),
      ).filter(
        (el) =>
          !el.closest("[hidden]") &&
          (!el.closest("details:not([open])") || el.tagName === "SUMMARY"),
      );
    (focusable()[0] ?? dialog).focus();
    const key = (e: KeyboardEvent) => {
      if (stack.at(-1) !== dialog) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (!required.current) close.current();
      }
      if (e.key === "Tab") {
        const all = focusable(),
          first = all[0],
          last = all.at(-1);
        if (!first) {
          e.preventDefault();
          dialog.focus();
        } else if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === dialog)
        ) {
          e.preventDefault();
          last!.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            !dialog.contains(document.activeElement))
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    const focus = (e: FocusEvent) => {
      if (stack.at(-1) === dialog && !dialog.contains(e.target as Node))
        (focusable()[0] ?? dialog).focus();
    };
    document.addEventListener("keydown", key, true);
    document.addEventListener("focusin", focus);
    return () => {
      stack.splice(stack.indexOf(dialog), 1);
      document.removeEventListener("keydown", key, true);
      document.removeEventListener("focusin", focus);
      if (!stack.length) {
        document.body.style.overflow = originalOverflow;
        const app = document.getElementById("root");
        if (app) app.inert = originalInert;
      }
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return createPortal(
    <div
      className={"hud-backdrop hud-backdrop--" + variant}
      onMouseDown={(e) => {
        if (
          e.target === e.currentTarget &&
          !mandatory &&
          stack.at(-1) === ref.current
        )
          onClose();
      }}
    >
      <section
        ref={ref}
        className={"hud-overlay hud-overlay--" + variant}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
      >
        <div className="hud-overlay-heading">
          <h2 id={id}>{title}</h2>
          {!mandatory && (
            <button onClick={onClose} aria-label="ปิด / Close">
              ×
            </button>
          )}
        </div>
        <div className="hud-overlay-content">{children}</div>
      </section>
    </div>,
    document.body,
  );
}
