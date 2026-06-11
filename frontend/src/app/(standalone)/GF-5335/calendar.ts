const OWNER_EMAIL = "samarth.kumbla@gmail.com";
const EVENT_TITLE = "our date 💖";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Floating local time, YYYYMMDDTHHMMSS — no Z so the event lands at the
// literal wall-clock time on whatever device opens it.
function fmt(dt: Date): string {
  return (
    dt.getFullYear().toString() +
    pad(dt.getMonth() + 1) +
    pad(dt.getDate()) +
    "T" +
    pad(dt.getHours()) +
    pad(dt.getMinutes()) +
    pad(dt.getSeconds())
  );
}

export function buildStart(dateISO: string, time: string): Date {
  const [y, m, d] = dateISO.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0);
}

function buildDetails(activities: string[], dress?: string): string {
  const dressPart = dress ? ` · dress code: ${dress}` : "";
  return `can't wait! the plan: ${activities.join(", ")}${dressPart} 💗`;
}

export function buildGoogleUrl(
  dateISO: string,
  time: string,
  activities: string[],
  dress?: string
): string {
  const start = buildStart(dateISO, time);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: EVENT_TITLE,
    details: buildDetails(activities, dress),
    add: OWNER_EMAIL,
  });
  // dates uses a structural "/" between start and end — append manually so
  // URLSearchParams doesn't percent-encode it.
  return `https://calendar.google.com/calendar/render?${params.toString()}&dates=${fmt(start)}/${fmt(end)}`;
}

function escapeIcsText(text: string): string {
  return text.replace(/[\\;,]/g, (m) => "\\" + m).replace(/\n/g, "\\n");
}

export function buildIcs(
  dateISO: string,
  time: string,
  activities: string[],
  dress?: string
): string {
  const start = buildStart(dateISO, time);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const uid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GF-5335//date//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}@gf-5335`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${escapeIcsText(EVENT_TITLE)}`,
    `DESCRIPTION:${escapeIcsText(buildDetails(activities, dress))}`,
    `ATTENDEE;CN=Samarth:mailto:${OWNER_EMAIL}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadIcs(
  dateISO: string,
  time: string,
  activities: string[],
  dress?: string
): void {
  const blob = new Blob([buildIcs(dateISO, time, activities, dress)], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "our-date.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
