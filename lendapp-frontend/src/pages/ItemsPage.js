import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { CATEGORY_EMOJI } from "../components/Sidebar";
import * as api from "../api/client";
import BookingCalendar from "../components/BookingCalendar";
import BookingOverview from "../components/BookingOverview";

const CATEGORIES = ["Werkzeug", "Sport", "Haushalt", "Elektronik", "Sonstiges"];

function fmt(date) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const STATUS_LABEL = { pending: "ausstehend", approved: "genehmigt", rejected: "abgelehnt", returned: "zuruckgegeben", external: "extern" };
const STATUS_BADGE = { pending: "badge-orange", approved: "badge-green", rejected: "badge-gray", returned: "badge-blue", external: "badge-orange" };

function ImageField({ currentUrl, onUploaded, onDeleted }) {
  const [preview, setPreview] = useState(currentUrl || null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await api.uploadImage(file);
      setPreview(result.url);
      onUploaded(result);
    } catch (err) { alert("Upload fehlgeschlagen"); }
    finally { setUploading(false); }
  }

  async function handleDelete() {
    if (currentUrl) await api.deleteImage(currentUrl);
    setPreview(null);
    onDeleted();
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div onClick={() => !preview && fileRef.current.click()} style={{
        width: "100%", height: 110, borderRadius: 12,
        border: preview ? "none" : "2px dashed var(--border)",
        cursor: preview ? "default" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden", background: "var(--bg2)", position: "relative",
      }}>
        {preview ? (
          <>
            <img src={preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 4 }}>
              <button onClick={e => { e.stopPropagation(); fileRef.current.click(); }}
                style={{ background: "rgba(0,0,0,0.6)", border: "none", borderRadius: 6, color: "#fff", padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>Ersetzen</button>
              <button onClick={e => { e.stopPropagation(); handleDelete(); }}
                style={{ background: "rgba(200,0,0,0.7)", border: "none", borderRadius: 6, color: "#fff", padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>Loschen</button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", color: "var(--text3)" }}>
            <div style={{ fontSize: 28 }}>📷</div>
            <div style={{ fontSize: 12 }}>{uploading ? "Ladt hoch..." : "Bild hinzufugen (optional)"}</div>
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
    </div>
  );
}

function ItemModal({ item, onClose, onSaved, groupId, userId }) {
  const isEdit = !!item;
  const [form, setForm] = useState({
    name: isEdit ? item.name : "",
    description: isEdit ? item.description : "",
    category: isEdit ? item.category : "Werkzeug",
    max_days: isEdit ? item.max_days : 14,
    group_id: parseInt(groupId, 10),
  });
  const [imageUrl, setImageUrl] = useState(isEdit ? item.image_url : null);
  const [thumbUrl, setThumbUrl] = useState(isEdit ? item.thumb_url : null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!form.name.trim()) return setError("Name ist Pflicht");
    setLoading(true);
    try {
      if (isEdit) {
        await api.updateItem(item.id, { ...form, max_days: Number(form.max_days), image_url: imageUrl, thumb_url: thumbUrl }, userId);
      } else {
        await api.createItem({ ...form, max_days: Number(form.max_days), image_url: imageUrl, thumb_url: thumbUrl }, userId);
      }
      onSaved();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{isEdit ? "Bearbeiten" : "Gegenstand erfassen"}</div>
        <ImageField currentUrl={imageUrl}
          onUploaded={r => { setImageUrl(r.url); setThumbUrl(r.thumb_url); }}
          onDeleted={() => { setImageUrl(null); setThumbUrl(null); }} />
        <div className="form-group"><label className="form-label">Name</label>
          <input className="form-input" placeholder="z.B. Bohrmaschine" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
        <div className="form-group"><label className="form-label">Kategorie</label>
          <select className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
        <div className="form-group"><label className="form-label">Beschreibung</label>
          <textarea className="form-input" placeholder="Zustand, Hinweise..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
        <div className="form-group"><label className="form-label">Max. Ausleihzeit (Tage)</label>
          <input className="form-input" type="number" min="1" max="365" value={form.max_days} onChange={e => setForm(f => ({ ...f, max_days: e.target.value }))} /></div>
        {error && <div style={{ color: "var(--warn)", fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={loading}>{loading ? "..." : "Speichern"}</button>
          <button className="btn btn-secondary" onClick={onClose}>Abbrechen</button>
        </div>
      </div>
    </div>
  );
}

function BookingModal({ item, userId, onClose, onBooked, bookings }) {
  function toStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const dd = String(d.getDate()).padStart(2,"0");
    return y+"-"+m+"-"+dd;
  }

  // Immer ab heute buchbar - gesperrte Zeitraeume zeigt der Kalender selbst
  const today = new Date(); today.setHours(0,0,0,0);
  const minFrom = toStr(today);
  const [selected, setSelected] = useState({ from: "", to: "" });
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Gesperrte Zeitraeume aus vorhandenen Buchungen berechnen
  const blockedRanges = (bookings || [])
    .filter(b => b.status === "approved" || b.status === "external")
    .map(b => {
      if (!b.date_from) return null;
      const fromP = b.date_from.slice(0,10).split("-");
      const fromD = new Date(parseInt(fromP[0]), parseInt(fromP[1])-1, parseInt(fromP[2])-1);
      if (!b.date_to) return { from: toStr(fromD), to: null, open: true };
      const toP = b.date_to.slice(0,10).split("-");
      const toD = new Date(parseInt(toP[0]), parseInt(toP[1])-1, parseInt(toP[2])+1);
      return { from: toStr(fromD), to: toStr(toD), open: false };
    }).filter(Boolean);

  async function handleBook() {
    if (!selected.from || !selected.to) return setError("Bitte Von- und Bis-Datum waehlen");
    setLoading(true);
    try {
      const p1 = selected.from.split("-");
      const p2 = selected.to.split("-");
      const dateFrom = new Date(parseInt(p1[0]), parseInt(p1[1])-1, parseInt(p1[2]));
      const dateTo   = new Date(parseInt(p2[0]), parseInt(p2[1])-1, parseInt(p2[2]));
      await api.requestBooking({ item_id: item.id, date_from: dateFrom.toISOString(), date_to: dateTo.toISOString(), note }, userId);
      onBooked();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-title">{item.name} anfragen</div>
        <p style={{ fontSize: 11, color: "var(--text3)", marginBottom: 10 }}>
          Klick auf Startdatum, dann Enddatum waehlen.
        </p>
        <BookingCalendar
          blockedRanges={blockedRanges}
          minDate={minFrom}
          maxDays={item.max_days}
          selectedFrom={selected.from}
          selectedTo={selected.to}
          onSelect={s => { setSelected(s); setError(""); }}
        />
        <div className="form-group" style={{ marginTop: 12 }}>
          <label className="form-label">Notiz (optional)</label>
          <input className="form-input" placeholder="Kurze Nachricht..." value={note} onChange={e => setNote(e.target.value)} />
        </div>
        {error && <div style={{ color: "var(--warn)", fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleBook} disabled={loading || !selected.from || !selected.to}>
            {loading ? "..." : "Anfrage senden"}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Abbrechen</button>
        </div>
      </div>
    </div>
  );
}

function ExternalBookingModal({ item, userId, onClose, onBooked, bookings }) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState({ from: "", to: "" });
  const [noEnd, setNoEnd] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function toStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const dd = String(d.getDate()).padStart(2,"0");
    return y+"-"+m+"-"+dd;
  }

  const today = toStr(new Date());
  // Immer ab heute - gesperrte Zeitraeume zeigt Kalender

  // Gesperrte Zeitraeume aus bestehenden Buchungen
  const blockedRanges = (bookings || [])
    .filter(b => b.status === "approved" || b.status === "external")
    .map(b => {
      if (!b.date_from) return null;
      const fromP = b.date_from.slice(0,10).split("-");
      const fromD = new Date(parseInt(fromP[0]), parseInt(fromP[1])-1, parseInt(fromP[2])-1);
      if (!b.date_to) return { from: toStr(fromD), to: null, open: true };
      const toP = b.date_to.slice(0,10).split("-");
      const toD = new Date(parseInt(toP[0]), parseInt(toP[1])-1, parseInt(toP[2])+1);
      return { from: toStr(fromD), to: toStr(toD), open: false };
    }).filter(Boolean);

  async function handleSave() {
    if (!name.trim()) return setError("Bitte Name / Grund eingeben");
    if (!selected.from) return setError("Bitte Startdatum waehlen");
    if (!noEnd && !selected.to) return setError("Bitte Enddatum waehlen oder Kein Enddatum aktivieren");
    setLoading(true);
    try {
      const p1 = selected.from.split("-");
      const dateFrom = new Date(parseInt(p1[0]), parseInt(p1[1])-1, parseInt(p1[2]));
      let dateTo = null;
      if (!noEnd && selected.to) {
        const p2 = selected.to.split("-");
        dateTo = new Date(parseInt(p2[0]), parseInt(p2[1])-1, parseInt(p2[2]));
      }
      await api.requestBooking({
        item_id: item.id,
        date_from: dateFrom.toISOString(),
        date_to: dateTo ? dateTo.toISOString() : null,
        note,
        external_name: name,
      }, userId);
      onBooked();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-title">Extern / Eigenbedarf</div>
        <div className="form-group">
          <label className="form-label">Person / Grund</label>
          <input className="form-input" placeholder="z.B. Urs oder Eigenbedarf" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <input type="checkbox" id="noend2" checked={noEnd} onChange={e => { setNoEnd(e.target.checked); if (e.target.checked) setSelected(s => ({ ...s, to: "" })); }} />
          <label htmlFor="noend2" style={{ fontSize: 13, color: "var(--text2)" }}>Kein Enddatum (offen)</label>
        </div>
        <p style={{ fontSize: 11, color: "var(--text3)", marginBottom: 10 }}>
          {noEnd ? "Startdatum waehlen." : "Startdatum dann Enddatum waehlen."}
        </p>
        <BookingCalendar
          blockedRanges={blockedRanges}
          minDate={today}
          maxDays={null}
          selectedFrom={selected.from}
          selectedTo={noEnd ? selected.from : selected.to}
          onSelect={s => {
            if (noEnd) {
              setSelected({ from: s.from, to: s.from });
            } else {
              setSelected(s);
            }
            setError("");
          }}
        />
        <div className="form-group" style={{ marginTop: 12 }}>
          <label className="form-label">Notiz (optional)</label>
          <input className="form-input" placeholder="Weitere Infos..." value={note} onChange={e => setNote(e.target.value)} />
        </div>
        {error && <div style={{ color: "var(--warn)", fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={loading}>{loading ? "..." : "Erfassen"}</button>
          <button className="btn btn-secondary" onClick={onClose}>Abbrechen</button>
        </div>
      </div>
    </div>
  );
}

export function ItemDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [showBook, setShowBook] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showExternal, setShowExternal] = useState(false);

  function load() {
    api.getItem(id).then(setItem).catch(() => {});
    api.getBookingsForItem(id).then(setBookings).catch(() => {});
  }
  useEffect(load, [id]);

  if (!item) return <div style={{ padding: 32, color: "var(--text3)" }}>Ladt...</div>;

  const isOwner = item.owner_id === user.user_id;
  const activeBooking = bookings.find(b => b.status === "approved" || b.status === "external");

  async function handleStatus(bookingId, status) {
    await api.updateBookingStatus(bookingId, status, user.user_id);
    load();
  }

  async function handleDelete() {
    if (!window.confirm(item.name + " wirklich loschen?")) return;
    if (item.image_url) await api.deleteImage(item.image_url);
    await api.deleteItem(item.id, user.user_id);
    navigate("/items");
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate("/items")}>Zuruck</button>
        {isOwner && (
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowEdit(true)}>Bearbeiten</button>
            <button className="btn btn-danger btn-sm" onClick={handleDelete}>Loschen</button>
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div className="card" style={{ marginBottom: 16 }}>
            {item.image_url ? (
              <img src={item.image_url} alt={item.name} style={{ width: "100%", height: 180, objectFit: "cover", borderRadius: 10, marginBottom: 14 }} />
            ) : (
              <div style={{ fontSize: 48, width: "100%", height: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg2)", borderRadius: 10, marginBottom: 14 }}>
                {CATEGORY_EMOJI[item.category] || "📦"}
              </div>
            )}
            <div style={{ fontSize: 20, fontWeight: 600 }}>{item.name}</div>
            <div style={{ color: "var(--text2)", fontSize: 13, marginBottom: 8 }}>{item.category}</div>
            <span className={"badge " + (item.is_available ? "badge-green" : "badge-orange")}>
              {item.is_available ? "verfugbar" : "ausgeliehen"}
            </span>
            {!item.is_available && activeBooking && (
              <div style={{ marginTop: 8, fontSize: 13, color: "var(--text2)" }}>
                Bei <strong>{activeBooking.borrower_name}</strong>
                {activeBooking.date_to ? (" bis " + fmt(activeBooking.date_to)) : " (offen)"}
              </div>
            )}
            {!item.is_available && activeBooking && activeBooking.date_to && (
              <div style={{ marginTop: 4, fontSize: 12, color: "var(--accent)", background: "var(--accent-light)", borderRadius: 8, padding: "4px 10px", display: "inline-block" }}>
                {(() => {
                  const p = activeBooking.date_to.slice(0, 10).split("-");
                  const next = new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]) + 1);
                  return "Fruhestens buchbar ab " + next.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
                })()}
              </div>
            )}
            {item.description && <p style={{ marginTop: 14, fontSize: 14, color: "var(--text2)", lineHeight: 1.6 }}>{item.description}</p>}
            <div className="divider" />
            <div style={{ fontSize: 13, color: "var(--text2)" }}>Max. <strong>{item.max_days}</strong> Tage</div>
          </div>
          {!isOwner && (
            <button className="btn btn-primary btn-full" style={{ marginBottom: 8 }} onClick={() => setShowBook(true)}>
              {item.is_available ? "Jetzt anfragen" : "Zukunftige Buchung anfragen"}
            </button>
          )}
          {isOwner && (
            <button className="btn btn-secondary btn-full" style={{ marginTop: 8 }} onClick={() => setShowExternal(true)}>Extern / Eigenbedarf</button>
          )}
          {isOwner && !item.is_available && activeBooking && (
            <button className="btn btn-secondary btn-full" onClick={() => handleStatus(activeBooking.id, "returned")}>Als zuruckgegeben markieren</button>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 260 }}>
          {isOwner && bookings.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 12 }}>Belegungskalender</div>
              <BookingOverview bookings={bookings} />
            </div>
          )}
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 14 }}>Buchungshistorie</div>
            {bookings.length === 0 && <div style={{ color: "var(--text3)", fontSize: 13 }}>Noch keine Buchungen.</div>}
            {bookings.map(b => (
              <div key={b.id} className="booking-row">
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{b.borrower_name}</div>
                  <div style={{ fontSize: 12, color: "var(--text3)" }}>{fmt(b.date_from)} - {b.date_to ? fmt(b.date_to) : "offen"}</div>
                  {b.note && <div style={{ fontSize: 12, color: "var(--text2)", fontStyle: "italic" }}>{b.note}</div>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                  <span className={"badge " + STATUS_BADGE[b.status]}>{STATUS_LABEL[b.status]}</span>
                  {isOwner && b.status === "pending" && (
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn btn-sm" style={{ background: "var(--accent-light)", color: "var(--accent)", padding: "3px 8px", fontSize: 11 }} onClick={() => handleStatus(b.id, "approved")}>Ja</button>
                      <button className="btn btn-sm btn-danger" style={{ padding: "3px 8px", fontSize: 11 }} onClick={() => handleStatus(b.id, "rejected")}>Nein</button>
                    </div>
                  )}
                  {isOwner && (b.status === "approved" || b.status === "external") && (
                    <button className="btn btn-sm" style={{ padding: "3px 8px", fontSize: 11, background: "var(--blue-light)", color: "var(--blue)", border: "none" }} onClick={() => handleStatus(b.id, "returned")}>Zuruck</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {showBook && <BookingModal item={item} userId={user.user_id} bookings={bookings} onClose={() => setShowBook(false)} onBooked={() => { setShowBook(false); load(); }} />}
      {showEdit && <ItemModal item={item} userId={user.user_id} groupId={item.group_id} onClose={() => setShowEdit(false)} onSaved={() => { setShowEdit(false); load(); }} />}
      {showExternal && <ExternalBookingModal item={item} userId={user.user_id} bookings={bookings} onClose={() => setShowExternal(false)} onBooked={() => { setShowExternal(false); load(); }} />}
    </div>
  );
}

export default function ItemsPage() {
  const { user, groups } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("Alle");
  const [showAdd, setShowAdd] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (groups.length > 0 && !activeGroupId) setActiveGroupId(groups[0].id);
  }, [groups]);

  function load() {
    if (!groups.length) return setLoading(false);
    Promise.all(
      groups.map(g => api.getItems(g.id, user.user_id).then(its => its.map(i => ({ ...i, _groupName: g.name, _groupId: g.id }))))
    ).then(all => setItems(all.reduce((a, b) => a.concat(b), []))).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(load, [groups.map(g => g.id).join(","), user.user_id]);

  const filters = ["Alle", "Verfugbar", ...CATEGORIES];
  const filtered = items.filter(i => {
    if (filter === "Alle") return true;
    if (filter === "Verfugbar") return i.is_available;
    return i.category === filter;
  });

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="page-title">Gegenstande</div>
          <div className="page-sub">{items.length} Gegenstande in {groups.length} Gruppe{groups.length !== 1 ? "n" : ""}</div>
        </div>
        {groups.length > 0 && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {groups.length > 1 && (
              <select className="form-input" style={{ fontSize: 13, padding: "6px 10px", width: "auto" }}
                value={activeGroupId || ""} onChange={e => setActiveGroupId(Number(e.target.value))}>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            )}
            <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Erfassen</button>
          </div>
        )}
      </div>
      <div className="chip-row" style={{ marginBottom: 20 }}>
        {filters.map(f => (
          <div key={f} className={"chip " + (filter === f ? "active" : "")} onClick={() => setFilter(f)}>{f}</div>
        ))}
      </div>
      {loading ? <div style={{ color: "var(--text3)" }}>Ladt...</div> : (
        <div className="card-grid">
          {filtered.map(item => (
            <div key={item.id} className="item-card" onClick={() => navigate("/items/" + item.id)}>
              {item.thumb_url ? (
                <img src={item.thumb_url} alt={item.name} style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 10 }} />
              ) : (
                <div className="item-emoji">{CATEGORY_EMOJI[item.category] || "📦"}</div>
              )}
              <div>
                <div className="item-name">{item.name}</div>
                <div className="item-meta">{item.category} - {item._groupName}</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className={"badge " + (item.is_available ? "badge-green" : "badge-orange")}>
                  {item.is_available ? "verfugbar" : "ausgeliehen"}
                </span>
                <span className="tag">max. {item.max_days}d</span>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="empty" style={{ gridColumn: "1/-1" }}>
              <div className="empty-icon">📦</div>
              <div className="empty-text">Keine Gegenstande gefunden.</div>
            </div>
          )}
        </div>
      )}
      {showAdd && (
        <ItemModal
          groupId={activeGroupId || (groups[0] && groups[0].id)}
          userId={user.user_id}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load(); }} />
      )}
    </div>
  );
}
