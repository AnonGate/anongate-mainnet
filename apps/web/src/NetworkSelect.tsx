import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import {
  PRODUCT_NETWORKS,
  type ProductNetworkId,
} from "./networkConfig";

type Props = {
  id: string;
  value: ProductNetworkId;
  onChange: (id: ProductNetworkId) => void;
  disabled?: boolean;
};

function EthMark() {
  return (
    <img
      className="net-select-icon"
      src="/tokens/eth.svg"
      alt=""
      width={16}
      height={16}
      draggable={false}
    />
  );
}

export function NetworkSelect(props: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const selected =
    PRODUCT_NETWORKS.find((n) => n.id === props.value) ?? PRODUCT_NETWORKS[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    const root = rootRef.current;
    if (!menu || !root) return;

    const place = () => {
      const rect = root.getBoundingClientRect();
      const gutter = 12;
      const maxW = Math.min(280, window.innerWidth - gutter * 2);
      let left = (rect.width - maxW) / 2;
      const minLeft = gutter - rect.left;
      const maxLeft = window.innerWidth - gutter - maxW - rect.left;
      left = Math.max(minLeft, Math.min(left, maxLeft));
      menu.style.position = "absolute";
      menu.style.top = `${root.offsetHeight + 6}px`;
      menu.style.left = `${left}px`;
      menu.style.right = "auto";
      menu.style.width = `${maxW}px`;
      menu.style.maxWidth = `${window.innerWidth - gutter * 2}px`;
      menu.style.transform = "none";
    };

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  return (
    <div
      className={`net-select is-${selected.tone}${open ? " is-open" : ""}`}
      ref={rootRef}
    >
      <button
        type="button"
        id={props.id}
        className="net-select-trigger"
        disabled={props.disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Network: Ethereum ${selected.shortLabel}, ${selected.badge}`}
        onClick={() => setOpen((v) => !v)}
      >
        <EthMark />
        <span className="net-select-label">{selected.shortLabel}</span>
        <span className={`net-select-badge net-select-badge-trigger is-${selected.tone}`}>
          {selected.badge}
        </span>
        <span className="net-select-caret" aria-hidden />
      </button>
      {open ? (
        <ul
          id={listId}
          ref={menuRef}
          className="net-select-menu"
          role="listbox"
        >
          {PRODUCT_NETWORKS.map((n) => {
            const active = n.id === selected.id;
            return (
              <li key={n.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`net-select-option is-${n.tone}${active ? " is-active" : ""}`}
                  onClick={() => {
                    props.onChange(n.id);
                    setOpen(false);
                  }}
                >
                  <span className={`net-select-dot is-${n.tone}`} aria-hidden />
                  <span className="net-select-option-copy">
                    <span className="net-select-option-title">
                      {n.shortLabel}
                    </span>
                    <span className="net-select-option-sub">{n.detail}</span>
                  </span>
                  <span className={`net-select-badge is-${n.tone}`}>
                    {n.badge}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
