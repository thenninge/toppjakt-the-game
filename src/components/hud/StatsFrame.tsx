"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { PlayerStats } from "@/lib/player";
import type { GameRealism } from "@/lib/optics/turretStyle";
import { GAME_REALISM_LEVELS } from "@/lib/optics/turretStyle";
import {
  DEFAULT_SCOPE_AIM_CONTROL,
  SCOPE_AIM_CONTROLS,
  type ScopeAimControl,
} from "@/lib/range/scopeAimControl";
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
import { HunterSelfie } from "@/components/hud/HunterSelfie";

const ADMIN_PIN = "9898";

const MENU_COPY: Record<
  GameLang,
  {
    settings: string;
    name: string;
    login: string;
    loginGoogle: string;
    logout: string;
    loggedInAs: string;
    language: string;
    volume: string;
    music: string;
    sfx: string;
    realism: string;
    realismLow: string;
    realismMedium: string;
    realismHigh: string;
    moveAim: string;
    moveAimTarget: string;
    moveAimReticle: string;
    rename: string;
    deleteHunter: string;
    advanced: string;
    close: string;
    cancel: string;
    save: string;
    hunterExam: string;
    selfie: string;
    back: string;
  }
> = {
  nb: {
    settings: "Settings",
    name: "Name",
    login: "Login",
    loginGoogle: "Logg inn med Google",
    logout: "Logg ut",
    loggedInAs: "Sky",
    language: "Language",
    volume: "Volum",
    music: "Musikk",
    sfx: "Lydeffekter",
    realism: "Realism",
    realismLow: "Low",
    realismMedium: "Medium",
    realismHigh: "High",
    moveAim: "Move reticle/target",
    moveAimTarget: "Target",
    moveAimReticle: "Reticle (while F)",
    rename: "Endre navn",
    deleteHunter: "Slett jeger",
    advanced: "Avansert",
    close: "Lukk",
    cancel: "Avbryt",
    save: "Lagre",
    hunterExam: "Jegerprøven",
    selfie: "Selfie",
    back: "Tilbake",
  },
  en: {
    settings: "Settings",
    name: "Name",
    login: "Login",
    loginGoogle: "Sign in with Google",
    logout: "Sign out",
    loggedInAs: "Cloud",
    language: "Language",
    volume: "Volume",
    music: "Music",
    sfx: "Sound effects",
    realism: "Realism",
    realismLow: "Low",
    realismMedium: "Medium",
    realismHigh: "High",
    moveAim: "Move reticle/target",
    moveAimTarget: "Target",
    moveAimReticle: "Reticle (while F)",
    rename: "Change name",
    deleteHunter: "Delete hunter",
    advanced: "Advanced",
    close: "Close",
    cancel: "Cancel",
    save: "Save",
    hunterExam: "Hunter exam",
    selfie: "Selfie",
    back: "Back",
  },
  ja: {
    settings: "Settings",
    name: "Name",
    login: "Login",
    loginGoogle: "Googleでログイン",
    logout: "ログアウト",
    loggedInAs: "Cloud",
    language: "Language",
    volume: "音量",
    music: "音楽",
    sfx: "効果音",
    realism: "Realism",
    realismLow: "Low",
    realismMedium: "Medium",
    realismHigh: "High",
    moveAim: "Move reticle/target",
    moveAimTarget: "Target",
    moveAimReticle: "Reticle (while F)",
    rename: "名前を変更",
    deleteHunter: "ハンターを削除",
    advanced: "詳細",
    close: "閉じる",
    cancel: "キャンセル",
    save: "保存",
    hunterExam: "猟銃試験",
    selfie: "セルフィー",
    back: "戻る",
  },
};

type StatsFrameProps = {
  stats: PlayerStats;
  onRename?: (nextName: string) => string | null;
  onDeleteUser?: () => void;
  onLangChange?: (lang: GameLang) => void;
  onRealismChange?: (realism: GameRealism) => void;
  onScopeAimControlChange?: (mode: ScopeAimControl) => void;
  /** Open Jegerprøven (retake / certificate). */
  onOpenJegerprove?: () => void;
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

type MenuView = "closed" | "settings" | "rename" | "admin-pin" | "selfie";

/** Compact sticky hunter strip — keeps main content visible. */
export function StatsFrame({
  stats,
  onRename,
  onDeleteUser,
  onLangChange,
  onRealismChange,
  onScopeAimControlChange,
  onOpenJegerprove,
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
  /** Selfie is always available; other items need handlers. */
  const hasMenu = true;
  const aimControl =
    stats.scopeAimControl ?? DEFAULT_SCOPE_AIM_CONTROL;

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
    setMenu("settings");
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

  function closeMenu() {
    setMenu("closed");
    setRenameError("");
    setAdminPin("");
    setAdminPinError("");
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
              aria-haspopup="dialog"
              aria-expanded={menu !== "closed"}
              onClick={() =>
                setMenu((m) => (m === "closed" ? "settings" : "closed"))
              }
            >
              <span className="stats-menu-burger" aria-hidden>
                <span />
                <span />
                <span />
              </span>
            </button>
            {menu === "settings" ? (
              <div
                className="stats-menu-panel stats-settings-panel"
                role="dialog"
                aria-label={copy.settings}
              >
                <div className="stats-settings-head">
                  <p className="stats-menu-heading stats-settings-title">
                    {copy.settings}
                  </p>
                  <button
                    type="button"
                    className="stats-menu-item is-muted stats-settings-close"
                    onClick={closeMenu}
                  >
                    {copy.close}
                  </button>
                </div>

                <section className="stats-settings-section" aria-label={copy.name}>
                  <p className="stats-menu-heading">{copy.name}</p>
                  <p className="stats-settings-value">{stats.name || "—"}</p>
                  <button
                    type="button"
                    className="stats-menu-item"
                    onClick={() => setMenu("selfie")}
                  >
                    {copy.selfie}
                  </button>
                  {onRename ? (
                    <button
                      type="button"
                      className="stats-menu-item"
                      onClick={openRename}
                    >
                      {copy.rename}
                    </button>
                  ) : null}
                  {onOpenJegerprove ? (
                    <button
                      type="button"
                      className="stats-menu-item"
                      onClick={() => {
                        closeMenu();
                        onOpenJegerprove();
                      }}
                    >
                      {copy.hunterExam}
                    </button>
                  ) : null}
                </section>

                <section className="stats-settings-section" aria-label={copy.login}>
                  <p className="stats-menu-heading">{copy.login}</p>
                  {authEmail ? (
                    <p className="stats-settings-value">
                      {copy.loggedInAs}: {authEmail}
                    </p>
                  ) : (
                    <p className="stats-settings-value is-muted">—</p>
                  )}
                  {!authEmail && onGoogleLogin ? (
                    <button
                      type="button"
                      className="stats-menu-item"
                      onClick={() => {
                        closeMenu();
                        onGoogleLogin();
                      }}
                    >
                      {copy.loginGoogle}
                    </button>
                  ) : null}
                  {authEmail && onGoogleLogout ? (
                    <button
                      type="button"
                      className="stats-menu-item"
                      onClick={() => {
                        closeMenu();
                        onGoogleLogout();
                      }}
                    >
                      {copy.logout}
                    </button>
                  ) : null}
                </section>

                {onRealismChange ? (
                  <section
                    className="stats-settings-section"
                    aria-label={copy.realism}
                  >
                    <p className="stats-menu-heading">{copy.realism}</p>
                    <div className="stats-menu-lang-row">
                      {GAME_REALISM_LEVELS.map((level) => (
                        <button
                          key={level}
                          type="button"
                          className={
                            (stats.realism ?? "medium") === level
                              ? "stats-menu-item is-active"
                              : "stats-menu-item"
                          }
                          role="radio"
                          aria-checked={(stats.realism ?? "medium") === level}
                          onClick={() => onRealismChange(level)}
                        >
                          {level === "low"
                            ? copy.realismLow
                            : level === "medium"
                              ? copy.realismMedium
                              : copy.realismHigh}
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}

                {onScopeAimControlChange ? (
                  <section
                    className="stats-settings-section"
                    aria-label={copy.moveAim}
                  >
                    <p className="stats-menu-heading">{copy.moveAim}</p>
                    <div className="stats-menu-lang-row">
                      {SCOPE_AIM_CONTROLS.map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          className={
                            aimControl === mode
                              ? "stats-menu-item is-active"
                              : "stats-menu-item"
                          }
                          role="radio"
                          aria-checked={aimControl === mode}
                          onClick={() => onScopeAimControlChange(mode)}
                        >
                          {mode === "target"
                            ? copy.moveAimTarget
                            : copy.moveAimReticle}
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}

                {onLangChange ? (
                  <section
                    className="stats-settings-section"
                    aria-label={copy.language}
                  >
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
                          role="radio"
                          aria-checked={stats.lang === code}
                          onClick={() => onLangChange(code)}
                        >
                          {GAME_LANG_LABEL[code]}
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}

                <section
                  className="stats-settings-section stats-settings-advanced"
                  aria-label={copy.advanced}
                >
                  <p className="stats-menu-heading">{copy.advanced}</p>
                  <div
                    className="stats-menu-volume"
                    role="group"
                    aria-label={copy.volume}
                  >
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
                  {onDeleteUser ? (
                    <button
                      type="button"
                      className="stats-menu-item is-danger"
                      onClick={() => {
                        closeMenu();
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
                        onClick={() => {
                          onAdminLock?.();
                          closeMenu();
                        }}
                      >
                        Admin av
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="stats-menu-item"
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
                </section>
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
                        setMenu("settings");
                        setAdminPin("");
                        setAdminPinError("");
                      }}
                    >
                      {copy.cancel}
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
                        setMenu("settings");
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
            {menu === "selfie" ? (
              <div
                className="stats-menu-panel stats-menu-selfie"
                role="dialog"
                aria-label={copy.selfie}
              >
                <div className="stats-settings-head">
                  <p className="stats-menu-heading stats-settings-title">
                    {copy.selfie}
                  </p>
                  <button
                    type="button"
                    className="stats-menu-item is-muted stats-settings-close"
                    onClick={() => setMenu("settings")}
                  >
                    {copy.back}
                  </button>
                </div>
                <HunterSelfie name={stats.name} nickname={stats.nickname} />
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
