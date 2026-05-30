import { useState } from "react";

const DAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTHS = ["Januar","Februar","Maerz","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

const STATUS_COLOR = {
  approved: { bg: "#2D5016", color: "#fff", label: "Genehmigt" },
  external: { bg: "#854F0B", color: "#fff", label: "Extern/Eigenbedarf" },
  pending:  { bg: "#E8A020", color: "#fff", label: "Ausstehend" },
  returned: { bg: "#888780", color: "#fff", label: "Zurueck" },
  rejected: { bg: "#ccc",    color: "#555", label: "Abgelehnt" },
};

function toStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return y+"-"+m+"-"+dd;
}

function parseDate(str) {
  if (!str) return null;
  const p = str.slice(0,10).split("-");
  return new Date(parseInt(p[0]), parseInt(p[1])-1, parseInt(p[2]));
}

function getBookingForDate(date, bookings) {
  const ds = toStr(date);
  for (const b of bookings) {
    if (!b.date_from) continue;
    const from = b.date_from.slice(0,10);
    const to   = b.date_to ? b.date_to.slice(0,10) : null;
    if (to === null) {
      if (ds >= from) return b;
    } else {
      if (ds >= from && ds <= to) return b;
    }
  }
  return null;
}

export default function BookingOverview({ bookings }) {
  const today = new Date(); today.setHours(0,0,0,0);
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [tooltip,   setTooltip]   = useState(null);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y-1); }
    else setViewMonth(m => m-1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y+1); }
    else setViewMonth(m => m+1);
  }

  const firstDay = new Date(viewYear, viewMonth, 1);
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;
  const daysInMonth = new Date(viewYear, viewMonth+1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewYear, viewMonth, d));

  // Aktive Buchungen filtern
  const active = bookings.filter(b => b.status === "approved" || b.status === "external" || b.status === "pending");

  return (
    <div>
      {/* Legende */}
      <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        {Object.entries(STATUS_COLOR).filter(([k]) => k !== "rejected").map(([k, v]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text2)" }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: v.bg }} />
            {v.label}
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <button onClick={prevMonth} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 10px", cursor: "pointer", color: "var(--text2)", fontSize: 14 }}>{"<"}</button>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{MONTHS[viewMonth]} {viewYear}</div>
        <button onClick={nextMonth} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 10px", cursor: "pointer", color: "var(--text2)", fontSize: 14 }}>{">"}</button>
      </div>

      {/* Wochentage */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 3 }}>
        {DAYS.map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 10, color: "var(--text3)", fontWeight: 600 }}>{d}</div>
        ))}
      </div>

      {/* Tage */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, position: "relative" }}>
        {cells.map((date, i) => {
          if (!date) return <div key={i} />;

          const booking = getBookingForDate(date, active);
          const isToday = toStr(date) === toStr(today);
          const sc = booking ? (STATUS_COLOR[booking.status] || STATUS_COLOR.approved) : null;

          return (
            <div key={i}
              onMouseEnter={() => booking && setTooltip({ booking, date })}
              onMouseLeave={() => setTooltip(null)}
              style={{
                textAlign: "center", padding: "5px 2px", borderRadius: 6,
                fontSize: 12, fontWeight: isToday ? 700 : 400,
                background: sc ? sc.bg : "var(--bg2)",
                color: sc ? sc.color : isToday ? "var(--accent)" : "var(--text)",
                border: isToday && !sc ? "1px solid var(--accent-mid)" : "1px solid transparent",
                cursor: booking ? "pointer" : "default",
                position: "relative",
              }}
            >
              {date.getDate()}
            </div>
          );
        })}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div style={{ marginTop: 10, background: "var(--bg2)", borderRadius: 10, padding: "10px 14px", fontSize: 13, border: "1px solid var(--border)" }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{tooltip.booking.borrower_name}</div>
          <div style={{ fontSize: 12, color: "var(--text3)" }}>
            {parseDate(tooltip.booking.date_from) && parseDate(tooltip.booking.date_from).toLocaleDateString("de-CH")}
            {" - "}
            {tooltip.booking.date_to ? parseDate(tooltip.booking.date_to).toLocaleDateString("de-CH") : "offen"}
          </div>
          {tooltip.booking.note && <div style={{ fontSize: 12, color: "var(--text2)", fontStyle: "italic", marginTop: 2 }}>{tooltip.booking.note}</div>}
          <div style={{ marginTop: 4 }}>
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: (STATUS_COLOR[tooltip.booking.status] || STATUS_COLOR.approved).bg, color: (STATUS_COLOR[tooltip.booking.status] || STATUS_COLOR.approved).color }}>
              {(STATUS_COLOR[tooltip.booking.status] || STATUS_COLOR.approved).label}
            </span>
          </div>
        </div>
      )}

      {/* Keine Buchungen */}
      {active.length === 0 && (
        <div style={{ textAlign: "center", color: "var(--text3)", fontSize: 13, marginTop: 8 }}>Keine Buchungen</div>
      )}
    </div>
  );
}
