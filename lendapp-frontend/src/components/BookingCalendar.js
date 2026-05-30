import { useState } from "react";

const DAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTHS = ["Januar","Februar","Maerz","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

function parseDate(str) {
  if (!str) return null;
  const p = str.slice(0, 10).split("-");
  return new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
}

function toStr(d) {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + dd;
}

function sameDay(a, b) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isBlocked(date, blockedRanges) {
  const ds = toStr(date);
  for (const r of blockedRanges) {
    if (r.open) {
      if (ds >= r.from) return true;
    } else {
      if (ds >= r.from && ds <= r.to) return true;
    }
  }
  return false;
}

export default function BookingCalendar({ blockedRanges, minDate, maxDays, onSelect, selectedFrom, selectedTo }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const initDate = minDate ? parseDate(minDate) : today;
  const [viewYear, setViewYear] = useState(initDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initDate.getMonth());
  const [hover, setHover] = useState(null);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  const firstDay = new Date(viewYear, viewMonth, 1);
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewYear, viewMonth, d));

  function getMaxDate(fromDate) {
    if (!fromDate || !maxDays) return null;
    const d = new Date(fromDate);
    d.setDate(d.getDate() + maxDays);
    return d;
  }

  function handleClick(date) {
    if (!date) return;
    date = new Date(date); date.setHours(0,0,0,0);
    const minD = minDate ? parseDate(minDate) : today;
    if (date < minD) return;
    if (isBlocked(date, blockedRanges || [])) return;

    if (!selectedFrom || (selectedFrom && selectedTo)) {
      onSelect({ from: toStr(date), to: "" });
    } else {
      const fromD = parseDate(selectedFrom);
      if (date <= fromD) {
        onSelect({ from: toStr(date), to: "" });
        return;
      }
      // Check no blocked dates in range
      const check = new Date(fromD);
      check.setDate(check.getDate() + 1);
      let hasBlocked = false;
      while (check < date) {
        if (isBlocked(check, blockedRanges || [])) { hasBlocked = true; break; }
        check.setDate(check.getDate() + 1);
      }
      if (hasBlocked) {
        onSelect({ from: toStr(date), to: "" });
        return;
      }
      // Check max days
      const maxD = getMaxDate(fromD);
      if (maxD && date > maxD) {
        onSelect({ from: selectedFrom, to: toStr(maxD) });
        return;
      }
      onSelect({ from: selectedFrom, to: toStr(date) });
    }
  }

  const fromD = parseDate(selectedFrom);
  const toD = parseDate(selectedTo);
  const hoverD = hover;
  const minD = minDate ? parseDate(minDate) : today;
  const maxToD = fromD && !toD ? getMaxDate(fromD) : null;

  return (
    <div style={{ userSelect: "none" }}>
      {/* Legend */}
      <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        {[
          { bg: "#2D5016", color: "#fff", label: "Ausgewaehlt" },
          { bg: "#D4EABD", color: "#1C1A16", label: "Zeitraum" },
          { bg: "#FAEBD7", border: "#F0A060", label: "Gesperrt" },
          { bg: "var(--bg2)", label: "Frei" },
        ].map(l => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text2)" }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: l.bg, border: l.border ? "1px solid " + l.border : "1px solid var(--border)" }} />
            {l.label}
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <button onClick={prevMonth} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 10px", cursor: "pointer", color: "var(--text2)", fontSize: 14 }}>{"<"}</button>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{MONTHS[viewMonth]} {viewYear}</div>
        <button onClick={nextMonth} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 10px", cursor: "pointer", color: "var(--text2)", fontSize: 14 }}>{">"}</button>
      </div>

      {/* Day headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 3 }}>
        {DAYS.map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 10, color: "var(--text3)", fontWeight: 600 }}>{d}</div>
        ))}
      </div>

      {/* Days */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {cells.map((date, i) => {
          if (!date) return <div key={i} />;

          const blocked = isBlocked(date, blockedRanges || []);
          const past = date < minD;
          const isFrom = fromD && sameDay(date, fromD);
          const isTo = toD && sameDay(date, toD);
          const isHover = hoverD && sameDay(date, hoverD);
          const exceedsMax = maxToD && date > maxToD;
          const disabled = blocked || past || exceedsMax;

          // In range?
          const endDate = toD || (fromD && !toD && hoverD && hoverD > fromD ? hoverD : null);
          const inRange = fromD && endDate && date > fromD && date < endDate;

          let bg = "var(--bg2)";
          let color = "var(--text)";
          let border = "transparent";
          let fw = 400;

          if (past) { bg = "transparent"; color = "var(--text3)"; }
          else if (blocked) { bg = "#FAEBD7"; color = "#C08060"; border = "#F0A060"; }
          else if (exceedsMax) { bg = "transparent"; color = "var(--text3)"; }
          else if (isFrom || isTo) { bg = "#2D5016"; color = "#fff"; border = "#2D5016"; fw = 700; }
          else if (inRange) { bg = "#D4EABD"; border = "#A8D488"; }
          else if (isHover && fromD && !toD) { bg = "#E8F5D5"; border = "var(--accent-mid)"; }

          return (
            <div key={i}
              onClick={() => !disabled && handleClick(date)}
              onMouseEnter={() => { if (fromD && !toD && !disabled) setHover(date); }}
              onMouseLeave={() => setHover(null)}
              style={{
                textAlign: "center", padding: "5px 2px", borderRadius: 6,
                fontSize: 12, fontWeight: fw, background: bg, color,
                border: "1px solid " + border,
                cursor: disabled ? "not-allowed" : "pointer",
                transition: "all 0.1s",
              }}
            >
              {date.getDate()}
            </div>
          );
        })}
      </div>

      {/* Selected info */}
      {selectedFrom && (
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--text2)", background: "var(--bg2)", borderRadius: 8, padding: "7px 12px" }}>
          {selectedTo
            ? ("Von " + parseDate(selectedFrom).toLocaleDateString("de-CH") + " bis " + parseDate(selectedTo).toLocaleDateString("de-CH"))
            : ("Von: " + parseDate(selectedFrom).toLocaleDateString("de-CH") + " - Enddatum waehlen...")}
        </div>
      )}
    </div>
  );
}
