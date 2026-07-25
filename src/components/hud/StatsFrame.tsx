"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { PlayerStats } from "@/lib/player";
import {
  birdsPerKm,
  formatBirdsPerKm,
  formatLifetimeDistance,
} from "@/lib/playerSave";

const ADMIN_PIN = "9898";

type StatsFrameProps = {
  stats: PlayerStats;
  onRename?: (nextName: string) => string | null;
  onDeleteUser?: () => void;
  /** Google / CBAware account status. */
  authEmail?: string | null;
  onGoogleLogin?: () => void;
  onGoogleLogout?: () => void;
  /** Admin mode unlock (PIN) — shows Admin office in town. */
  adminUnlocked?: boolean;
  onAdminUnlock?: () => void;
  onAdminLock?: () => void;
};

function formatRange(meters: number): string {
  if (meters <= 0) return "—";
  return `${meters} m`;
}

type MenuView = "closed" | "root" | "edit" | "rename" | "admin-pin";

/** Compact sticky hunter strip — keeps main content visible. */
export function StatsFrame({
  stats,
  onRename,
  onDeleteUser,
  authEmail,
  onGoogleLogin,
  onGoogleLogout,
  adminUnlocked = false,
  onAdminUnlock,
  onAdminLock,
}: StatsFrameProps) {
  const [menu, setMenu] = useState<MenuView>("closed");
  const [renameValue, setRenameValue] = useState(stats.name);
  const [renameError, setRenameError] = useState("");
  const [adminPin, setAdminPin] = useState("");
  const [adminPinError, setAdminPinError] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const hasMenu =
    !!onRename ||
    !!onDeleteUser ||
    !!onGoogleLogin ||
    !!onGoogleLogout ||
    !!onAdminUnlock;

  useEffect(() => {
    if (menu === "closed") return;
    function onDoc(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenu("closed");
        setRenameError("");
        setAdminPin("");
        setAdminPinError("");
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenu("closed");
        setRenameError("");
        setAdminPin("");
        setAdminPinError("");
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

  function submitAdminPin(e: FormEvent) {
    e.preventDefault();
    if (!onAdminUnlock) return;
    if (adminPin.trim() !== ADMIN_PIN) {
      setAdminPinError("Feil pinkode.");
      return;
    }
    onAdminUnlock();
    setAdminPin("");
    setAdminPinError("");
    setMenu("closed");
  }

  return (
    <aside className="stats-frame" aria-label="Player stats">
      <div className="stats-frame-head">
        <div className="stats-frame-title">Hunter Status</div>
        {hasMenu ? (
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
                {authEmail ? (
                  <p className="stats-menu-heading stats-menu-auth">
                    Sky: {authEmail}
                  </p>
                ) : null}
                {!authEmail && onGoogleLogin ? (
                  <button
                    type="button"
                    className="stats-menu-item"
                    role="menuitem"
                    onClick={() => {
                      setMenu("closed");
                      onGoogleLogin();
                    }}
                  >
                    Logg inn med Google
                  </button>
                ) : null}
                {authEmail && onGoogleLogout ? (
                  <button
                    type="button"
                    className="stats-menu-item"
                    role="menuitem"
                    onClick={() => {
                      setMenu("closed");
                      onGoogleLogout();
                    }}
                  >
                    Logg ut
                  </button>
                ) : null}
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
                {onAdminUnlock ? (
                  adminUnlocked ? (
                    <button
                      type="button"
                      className="stats-menu-item"
                      role="menuitem"
                      onClick={() => {
                        onAdminLock?.();
                        setMenu("closed");
                      }}
                    >
                      Admin av
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="stats-menu-item"
                      role="menuitem"
                      onClick={() => {
                        setAdminPin("");
                        setAdminPinError("");
                        setMenu("admin-pin");
                      }}
                    >
                      Admin
                    </button>
                  )
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
            {menu === "admin-pin" ? (
              <div className="stats-menu-panel stats-menu-rename" role="dialog">
                <p className="stats-menu-heading">Admin</p>
                <form onSubmit={submitAdminPin}>
                  <input
                    className="stats-rename-input"
                    autoFocus
                    autoComplete="off"
                    inputMode="numeric"
                    spellCheck={false}
                    maxLength={8}
                    type="password"
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value)}
                    aria-label="Admin pinkode"
                    placeholder="Pinkode"
                  />
                  {adminPinError ? (
                    <p className="stats-rename-error">{adminPinError}</p>
                  ) : null}
                  <div className="stats-rename-actions">
                    <button
                      type="button"
                      className="stats-menu-item is-muted"
                      onClick={() => {
                        setMenu("edit");
                        setAdminPin("");
                        setAdminPinError("");
                      }}
                    >
                      Avbryt
                    </button>
                    <button type="submit" className="stats-menu-item">
                      Lås opp
                    </button>
                  </div>
                </form>
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
        <div className="stats-item stats-item-metrics" aria-label="Rekkevidde og distanse">
          <div className="stats-metric">
            <dt>Max Range</dt>
            <dd>{formatRange(stats.maxRange)}</dd>
          </div>
          <div className="stats-metric">
            <dt>Gått</dt>
            <dd title="Akkumulert gangavstand (jakt)">
              {formatLifetimeDistance(stats.lifetimeDistanceM)}
            </dd>
          </div>
          <div className="stats-metric">
            <dt>Fugl/km</dt>
            <dd title="Lifetime tiur + orrhane per km gått">
              {formatBirdsPerKm(birdsPerKm(stats))}
            </dd>
          </div>
        </div>
      </dl>
    </aside>
  );
}
