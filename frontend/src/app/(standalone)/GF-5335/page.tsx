"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildGoogleUrl, buildStart, downloadIcs } from "./calendar";
import "./invite.css";

type Step =
  | "name"
  | "greet"
  | "begone"
  | "ask"
  | "celebrate"
  | "when"
  | "what"
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

const NO_LABELS = ["no", "no? 🥺", "you sure?", "really?", "think again 🐰", "just say yes 💗"];

const DECOR: Record<Step, string[]> = {
  name: ["🐰", "💗", "🌸", "✨"],
  greet: ["🐰", "💗", "🌸", "✨"],
  begone: ["🚪", "😤", "⛔", "🙅‍♀️"],
  ask: ["💗", "🌷", "🐰", "✨"],
  celebrate: ["💖", "🎀", "🐰", "✨"],
  when: ["🌷", "🌸", "💐", "🌼"],
  what: ["🍫", "🍓", "🧁", "💗"],
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

function Floaties({ emojis }: { emojis: string[] }) {
  return (
    <div className="floaties" aria-hidden="true">
      {DECOR_SLOTS.map((s, i) => (
        <span
          key={i}
          className="floatie"
          style={{
            top: s.top,
            left: s.left,
            fontSize: s.size,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.dur}s`,
          }}
        >
          {emojis[i % emojis.length]}
        </span>
      ))}
    </div>
  );
}

type Heart = { left: number; delay: number; dur: number; size: number; emoji: string };

const pad = (n: number) => String(n).padStart(2, "0");

export default function InvitePage() {
  const [step, setStep] = useState<Step>("name");
  const [nameInput, setNameInput] = useState("");
  const [dateISO, setDateISO] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [activities, setActivities] = useState<string[]>([]);

  // ---- ask step: magnetic yes / runaway no ----
  const yesRef = useRef<HTMLButtonElement>(null);
  const noRef = useRef<HTMLButtonElement>(null);
  const yesBase = useRef<{ cx: number; cy: number } | null>(null);
  const cursor = useRef({ x: -9999, y: -9999 });
  const lastDodge = useRef(0);
  const dodgeRef = useRef(0);
  const [dodgeCount, setDodgeCount] = useState(0);
  const [noPos, setNoPos] = useState<{ x: number; y: number } | null>(null);

  const measureYes = useCallback(() => {
    const yes = yesRef.current;
    if (!yes) return;
    yes.style.transform = "";
    const r = yes.getBoundingClientRect();
    yesBase.current = { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  }, []);

  const dodge = useCallback(() => {
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
        const boost = 1 + Math.min(dodgeRef.current, 8) * 0.06;
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
      if (no) {
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
  }, [step, dodge, measureYes, noPos]);

  const noHandlers = {
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      cursor.current = { x: e.clientX, y: e.clientY };
      dodge();
    },
    onMouseEnter: () => dodge(),
    onFocus: () => dodge(),
    onClick: (e: React.MouseEvent) => {
      e.preventDefault();
      dodge();
    },
  };

  // ---- greet / celebrate timers ----
  useEffect(() => {
    if (step !== "greet") return;
    const t = setTimeout(() => setStep("ask"), 1800);
    return () => clearTimeout(t);
  }, [step]);

  const [hearts, setHearts] = useState<Heart[]>([]);
  const [celebrateLine, setCelebrateLine] = useState(0);
  useEffect(() => {
    if (step !== "celebrate") return;
    const EMO = ["💗", "💖", "💞", "🌸", "🐰", "🍫"];
    setCelebrateLine(0);
    setHearts(
      Array.from({ length: 26 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        dur: 1.8 + Math.random() * 1.6,
        size: 16 + Math.random() * 22,
        emoji: EMO[i % EMO.length],
      }))
    );
    const t1 = setTimeout(() => setCelebrateLine(1), 1200);
    const t2 = setTimeout(() => setStep("when"), 2600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
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
    if (nameInput.trim().toLowerCase().includes("diya")) {
      setStep("greet");
    } else {
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
  const noLabel = NO_LABELS[Math.min(dodgeCount, NO_LABELS.length - 1)];

  return (
    <div className="invite-stage">
      <Floaties emojis={DECOR[step]} />

      {step === "celebrate" && (
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

      <main className={`invite-card${step === "begone" ? " shake" : ""}`} key={step}>
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

        {step === "begone" && (
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

        {step === "ask" && (
          <div className="step">
            <div className="big-emoji">🥺</div>
            <h1>will you go on a date with me?</h1>
            <div className="btn-row">
              <button
                ref={yesRef}
                className="yes"
                onClick={() => setStep("celebrate")}
              >
                yes 💗
              </button>
              {noPos === null && (
                <button ref={noRef} className="no" {...noHandlers}>
                  {noLabel}
                </button>
              )}
            </div>
          </div>
        )}

        {step === "celebrate" && (
          <div className="step">
            <div className="big-emoji hop">🥰</div>
            <h1>{celebrateLine === 0 ? "good choice" : "checking availability… you're free ✨"}</h1>
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
            <button
              className="pill"
              disabled={!dateISO || !time}
              onClick={() => setStep("what")}
            >
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
                      prev.includes(a.id)
                        ? prev.filter((x) => x !== a.id)
                        : [...prev, a.id]
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
              <button
                className="pill"
                disabled={activities.length === 0}
                onClick={() => setStep("done")}
              >
                next 💗
              </button>
            </div>
          </div>
        )}

        {step === "done" && dateISO && time && (
          <div className="step">
            <div className="big-emoji hop">💖</div>
            <h1>it&rsquo;s a date</h1>
            <p className="sub">
              {prettyDate} · {prettyTime}
            </p>
            <div className="picked">
              {ACTIVITIES.filter((a) => activities.includes(a.id)).map((a) => (
                <span key={a.id} className="picked-chip">
                  {a.emoji} {a.label}
                </span>
              ))}
            </div>
            <p className="countdown">{countdown}</p>
            <div className="action-col">
              <a
                className="pill"
                href={buildGoogleUrl(dateISO, time, activities)}
                target="_blank"
                rel="noopener noreferrer"
              >
                📅 add to calendar
              </a>
              <button
                className="pill ghost"
                onClick={() => downloadIcs(dateISO, time, activities)}
              >
                ⬇️ save invite
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
          className="no fled"
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
