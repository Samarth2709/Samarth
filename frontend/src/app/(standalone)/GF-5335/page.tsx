"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildGoogleUrl, buildStart, downloadIcs } from "./calendar";
import "./invite.css";

type Step =
  | "name"
  | "greet"
  | "nicetry"
  | "begone"
  | "ask"
  | "celebrate"
  | "checking"
  | "when"
  | "what"
  | "dress"
  | "scan"
  | "terms"
  | "done";

const ACTIVITIES = [
  { id: "dinner", emoji: "🍝", label: "dinner" },
  { id: "movie", emoji: "🍿", label: "movie" },
  { id: "picnic", emoji: "🧺", label: "picnic" },
  { id: "ice cream", emoji: "🍦", label: "ice cream" },
  { id: "mini golf", emoji: "⛳", label: "mini golf" },
  { id: "stargazing", emoji: "✨", label: "stargazing" },
  { id: "drive", emoji: "🚗", label: "drive" },
  { id: "museum", emoji: "🖼️", label: "museum" },
];

const TIMES = [
  { time: "11:00", emoji: "🥐", label: "brunch" },
  { time: "13:00", emoji: "🍱", label: "lunch" },
  { time: "16:00", emoji: "☀️", label: "afternoon" },
  { time: "18:30", emoji: "🌇", label: "golden hour" },
  { time: "19:30", emoji: "🍽️", label: "dinner" },
  { time: "21:00", emoji: "🌙", label: "late" },
];

const DRESS_CODES = [
  { id: "cozy", emoji: "🧸", label: "cozy" },
  { id: "cute", emoji: "🎀", label: "cute" },
  { id: "fancy", emoji: "🥂", label: "fancy" },
  { id: "surprise", emoji: "🎁", label: "surprise" },
];

const NO_LABELS = ["no", "no? 🥺", "you sure?", "really?", "think again 🐰", "just say yes 💗"];
const GIVE_UP_AT = 8;

const CHECK_LINES = ["checking your calendar… 📅", "cancelling your other plans… ✂️", "you're free ✨"];
const SCAN_LINES = ["analyzing vibes… 🔮", "consulting the bunny council… 🐰"];
const EJECT_LINES = [
  "reporting incident… 🚓",
  "notifying authorities… 📞",
  "uploading evidence… 📤",
  "…ok fine. last chance. 🥲",
];

const DECOR: Record<Step, string[]> = {
  name: ["🐰", "💗", "🌸", "✨"],
  greet: ["🐰", "💗", "🌸", "✨"],
  nicetry: ["😏", "🙄", "💅", "🐰"],
  begone: ["🚪", "😤", "⛔", "🙅‍♀️"],
  ask: ["💗", "🌷", "🐰", "✨"],
  celebrate: ["💖", "🎀", "🐰", "✨"],
  checking: ["📅", "✨", "💗", "🐰"],
  when: ["🌷", "🌸", "💐", "🌼"],
  what: ["🍫", "🍓", "🧁", "💗"],
  dress: ["🎀", "🧸", "🥂", "🎁"],
  scan: ["🔮", "💯", "✨", "🐰"],
  terms: ["📜", "🖊️", "💗", "🐰"],
  done: ["🐰", "💐", "🍫", "💗"],
};

// Fixed slots (not random) so server and client render identically.
const DECOR_SLOTS = [
  { top: "6%", left: "8%", delay: 0, dur: 7, size: 28 },
  { top: "12%", left: "80%", delay: 1.2, dur: 8, size: 22 },
  { top: "32%", left: "90%", delay: 0.6, dur: 6.5, size: 26 },
  { top: "55%", left: "4%", delay: 2, dur: 9, size: 24 },
  { top: "72%", left: "86%", delay: 0.3, dur: 7.5, size: 30 },
  { top: "86%", left: "12%", delay: 1.6, dur: 8.5, size: 22 },
  { top: "40%", left: "13%", delay: 2.4, dur: 7, size: 18 },
  { top: "80%", left: "55%", delay: 0.9, dur: 9.5, size: 20 },
];

type Bunny = { top: number; left: number; size: number; dur: number };
type Heart = { left: number; delay: number; dur: number; size: number; emoji: string };

const pad = (n: number) => String(n).padStart(2, "0");

function setEmojiFavicon(emoji: string) {
  let link = document.querySelector<HTMLLinkElement>("link#invite-icon");
  if (!link) {
    link = document.createElement("link");
    link.id = "invite-icon";
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${emoji}</text></svg>`
  )}`;
}

export default function InvitePage() {
  const [step, setStep] = useState<Step>("name");
  const [nameInput, setNameInput] = useState("");
  const [wrongCount, setWrongCount] = useState(0);
  const [dateISO, setDateISO] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [activities, setActivities] = useState<string[]>([]);
  const [dress, setDress] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);

  // ---- tab-switch guilt trip ----
  useEffect(() => {
    let restore: ReturnType<typeof setTimeout> | undefined;
    const onVis = () => {
      if (document.hidden) {
        document.title = "come back 🥺";
        setEmojiFavicon("🥺");
      } else {
        document.title = "yay 💗";
        setEmojiFavicon("💗");
        restore = setTimeout(() => {
          document.title = "psst 🤫";
        }, 2000);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      if (restore) clearTimeout(restore);
    };
  }, []);

  // ---- bunny multiplication ----
  const [bunnies, setBunnies] = useState<Bunny[]>([]);
  const spawnBunnies = useCallback(() => {
    setBunnies((prev) => {
      if (prev.length >= 60) return prev;
      const fresh = Array.from({ length: 2 }, () => ({
        top: 4 + Math.random() * 86,
        left: 3 + Math.random() * 90,
        size: 18 + Math.random() * 18,
        dur: 6 + Math.random() * 4,
      }));
      return [...prev, ...fresh];
    });
  }, []);

  // ---- heart burst (celebrate + replay on done) ----
  const [hearts, setHearts] = useState<Heart[]>([]);
  const burstTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fireBurst = useCallback(() => {
    const EMO = ["💗", "💖", "💞", "🌸", "🐰", "🍫"];
    setHearts(
      Array.from({ length: 26 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        dur: 1.8 + Math.random() * 1.6,
        size: 16 + Math.random() * 22,
        emoji: EMO[i % EMO.length],
      }))
    );
    if (burstTimer.current) clearTimeout(burstTimer.current);
    burstTimer.current = setTimeout(() => setHearts([]), 3400);
  }, []);
  useEffect(() => () => {
    if (burstTimer.current) clearTimeout(burstTimer.current);
  }, []);

  // ---- ask step: magnetic yes / runaway no ----
  const yesRef = useRef<HTMLButtonElement>(null);
  const noRef = useRef<HTMLButtonElement>(null);
  const yesBase = useRef<{ cx: number; cy: number } | null>(null);
  const cursor = useRef({ x: -9999, y: -9999 });
  const lastDodge = useRef(0);
  const dodgeRef = useRef(0);
  const idleBoost = useRef(1);
  const [dodgeCount, setDodgeCount] = useState(0);
  const [noPos, setNoPos] = useState<{ x: number; y: number } | null>(null);
  const gaveUp = dodgeCount >= GIVE_UP_AT;

  const totalBoost = useCallback(
    () => Math.min((1 + Math.min(dodgeRef.current, 8) * 0.06) * idleBoost.current, 1.9),
    []
  );

  const measureYes = useCallback(() => {
    const yes = yesRef.current;
    if (!yes) return;
    yes.style.transform = "";
    const r = yes.getBoundingClientRect();
    yesBase.current = { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  }, []);

  const dodge = useCallback(() => {
    if (dodgeRef.current >= GIVE_UP_AT) return;
    const now = performance.now();
    if (now - lastDodge.current < 250) return;
    lastDodge.current = now;
    const no = noRef.current;
    if (!no) return;
    const padPx = 12;
    const bw = no.offsetWidth || 90;
    const bh = no.offsetHeight || 52;
    const maxX = Math.max(padPx + 1, window.innerWidth - bw - padPx);
    const maxY = Math.max(padPx + 1, window.innerHeight - bh - padPx);
    let nx = padPx;
    let ny = padPx;
    for (let i = 0; i < 8; i++) {
      nx = padPx + Math.random() * (maxX - padPx);
      ny = padPx + Math.random() * (maxY - padPx);
      const cx = nx + bw / 2;
      const cy = ny + bh / 2;
      if (Math.hypot(cx - cursor.current.x, cy - cursor.current.y) > 140) break;
    }
    setNoPos({ x: nx, y: ny });
    dodgeRef.current += 1;
    setDodgeCount(dodgeRef.current);
    requestAnimationFrame(measureYes);
  }, [measureYes]);

  useEffect(() => {
    if (step !== "ask") return;
    let raf = 0;
    const apply = () => {
      raf = 0;
      const { x: mx, y: my } = cursor.current;
      const yes = yesRef.current;
      if (yes && yesBase.current) {
        const { cx, cy } = yesBase.current;
        const dx = mx - cx;
        const dy = my - cy;
        const dist = Math.hypot(dx, dy);
        const R = 160;
        const boost = totalBoost();
        if (dist < R) {
          const pull = 1 - dist / R;
          const clamp = (v: number) => Math.max(-60, Math.min(60, v));
          yes.style.transform = `translate(${clamp(dx * pull * 0.4)}px, ${clamp(
            dy * pull * 0.4
          )}px) scale(${(1 + pull * 0.25) * boost})`;
        } else {
          yes.style.transform = `scale(${boost})`;
        }
      }
      const no = noRef.current;
      if (no && dodgeRef.current < GIVE_UP_AT) {
        const r = no.getBoundingClientRect();
        if (Math.hypot(mx - (r.left + r.width / 2), my - (r.top + r.height / 2)) < 110) {
          dodge();
        }
      }
    };
    const onMove = (e: MouseEvent) => {
      cursor.current = { x: e.clientX, y: e.clientY };
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onResize = () => {
      measureYes();
      const no = noRef.current;
      if (no && noPos) {
        setNoPos({
          x: Math.min(noPos.x, Math.max(12, window.innerWidth - no.offsetWidth - 12)),
          y: Math.min(noPos.y, Math.max(12, window.innerHeight - no.offsetHeight - 12)),
        });
      }
    };
    measureYes();
    window.addEventListener("mousemove", onMove);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [step, dodge, measureYes, noPos, totalBoost]);

  // idle inflation: the yes button grows while she hesitates
  useEffect(() => {
    if (step !== "ask") return;
    idleBoost.current = 1;
    const id = setInterval(() => {
      idleBoost.current = Math.min(idleBoost.current + 0.06, 1.5);
      const yes = yesRef.current;
      if (yes) yes.style.transform = `scale(${totalBoost()})`;
    }, 4000);
    return () => clearInterval(id);
  }, [step, totalBoost]);

  const sayYes = useCallback(() => {
    setStep("celebrate");
  }, []);

  const noHandlers = {
    onPointerDown: (e: React.PointerEvent) => {
      if (gaveUp) return;
      e.preventDefault();
      cursor.current = { x: e.clientX, y: e.clientY };
      dodge();
    },
    onMouseEnter: () => {
      if (!gaveUp) dodge();
    },
    onFocus: () => {
      if (!gaveUp) dodge();
    },
    onClick: (e: React.MouseEvent) => {
      if (gaveUp) {
        sayYes();
        return;
      }
      e.preventDefault();
      dodge();
    },
  };

  // ---- greet / celebrate / checking timers ----
  useEffect(() => {
    if (step !== "greet") return;
    const t = setTimeout(() => setStep("ask"), 1800);
    return () => clearTimeout(t);
  }, [step]);

  useEffect(() => {
    if (step !== "celebrate") return;
    fireBurst();
    const t = setTimeout(() => setStep("checking"), 1600);
    return () => clearTimeout(t);
  }, [step, fireBurst]);

  const [checkLine, setCheckLine] = useState(0);
  useEffect(() => {
    if (step !== "checking") return;
    setCheckLine(0);
    const t1 = setTimeout(() => setCheckLine(1), 1100);
    const t2 = setTimeout(() => setCheckLine(2), 2200);
    const t3 = setTimeout(() => setStep("when"), 3500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [step]);

  // ---- escalating ejection (begone level 3+) ----
  const [ejectLine, setEjectLine] = useState(0);
  const [ejectProgress, setEjectProgress] = useState(0);
  useEffect(() => {
    if (step !== "begone" || wrongCount < 3) return;
    setEjectLine(0);
    setEjectProgress(0);
    const bar = setInterval(() => setEjectProgress((p) => Math.min(p + 2, 100)), 60);
    const l1 = setTimeout(() => setEjectLine(1), 1100);
    const l2 = setTimeout(() => setEjectLine(2), 2200);
    const l3 = setTimeout(() => setEjectLine(3), 3400);
    return () => {
      clearInterval(bar);
      clearTimeout(l1);
      clearTimeout(l2);
      clearTimeout(l3);
    };
  }, [step, wrongCount]);

  // ---- compatibility scan ----
  const [scanProgress, setScanProgress] = useState(0);
  const [scanLine, setScanLine] = useState(0);
  const [scanDone, setScanDone] = useState(false);
  useEffect(() => {
    if (step !== "scan") return;
    setScanProgress(0);
    setScanLine(0);
    setScanDone(false);
    const bar = setInterval(() => setScanProgress((p) => Math.min(p + 2, 100)), 50);
    const l1 = setTimeout(() => setScanLine(1), 1300);
    const d = setTimeout(() => setScanDone(true), 2900);
    return () => {
      clearInterval(bar);
      clearTimeout(l1);
      clearTimeout(d);
    };
  }, [step]);

  // ---- when step: day chips ----
  const days = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      return {
        iso: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        wd:
          i === 0
            ? "today"
            : i === 1
              ? "tmrw"
              : d.toLocaleDateString("en-US", { weekday: "short" }).toLowerCase(),
        num: d.getDate(),
        mon: d.toLocaleDateString("en-US", { month: "short" }).toLowerCase(),
      };
    });
  }, []);

  // ---- done step: countdown ----
  const [countdown, setCountdown] = useState("");
  useEffect(() => {
    if (step !== "done" || !dateISO || !time) return;
    const target = buildStart(dateISO, time).getTime();
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        setCountdown("it's time 💘");
        return;
      }
      const s = Math.floor(diff / 1000);
      setCountdown(
        `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h ${Math.floor(
          (s % 3600) / 60
        )}m ${s % 60}s`
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [step, dateISO, time]);

  const submitName = (e: React.FormEvent) => {
    e.preventDefault();
    const name = nameInput.trim().toLowerCase();
    if (name.includes("diya")) {
      setStep("greet");
    } else if (name.includes("samarth")) {
      setStep("nicetry");
    } else {
      setWrongCount((c) => c + 1);
      setStep("begone");
    }
  };

  const prettyDate = useMemo(() => {
    if (!dateISO) return "";
    const [y, m, d] = dateISO.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }, [dateISO]);

  const prettyTime = useMemo(() => {
    if (!time) return "";
    const [hh, mm] = time.split(":").map(Number);
    const h12 = ((hh + 11) % 12) + 1;
    return `${h12}:${pad(mm)} ${hh < 12 ? "am" : "pm"}`;
  }, [time]);

  const noScale = Math.max(0.6, 1 - dodgeCount * 0.05);
  const noLabel = gaveUp ? "ok fine 🥲" : NO_LABELS[Math.min(dodgeCount, NO_LABELS.length - 1)];
  const dressChoice = DRESS_CODES.find((d) => d.id === dress);
  const alarm = step === "begone" && wrongCount >= 2;

  return (
    <div className={`invite-stage${alarm ? " alarm" : ""}`}>
      <div className="floaties" aria-hidden="true">
        {DECOR_SLOTS.map((s, i) => {
          const emoji = DECOR[step][i % DECOR[step].length];
          const tappable = emoji === "🐰";
          return (
            <span
              key={i}
              className={`floatie${tappable ? " tappable" : ""}`}
              style={{
                top: s.top,
                left: s.left,
                fontSize: s.size,
                animationDelay: `${s.delay}s`,
                animationDuration: `${s.dur}s`,
              }}
              onClick={tappable ? spawnBunnies : undefined}
            >
              {emoji}
            </span>
          );
        })}
        {bunnies.map((b, i) => (
          <span
            key={`b${i}`}
            className="floatie tappable pop"
            style={{
              top: `${b.top}%`,
              left: `${b.left}%`,
              fontSize: b.size,
              animationDuration: `${b.dur}s, 0.4s`,
            }}
            onClick={spawnBunnies}
          >
            🐰
          </span>
        ))}
      </div>

      {hearts.length > 0 && (
        <div className="heart-burst" aria-hidden="true">
          {hearts.map((h, i) => (
            <span
              key={i}
              className="burst-heart"
              style={{
                left: `${h.left}%`,
                fontSize: h.size,
                animationDelay: `${h.delay}s`,
                animationDuration: `${h.dur}s`,
              }}
            >
              {h.emoji}
            </span>
          ))}
        </div>
      )}

      <main
        className={`invite-card${step === "begone" ? " shake" : ""}`}
        key={step === "begone" ? `begone-${wrongCount}` : step}
      >
        {step === "name" && (
          <form className="step" onSubmit={submitName}>
            <div className="big-emoji">🐰</div>
            <h1>who&rsquo;s there? 👀</h1>
            <input
              className="name-input"
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="your name…"
              autoFocus
              autoComplete="off"
            />
            <button className="pill" type="submit" disabled={!nameInput.trim()}>
              💗
            </button>
          </form>
        )}

        {step === "greet" && (
          <div className="step">
            <div className="big-emoji hop">🐰</div>
            <h1>oh… it&rsquo;s you 💗</h1>
          </div>
        )}

        {step === "nicetry" && (
          <div className="step">
            <div className="big-emoji">😏</div>
            <h1>nice try.</h1>
            <p className="sub">you already know the answer.</p>
            <button
              className="pill ghost"
              onClick={() => {
                setNameInput("");
                setStep("name");
              }}
            >
              fine 🙄
            </button>
          </div>
        )}

        {step === "begone" && wrongCount === 1 && (
          <div className="step">
            <div className="big-emoji">🚪</div>
            <h1>GET OUT. 😤</h1>
            <p className="sub">this page is not for you. leave. immediately.</p>
            <button
              className="pill ghost"
              onClick={() => {
                setNameInput("");
                setStep("name");
              }}
            >
              wait, i&rsquo;m actually diya 🥺
            </button>
          </div>
        )}

        {step === "begone" && wrongCount === 2 && (
          <div className="step">
            <div className="big-emoji">🐰🕶️</div>
            <h1>SECURITY. 🚨</h1>
            <p className="sub">you were warned. an incident report is being filed.</p>
            <button
              className="pill ghost"
              onClick={() => {
                setNameInput("");
                setStep("name");
              }}
            >
              wait, i&rsquo;m actually diya 🥺
            </button>
          </div>
        )}

        {step === "begone" && wrongCount >= 3 && (
          <div className="step">
            <div className="big-emoji">🚓</div>
            <h1>{EJECT_LINES[ejectLine]}</h1>
            <div className="bar">
              <div className="bar-fill" style={{ width: `${ejectProgress}%` }} />
            </div>
            {ejectLine === 3 && (
              <button
                className="pill ghost"
                onClick={() => {
                  setNameInput("");
                  setStep("name");
                }}
              >
                i&rsquo;m diya, i swear 🥺
              </button>
            )}
          </div>
        )}

        {step === "ask" && (
          <div className="step">
            <div className="big-emoji">🥺</div>
            <h1>will you go on a date with me?</h1>
            <div className="btn-row">
              <button ref={yesRef} className="yes" onClick={sayYes}>
                yes 💗
              </button>
              {noPos === null && (
                <button ref={noRef} className={`no${gaveUp ? " gave-up" : ""}`} {...noHandlers}>
                  {noLabel}
                </button>
              )}
            </div>
          </div>
        )}

        {step === "celebrate" && (
          <div className="step">
            <div className="big-emoji hop">🥰</div>
            <h1>good choice</h1>
          </div>
        )}

        {step === "checking" && (
          <div className="step">
            <div className="big-emoji pulse">💗</div>
            <div className="check-lines">
              {CHECK_LINES.slice(0, checkLine + 1).map((line, i) => (
                <p key={i} className={`check-line${i === checkLine ? " current" : " faded"}`}>
                  {line}
                </p>
              ))}
            </div>
          </div>
        )}

        {step === "when" && (
          <div className="step">
            <h1>when? 🗓️</h1>
            <div className="chip-row">
              {days.map((d) => (
                <button
                  key={d.iso}
                  className={`day-chip${dateISO === d.iso ? " sel" : ""}`}
                  onClick={() => setDateISO(d.iso)}
                >
                  <span className="wd">{d.wd}</span>
                  <span className="num">{d.num}</span>
                  <span className="mon">{d.mon}</span>
                </button>
              ))}
            </div>
            <div className="chip-grid">
              {TIMES.map((t) => (
                <button
                  key={t.time}
                  className={`time-chip${time === t.time ? " sel" : ""}`}
                  onClick={() => setTime(t.time)}
                >
                  <span>{t.emoji}</span> {t.label}
                </button>
              ))}
            </div>
            <button className="pill" disabled={!dateISO || !time} onClick={() => setStep("what")}>
              next 💗
            </button>
          </div>
        )}

        {step === "what" && (
          <div className="step">
            <h1>what are we doing? 💭</h1>
            <div className="activity-grid">
              {ACTIVITIES.map((a) => (
                <button
                  key={a.id}
                  className={`activity${activities.includes(a.id) ? " sel" : ""}`}
                  onClick={() =>
                    setActivities((prev) =>
                      prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id]
                    )
                  }
                >
                  <span className="act-emoji">{a.emoji}</span>
                  <span className="act-label">{a.label}</span>
                  {activities.includes(a.id) && <span className="check">✓</span>}
                </button>
              ))}
            </div>
            <div className="nav-row">
              <button className="back" onClick={() => setStep("when")}>
                ↩
              </button>
              <button className="pill" disabled={activities.length === 0} onClick={() => setStep("dress")}>
                next 💗
              </button>
            </div>
          </div>
        )}

        {step === "dress" && (
          <div className="step">
            <h1>dress code? 🎀</h1>
            <div className="activity-grid">
              {DRESS_CODES.map((d) => (
                <button
                  key={d.id}
                  className={`activity${dress === d.id ? " sel" : ""}`}
                  onClick={() => setDress(d.id)}
                >
                  <span className="act-emoji">{d.emoji}</span>
                  <span className="act-label">{d.label}</span>
                  {dress === d.id && <span className="check">✓</span>}
                </button>
              ))}
            </div>
            <div className="nav-row">
              <button className="back" onClick={() => setStep("what")}>
                ↩
              </button>
              <button className="pill" disabled={!dress} onClick={() => setStep("scan")}>
                next 💗
              </button>
            </div>
          </div>
        )}

        {step === "scan" && !scanDone && (
          <div className="step">
            <div className="big-emoji pulse">🔮</div>
            <h1>{SCAN_LINES[scanLine]}</h1>
            <div className="bar">
              <div className="bar-fill" style={{ width: `${scanProgress}%` }} />
            </div>
          </div>
        )}

        {step === "scan" && scanDone && (
          <div className="step">
            <div className="big-emoji hop">💯</div>
            <h1>compatibility: 100%</h1>
            <p className="sub">(we ran it 3 times to be sure)</p>
            <button className="pill" onClick={() => setStep("terms")}>
              obviously 💗
            </button>
          </div>
        )}

        {step === "terms" && (
          <div className="step">
            <h1>terms &amp; conditions 📜</h1>
            <ul className="terms">
              <li>💗 i agree to have a good time</li>
              <li>🙅‍♀️ i will not say &ldquo;i don&rsquo;t care, you pick&rdquo;</li>
              <li>🤝 unlimited hand-holding may occur</li>
              <li>🔒 cancellation policy: not allowed</li>
            </ul>
            <label className="agree">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>i agree</span>
            </label>
            <button className="pill" disabled={!agreed} onClick={() => setStep("done")}>
              sign here 🖊️
            </button>
          </div>
        )}

        {step === "done" && dateISO && time && (
          <div className="step">
            <div className="ticket">
              <div className="ticket-top">
                <p className="ticket-label">🎟️ admit two 🎟️</p>
                <h1>it&rsquo;s a date 💖</h1>
                <p className="sub">
                  {prettyDate} · {prettyTime}
                </p>
                <div className="picked">
                  {ACTIVITIES.filter((a) => activities.includes(a.id)).map((a) => (
                    <span key={a.id} className="picked-chip">
                      {a.emoji} {a.label}
                    </span>
                  ))}
                  {dressChoice && (
                    <span className="picked-chip">
                      {dressChoice.emoji} {dressChoice.label}
                    </span>
                  )}
                </div>
              </div>
              <div className="ticket-divider" />
              <div className="ticket-bottom">
                <p className="seat">seat: next to me · gate: GF-5335</p>
                <div className="barcode" />
              </div>
            </div>
            <p className="countdown">{countdown}</p>
            <div className="action-col">
              <a
                className="pill"
                href={buildGoogleUrl(dateISO, time, activities, dress ?? undefined)}
                target="_blank"
                rel="noopener noreferrer"
              >
                📅 add to calendar
              </a>
              <button
                className="pill ghost"
                onClick={() => downloadIcs(dateISO, time, activities, dress ?? undefined)}
              >
                ⬇️ save invite
              </button>
              <button className="pill ghost" onClick={fireBurst}>
                celebrate again 🎉
              </button>
            </div>
            <div className="nav-row">
              <button className="back" onClick={() => setStep("what")}>
                ↩
              </button>
            </div>
            <p className="footer-note">made with 💕 for you</p>
          </div>
        )}
      </main>

      {step === "ask" && noPos !== null && (
        <button
          ref={noRef}
          className={`no fled${gaveUp ? " gave-up" : ""}`}
          style={{
            left: noPos.x,
            top: noPos.y,
            transform: `scale(${noScale})`,
          }}
          {...noHandlers}
        >
          {noLabel}
        </button>
      )}
    </div>
  );
}
