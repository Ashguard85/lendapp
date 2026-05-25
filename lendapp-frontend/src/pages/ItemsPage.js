useEffect(() => {
  if (!groupId) return setLoading(false);
  api.getItems(groupId, user.user_id).then(setItems).finally(() => setLoading(false));
}, [groupId, user.user_id]);
import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { CATEGORY_EMOJI } from "../components/Sidebar";
import * as api from "../api/client";

const CATEGORIES = ["Werkzeug", "Sport", "Haushalt", "Elektronik", "Sonstiges"];

function AddItemModal({ onClose, onSaved, groupId, userId }) {
  const [form, setForm] = useState({
    name: "", description: "", category: "Werkzeug",
    max_days: 14, group_id: parseInt(groupId, 10)
  });
  const [imageUrl, setImageUrl] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef();

  async function handleImage(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await api.uploadImage(file);
      setImageUrl(url);
      setImagePreview(URL.createObjectURL(file));
    } catch (e) { setError("Bild-Upload fehlgeschlagen"); }
    finally { setUploading(false); }
  }

  async function handleSave() {
    if (!form.name.trim()) return setError("Name ist Pflicht");
    setLoading(true);
    try {
      await api.createItem(
        { ...form, max_days: Number(form.max_days), image_url: imageUrl },
        userId
      );
      onSaved();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">➕ Gegenstand erfassen</div>
        <div
          onClick={() => fileRef.current.click()}
          style={{
            width: "100%", height: 120, borderRadius: 12, marginBottom: 16,
            border: "2px dashed var(--border)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden", background: "var(--bg2)",
          }}
        >
          {imagePreview ? (
            <img src={imagePreview} alt="Vorschau"
              style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ textAlign: "center", color: "var(--text3)" }}>
              <div style={{ fontSize: 32 }}>📷</div>
              <div style={{ fontSize: 12 }}>{uploading ? "Lädt hoch…" : "Bild hinzufügen (optional)"}</div>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={handleImage} />
        <div className="form-group">
          <label className="form-label">Name *</label>
          <input className="form-input" placeholder="z.B. Bohrmaschine"
            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Kategorie</label>
          <select className="form-input" value={form.category}
            onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Beschreibung</label>
          <textarea className="form-input" placeholder="Zustand, Hinweise…"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Max. Ausleihzeit (Tage)</label>
          <input className="form-input" type="number" min="1" max="365"
            value={form.max_days}
            onChange={e => setForm(f => ({ ...f, max_days: e.target.value }))} />
        </div>
        {error && <div style={{ color: "var(--warn)", fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave}
            disabled={loading || uploading}>
            {loading ? "…" : "Speichern"}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Abbrechen</button>
        </div>
      </div>
    </div>
  );
}

function BookingModal({ item, userId, onClose, onBooked }) {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleBook() {
    if (!to) return setError("Bitte Enddatum wählen");
    setLoading(true);
    try {
      await api.requestBooking({
        item_id: item.id,
        date_from: new Date(from).toISOString(),
        date_to: new Date(to).toISOString(),
        note
      }, userId);
      onBooked();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">📅 {item.name} anfragen</div>
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label className="form-label">Von</label>
            <input className="form-input" type="date" value={from} min={today}
              onChange={e => setFrom(e.target.value)} />
          </div>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label className="form-label">Bis</label>
            <input className="form-input" type="date" value={to} min={from}
              onChange={e => setTo(e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Notiz (optional)</label>
          <input className="form-input" placeholder="Kurze Nachricht…" value={note}
            onChange={e => setNote(e.target.value)} />
        </div>
        {error && <div style={{ color: "var(--warn)", fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleBook}
            disabled={loading}>{loading ? "…" : "Anfrage senden"}</button>
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

  useEffect(() => {
    api.getItem(id).then(setItem);
    api.getBookingsForItem(id).then(setBookings);
  }, [id]);

  if (!item) return <div style={{ padding: 32, color: "var(--text3)" }}>Lädt…</div>;

  const isOwner = item.owner_id === user.user_id;

  async function handleStatusChange(bookingId, status) {
    await api.updateBookingStatus(bookingId, status, user.user_id);
    api.getBookingsForItem(id).then(setBookings);
    api.getItem(id).then(setItem);
  }

  return (
    <div>
      <button className="btn btn-secondary btn-sm" style={{ marginBottom: 20 }}
        onClick={() => navigate("/items")}>← Zurück</button>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div className="card" style={{ marginBottom: 16 }}>
            {item.image_url ? (
              <img src={item.image_url} alt={item.name}
                style={{ width: "100%", height: 180, objectFit: "cover", borderRadius: 10, marginBottom: 14 }} />
            ) : (
              <div style={{ fontSize: 48, width: "100%", height: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg2)", borderRadius: 10, marginBottom: 14 }}>
                {CATEGORY_EMOJI[item.category] || "📦"}
              </div>
            )}
            <div style={{ fontSize: 20, fontWeight: 600 }}>{item.name}</div>
            <div style={{ color: "var(--text2)", fontSize: 13, marginBottom: 8 }}>{item.category}</div>
            <span className={`badge ${item.is_available ? "badge-green" : "badge-orange"}`}>
              {item.is_available ? "✓ verfügbar" : "ausgeliehen"}
            </span>
            {item.description && (
              <p style={{ marginTop: 14, fontSize: 14, color: "var(--text2)", lineHeight: 1.6 }}>
                {item.description}
              </p>
            )}
            <div className="divider" />
            <div style={{ display: "flex", gap: 20, fontSize: 13, color: "var(--text2)" }}>
              <span>Max. <strong>{item.max_days}</strong> Tage</span>
              <span>Besitzer ID: <strong>{item.owner_id}</strong></span>
            </div>
          </div>
          {!isOwner && item.is_available && (
            <button className="btn btn-primary btn-full" onClick={() => setShowBook(true)}>
              📅 Jetzt anfragen
            </button>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 14 }}>Buchungshistorie</div>
            {bookings.length === 0 && (
              <div style={{ color: "var(--text3)", fontSize: 13 }}>Noch keine Buchungen.</div>
            )}
            {bookings.map(b => (
              <div key={b.id} className="booking-row">
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>User #{b.borrower_id}</div>
                  <div style={{ fontSize: 12, color: "var(--text3)" }}>
                    {new Date(b.date_from).toLocaleDateString("de-CH")} – {new Date(b.date_to).toLocaleDateString("de-CH")}
                  </div>
                  {b.note && <div style={{ fontSize: 12, color: "var(--text2)", fontStyle: "italic" }}>{b.note}</div>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                  <span className={`badge ${b.status === "approved" ? "badge-green" : b.status === "pending" ? "badge-orange" : b.status === "returned" ? "badge-blue" : "badge-gray"}`}>
                    {b.status}
                  </span>
                  {isOwner && b.status === "pending" && (
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn btn-sm" style={{ background: "var(--accent-light)", color: "var(--accent)", padding: "3px 8px", fontSize: 11 }}
                        onClick={() => handleStatusChange(b.id, "approved")}>✓</button>
                      <button className="btn btn-sm btn-danger" style={{ padding: "3px 8px", fontSize: 11 }}
                        onClick={() => handleStatusChange(b.id, "rejected")}>✕</button>
                    </div>
                  )}
                  {isOwner && b.status === "approved" && (
                    <button className="btn btn-sm" style={{ padding: "3px 8px", fontSize: 11, background: "var(--blue-light)", color: "var(--blue)", border: "none" }}
                      onClick={() => handleStatusChange(b.id, "returned")}>↩ Zurück</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {showBook && (
        <BookingModal item={item} userId={user.user_id}
          onClose={() => setShowBook(false)}
          onBooked={() => { setShowBook(false); api.getBookingsForItem(id).then(setBookings); }} />
      )}
    </div>
  );
}

export default function ItemsPage() {
  const { user, groupId } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("Alle");
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  function load() {
    if (!groupId) return setLoading(false);
    api.getItems(groupId, user.user_id).then(setItems).finally(() => setLoading(false));
  }
  useEffect(load, [groupId, user]);

  const filters = ["Alle", "Verfügbar", ...CATEGORIES];
  const filtered = items.filter(i => {
    if (filter === "Alle") return true;
    if (filter === "Verfügbar") return i.is_available;
    return i.category === filter;
  });

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="page-title">Gegenstände</div>
          <div className="page-sub">{items.length} Gegenstände in der Gruppe</div>
        </div>
        {groupId && (
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Erfassen</button>
        )}
      </div>
      <div className="chip-row" style={{ marginBottom: 20 }}>
        {filters.map(f => (
          <div key={f} className={`chip ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>{f}</div>
        ))}
      </div>
      {loading ? <div style={{ color: "var(--text3)" }}>Lädt…</div> : (
        <div className="card-grid">
          {filtered.map(item => (
            <div key={item.id} className="item-card" onClick={() => navigate(`/items/${item.id}`)}>
              {item.image_url ? (
                <img src={item.image_url} alt={item.name}
                  style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 10 }} />
              ) : (
                <div className="item-emoji">{CATEGORY_EMOJI[item.category] || "📦"}</div>
              )}
              <div>
                <div className="item-name">{item.name}</div>
                <div className="item-meta">{item.category}</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className={`badge ${item.is_available ? "badge-green" : "badge-orange"}`}>
                  {item.is_available ? "✓ verfügbar" : "ausgeliehen"}
                </span>
                <span className="tag">max. {item.max_days}d</span>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="empty" style={{ gridColumn: "1/-1" }}>
              <div className="empty-icon">📦</div>
              <div className="empty-text">Keine Gegenstände gefunden.</div>
            </div>
          )}
        </div>
      )}
      {showAdd && (
        <AddItemModal groupId={groupId} userId={user.user_id}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load(); }} />
      )}
    </div>
  );
}
