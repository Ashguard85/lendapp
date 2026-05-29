import { useState, useEffect } from "react";

const DAYS   = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTHS = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function isBlocked(date, blockedRanges) {
  const ds = isoDate(date);
  for (const r of blockedRanges) {
    if (r.open) {
      if (ds >= r.from) return true;
    } else {
      if (ds >= r.from && ds <= r.to) return true;
    }
  }
  return false;
}

function isInRange(date, from, to) {
  if (!from) return false;
  const ds = isoDate(date);
  if (!to) return ds === isoDate(from);
  return ds >= isoDate(from) && ds <= isoDate(to);
}

export default function BookingCalendar({ blockedRanges = [], onSelect, selectedFrom, selectedTo }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [hoverDate, setHoverDate] = useState(null);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  // Build calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1);
  // Monday-based: 0=Mon … 6=Sun
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewYear, viewMonth, d));

  function handleClick(date) {
    if (!date) return;
    date.setHours(0, 0, 0, 0);
    if (isBlocked(date, blockedRanges)) return;
    if (date < today) return;
    onSelect(date);
  }

  const previewTo = hoverDate || selectedTo;

  return (
    <div style={{ userSelect: "none" }}>
      {/* Legend */}
      <div style={{ display: "flex", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
        {[
          { color: "#EAF3DE", border: "var(--accent-mid)", label: "Ausgewählt" },
          { color: "#FAEBD7", border: "#F0A060", label: "Gesperrt / Puffer" },
          { color: "var(--bg2)", border: "var(--border)", label: "Frei" },
        ].map(l => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text2)" }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: l.color, border: `1px solid ${l.border}` }} />
            {l.label}
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button onClick={prevMonth} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 10px", cursor: "pointer", color: "var(--text2)" }}>‹</button>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{MONTHS[viewMonth]} {viewYear}</div>
        <button onClick={nextMonth} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 10px", cursor: "pointer", color: "var(--text2)" }}>›</button>
      </div>

      {/* Day headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
        {DAYS.map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 10, color: "var(--text3)", fontWeight: 600, padding: "2px 0" }}>{d}</div>
        ))}
      </div>

      {/* Days grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {cells.map((date, i) => {
          if (!date) return <div key={i} />;

          const blocked  = isBlocked(date, blockedRanges);
          const past     = date < today;
          const inRange  = isInRange(date, selectedFrom, previewTo);
          const isFrom   = selectedFrom && isoDate(date) === isoDate(selectedFrom);
          const isTo     = selectedTo   && isoDate(date) === isoDate(selectedTo);
          const isHover  = hoverDate    && isoDate(date) === isoDate(hoverDate);
          const disabled = blocked || past;

          let bg     = "var(--bg2)";
          let color  = "var(--text)";
          let border = "transparent";
          let fw     = 400;

          if (disabled) {
            bg     = blocked ? "#FAEBD7" : "transparent";
            color  = blocked ? "#C08060" : "var(--text3)";
            border = blocked ? "#F0A060" : "transparent";
          } else if (isFrom || isTo) {
            bg     = "var(--accent)";
            color  = "#fff";
            border = "var(--accent)";
            fw     = 700;
          } else if (inRange) {
            bg     = "#D4EABD";
            border = "var(--accent-light)";
          } else if (isHover && selectedFrom && !selectedTo) {
            bg     = "#E8F5D5";
            border = "var(--accent-mid)";
          }

          return (
            <div
              key={i}
              onClick={() => !disabled && handleClick(date)}
              onMouseEnter={() => selectedFrom && !selectedTo && !disabled && setHoverDate(date)}
              onMouseLeave={() => setHoverDate(null)}
              style={{
                textAlign: "center", padding: "5px 2px", borderRadius: 6,
                fontSize: 12, fontWeight: fw,
                background: bg, color, border: `1px solid ${border}`,
                cursor: disabled ? "not-allowed" : "pointer",
                transition: "all 0.1s",
              }}
            >
              {date.getDate()}
            </div>
          );
        })}
      </div>

      {/* Selected range info */}
      {selectedFrom && (
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--text2)", background: "var(--bg2)", borderRadius: 8, padding: "8px 12px" }}>
          {selectedTo ? (
            <>📅 <strong>{selectedFrom.toLocaleDateString("de-CH")}</strong> – <strong>{selectedTo.toLocaleDateString("de-CH")}</strong></>
          ) : (
            <>📅 Von: <strong>{selectedFrom.toLocaleDateString("de-CH")}</strong> · Enddatum wählen…</>
          )}
        </div>
      )}
    </div>
  );
}
