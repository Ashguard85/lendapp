import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import * as api from "../../api/client";

const CATEGORIES = ["Werkzeug", "Sport", "Haushalt", "Elektronik", "Sonstiges"];

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-title">{title}</div>
        {children}
      </div>
    </div>
  );
}

export default function AdminItems() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [groups, setGroups] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", category: "Werkzeug", max_days: 14, group_id: "", owner_id: "", image_url: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    Promise.all([
      api.adminListItems(user.user_id),
      api.adminListGroups(user.user_id),
      api.adminListUsers(user.user_id),
    ]).then(([its, grps, usrs]) => { setItems(its); setGroups(grps); setUsers(usrs); })
      .finally(() => setLoading(false));
  }
  useEffect(load, [user]);

  async function handleCreate() {
    if (!form.name || !form.group_id || !form.owner_id) return setError("Name, Gruppe und Besitzer sind Pflicht");
    setSaving(true);
    try {
      await api.adminCreateItem({ ...form, group_id: Number(form.group_id), owner_id: Number(form.owner_id), max_days: Number(form.max_days) }, user.user_id);
      setShowCreate(false); load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleUpdate() {
    setSaving(true);
    try {
      await api.adminUpdateItem(editItem.id, {
        name: form.name, description: form.description,
        category: form.category, max_days: Number(form.max_days),
        is_available: form.is_available,
      }, user.user_id);
      setEditItem(null); load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Artikel „${item.name}" wirklich löschen?`)) return;
    await api.adminDeleteItem(item.id, user.user_id);
    load();
  }

  function openEdit(item) {
    setEditItem(item);
    setForm({ ...item, max_days: item.max_days });
    setError("");
  }

  function openCreate() {
    setForm({ name: "", description: "", category: "Werkzeug", max_days: 14, group_id: "", owner_id: "", image_url: "" });
    setShowCreate(true); setError("");
  }

  const FormFields = ({ isEdit }) => (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="form-group" style={{ gridColumn: "1/-1" }}>
          <label className="form-label">Name *</label>
          <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Kategorie</label>
          <select className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Max. Tage</label>
          <input className="form-input" type="number" value={form.max_days} onChange={e => setForm(f => ({ ...f, max_days: e.target.value }))} />
        </div>
        {!isEdit && (
          <>
            <div className="form-group">
              <label className="form-label">Gruppe *</label>
              <select className="form-input" value={form.group_id} onChange={e => setForm(f => ({ ...f, group_id: e.target.value }))}>
                <option value="">Wählen…</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Besitzer *</label>
              <select className="form-input" value={form.owner_id} onChange={e => setForm(f => ({ ...f, owner_id: e.target.value }))}>
                <option value="">Wählen…</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </>
        )}
        {isEdit && (
          <div className="form-group" style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <input type="checkbox" id="avail" checked={form.is_available}
              onChange={e => setForm(f => ({ ...f, is_available: e.target.checked }))} />
            <label htmlFor="avail" style={{ fontSize: 14 }}>Verfügbar</label>
          </div>
        )}
        <div className="form-group" style={{ gridColumn: "1/-1" }}>
          <label className="form-label">Beschreibung</label>
          <textarea className="form-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>
      </div>
      {error && <div style={{ color: "var(--warn)", fontSize: 13, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn btn-primary" style={{ flex: 1 }}
          onClick={isEdit ? handleUpdate : handleCreate} disabled={saving}>
          {saving ? "…" : isEdit ? "Speichern" : "Erstellen"}
        </button>
        <button className="btn btn-secondary" onClick={() => { setShowCreate(false); setEditItem(null); }}>Abbrechen</button>
      </div>
    </>
  );

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="page-title">Artikel</div>
          <div className="page-sub">{items.length} Artikel total</div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Artikel erstellen</button>
      </div>

      {loading ? <div style={{ color: "var(--text3)" }}>Lädt…</div> : (
        <div className="card">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text3)", fontSize: 11, textTransform: "uppercase" }}>
                <th style={{ padding: "8px 12px", textAlign: "left" }}>ID</th>
                <th style={{ padding: "8px 12px", textAlign: "left" }}>Name</th>
                <th style={{ padding: "8px 12px", textAlign: "left" }}>Kategorie</th>
                <th style={{ padding: "8px 12px", textAlign: "left" }}>Gruppe</th>
                <th style={{ padding: "8px 12px", textAlign: "left" }}>Besitzer</th>
                <th style={{ padding: "8px 12px", textAlign: "left" }}>Status</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {items.map(i => {
                const grp = groups.find(g => g.id === i.group_id);
                const owner = users.find(u => u.id === i.owner_id);
                return (
                  <tr key={i.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 12px", color: "var(--text3)", fontFamily: "monospace" }}>#{i.id}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 500 }}>{i.name}</td>
                    <td style={{ padding: "10px 12px", color: "var(--text2)" }}>{i.category}</td>
                    <td style={{ padding: "10px 12px", color: "var(--text2)" }}>{grp?.name || `#${i.group_id}`}</td>
                    <td style={{ padding: "10px 12px", color: "var(--text2)" }}>{owner?.name || `#${i.owner_id}`}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span className={`badge ${i.is_available ? "badge-green" : "badge-orange"}`}>
                        {i.is_available ? "verfügbar" : "ausgeliehen"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => openEdit(i)}>✏️</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(i)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <Modal title="📦 Artikel erstellen" onClose={() => setShowCreate(false)}>
          <FormFields isEdit={false} />
        </Modal>
      )}
      {editItem && (
        <Modal title={`✏️ ${editItem.name} bearbeiten`} onClose={() => setEditItem(null)}>
          <FormFields isEdit={true} />
        </Modal>
      )}
    </div>
  );
}
