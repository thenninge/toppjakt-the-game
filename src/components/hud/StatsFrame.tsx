"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { PlayerStats } from "@/lib/player";

type StatsFrameProps = {
  stats: PlayerStats;
  onRename?: (nextName: string) => string | null;
  onDeleteUser?: () => void;
};

function formatRange(meters: number): string {
  if (meters <= 0) return "—";
  return `${meters} m`;
}

type MenuView = "closed" | "root" | "edit" | "rename";

/** Compact sticky hunter strip — keeps main content visible. */
export function StatsFrame({
  stats,
  onRename,
  onDeleteUser,
}: StatsFrameProps) {
  const [menu, setMenu] = useState<MenuView>("closed");
  const [renameValue, setRenameValue] = useState(stats.name);
  const [renameError, setRenameError] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (menu === "closed") return;
    function onDoc(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenu("closed");
        setRenameError("");
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenu("closed");
        setRenameError("");
      }
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  function openRename() {
    setRenameValue(stats.name);
    setRenameError("");
    setMenu("rename");
  }

  function submitRename(e: FormEvent) {
    e.preventDefault();
    if (!onRename) return;
    const err = onRename(renameValue);
    if (err) {
      setRenameError(err);
      return;
    }
    setRenameError("");
    setMenu("closed");
  }

  return (
    <aside className="stats-frame" aria-label="Player stats">
      <div className="stats-frame-head">
        <div className="stats-frame-title">Hunter Status</div>
        {onRename || onDeleteUser ? (
          <div className="stats-frame-menu" ref={menuRef}>
            <button
              type="button"
              className={
                menu !== "closed"
                  ? "stats-menu-btn is-open"
                  : "stats-menu-btn"
              }
              aria-label="Jeger-meny"
              aria-haspopup="menu"
              aria-expanded={menu !== "closed"}
              onClick={() =>
                setMenu((m) => (m === "closed" ? "root" : "closed"))
              }
            >
              <span className="stats-menu-burger" aria-hidden>
                <span />
                <span />
                <span />
              </span>
            </button>
            {menu === "root" ? (
              <div className="stats-menu-panel" role="menu">
                <button
                  type="button"
                  className="stats-menu-item"
                  role="menuitem"
                  onClick={() => setMenu("edit")}
                >
                  Edit
                </button>
              </div>
            ) : null}
            {menu === "edit" ? (
              <div className="stats-menu-panel" role="menu">
                <p className="stats-menu-heading">Edit</p>
                {onRename ? (
                  <button
                    type="button"
                    className="stats-menu-item"
                    role="menuitem"
                    onClick={openRename}
                  >
                    Endre navn
                  </button>
                ) : null}
                {onDeleteUser ? (
                  <button
                    type="button"
                    className="stats-menu-item is-danger"
                    role="menuitem"
                    onClick={() => {
                      setMenu("closed");
                      onDeleteUser();
                    }}
                  >
                    Slett jeger
                  </button>
                ) : null}
                <button
                  type="button"
                  className="stats-menu-item is-muted"
                  role="menuitem"
                  onClick={() => setMenu("root")}
                >
                  ← Tilbake
                </button>
              </div>
            ) : null}
            {menu === "rename" ? (
              <div className="stats-menu-panel stats-menu-rename" role="dialog">
                <p className="stats-menu-heading">Endre navn</p>
                <form onSubmit={submitRename}>
                  <input
                    className="stats-rename-input"
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={24}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    aria-label="Nytt jegernavn"
                  />
                  {renameError ? (
                    <p className="stats-rename-error">{renameError}</p>
                  ) : null}
                  <div className="stats-rename-actions">
                    <button
                      type="button"
                      className="stats-menu-item is-muted"
                      onClick={() => {
                        setMenu("edit");
                        setRenameError("");
                      }}
                    >
                      Avbryt
                    </button>
                    <button type="submit" className="stats-menu-item">
                      Lagre
                    </button>
                  </div>
                </form>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <dl className="stats-grid">
        <div className="stats-item">
          <dt>Navn</dt>
          <dd>{stats.name || "—"}</dd>
        </div>
        <div className="stats-item">
          <dt>Nick</dt>
          <dd>{stats.nickname ? `"${stats.nickname}"` : "—"}</dd>
        </div>
        <div className="stats-item">
          <dt>Konto</dt>
          <dd>{stats.balance.toLocaleString("nb-NO")} kr</dd>
        </div>
        <div className="stats-item">
          <dt>Orrhaner</dt>
          <dd>{stats.lifetimeOrrhaner}</dd>
        </div>
        <div className="stats-item">
          <dt>Tiur</dt>
          <dd>{stats.lifetimeTiur}</dd>
        </div>
        <div className="stats-item">
          <dt>Max Range</dt>
          <dd>{formatRange(stats.maxRange)}</dd>
        </div>
      </dl>
    </aside>
  );
}
