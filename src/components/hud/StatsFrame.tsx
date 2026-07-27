"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { PlayerStats } from "@/lib/player";
import {
  readMusicVolume,
  readSfxVolume,
  writeMusicVolume,
  writeSfxVolume,
} from "@/lib/audio/volumes";
import {
  GAME_LANG_LABEL,
  GAME_LANGS,
  type GameLang,
} from "@/lib/i18n/lang";
import {
  birdsPerKm,
  formatBirdsPerKm,
  formatLifetimeDistance,
} from "@/lib/playerSave";

const ADMIN_PIN = "9898";

const MENU_COPY: Record<
  GameLang,
  {
    language: string;
    volume: string;
    music: string;
    sfx: string;
    edit: string;
    rename: string;
    deleteHunter: string;
    back: string;
    cancel: string;
    save: string;
  }
> = {
  nb: {
    language: "Språk",
    volume: "Volum",
    music: "Musikk",
    sfx: "Lydeffekter",
    edit: "Edit",
    rename: "Endre navn",
    deleteHunter: "Slett jeger",
    back: "← Tilbake",
    cancel: "Avbryt",
    save: "Lagre",
  },
  en: {
    language: "Language",
    volume: "Volume",
    music: "Music",
    sfx: "Sound effects",
    edit: "Edit",
    rename: "Change name",
    deleteHunter: "Delete hunter",
    back: "← Back",
    cancel: "Cancel",
    save: "Save",
  },
  ja: {
    language: "言語",
    volume: "音量",
    music: "音楽",
    sfx: "効果音",
    edit: "編集",
    rename: "名前を変更",
    deleteHunter: "ハンターを削除",
    back: "← 戻る",
    cancel: "キャンセル",
    save: "保存",
  },
};

type StatsFrameProps = {
  stats: PlayerStats;
  onRename?: (nextName: string) => string | null;
  onDeleteUser?: () => void;
  onLangChange?: (lang: GameLang) => void;
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
  onLangChange,
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
  const [musicVol, setMusicVol] = useState(1);
  const [sfxVol, setSfxVol] = useState(1);
  const menuRef = useRef<HTMLDivElement>(null);
  const copy = MENU_COPY[stats.lang] ?? MENU_COPY.nb;
  const hasMenu =
    !!onRename ||
    !!onDeleteUser ||
    !!onLangChange ||
    !!onGoogleLogin ||
    !!onGoogleLogout ||
    !!onAdminUnlock;

  useEffect(() => {
    setMusicVol(readMusicVolume());
    setSfxVol(readSfxVolume());
  }, []);

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
                <p className="stats-menu-heading">{copy.edit}</p>
                <div className="stats-menu-volume" role="group" aria-label={copy.volume}>
                  <p className="stats-menu-heading">{copy.volume}</p>
                  <label className="stats-volume-row">
                    <span className="stats-volume-label">
                      {copy.music}
                      <span className="stats-volume-pct">
                        {Math.round(musicVol * 100)}%
                      </span>
                    </span>
                    <input
                      type="range"
                      className="stats-volume-slider"
                      min={0}
                      max={100}
                      step={1}
                      value={Math.round(musicVol * 100)}
                      aria-label={copy.music}
                      onChange={(e) => {
                        const next = Number(e.target.value) / 100;
                        setMusicVol(next);
                        writeMusicVolume(next);
                      }}
                    />
                  </label>
                  <label className="stats-volume-row">
                    <span className="stats-volume-label">
                      {copy.sfx}
                      <span className="stats-volume-pct">
                        {Math.round(sfxVol * 100)}%
                      </span>
                    </span>
                    <input
                      type="range"
                      className="stats-volume-slider"
                      min={0}
                      max={100}
                      step={1}
                      value={Math.round(sfxVol * 100)}
                      aria-label={copy.sfx}
                      onChange={(e) => {
                        const next = Number(e.target.value) / 100;
                        setSfxVol(next);
                        writeSfxVolume(next);
                      }}
                    />
                  </label>
                </div>
                {onLangChange ? (
                  <div className="stats-menu-lang" role="group" aria-label={copy.language}>
                    <p className="stats-menu-heading">{copy.language}</p>
                    <div className="stats-menu-lang-row">
                      {GAME_LANGS.map((code) => (
                        <button
                          key={code}
                          type="button"
                          className={
                            stats.lang === code
                              ? "stats-menu-item is-active"
                              : "stats-menu-item"
                          }
                          role="menuitemradio"
                          aria-checked={stats.lang === code}
                          onClick={() => onLangChange(code)}
                        >
                          {GAME_LANG_LABEL[code]}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {onRename ? (
                  <button
                    type="button"
                    className="stats-menu-item"
                    role="menuitem"
                    onClick={openRename}
                  >
                    {copy.rename}
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
                    {copy.deleteHunter}
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
                  {copy.back}
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
                <p className="stats-menu-heading">{copy.rename}</p>
                <form onSubmit={submitRename}>
                  <input
                    className="stats-rename-input"
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={24}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    aria-label={copy.rename}
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
                      {copy.cancel}
                    </button>
                    <button type="submit" className="stats-menu-item">
                      {copy.save}
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
