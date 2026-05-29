import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import * as api from "../api/client";

const STATUS_BADGE = {
  pending: "badge-orange",
  approved: "badge-green",
  rejected: "badge-gray",
  returned: "badge-blue",
};
const STATUS_LABEL = {
  pending: "⏳ ausstehend",
  approved: "✓ genehmigt",
  rejected: "✕ abgelehnt",
  returned: "↩ zurückgegeben",
};

export default function BookingsPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [items, setItems] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getBookingsForUser(user.user_id).then(async (bks) => {
      setBookings(bks);
      const itemMap = {};
      await Promise.all(bks.map(async b => {
        if (!itemMap[b.item_id]) {
          try { itemMap[b.item_id] = await api.getItem(b.item_id); } catch {}
        }
      }));
      setItems(itemMap);
    }).finally(() => setLoading(false));
  }, [user]);

  if (loading) return <div style={{ padding: 32, color: "var(--text3)" }}>Lädt…</div>;

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Meine Anfragen</div>
        <div className="page-sub">Buchungen die du gestellt hast</div>
      </div>

      {bookings.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📋</div>
          <div className="empty-text">Noch keine Buchungsanfragen.</div>
        </div>
      ) : (
        <div className="card">
          {bookings.map(b => {
            const item = items[b.item_id];
            return (
              <div key={b.id} className="booking-row">
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{item?.name || `Item #${b.item_id}`}</div>
                  <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
                    {new Date(b.date_from).toLocaleDateString("de-CH")} – {new Date(b.date_to).toLocaleDateString("de-CH")}
                  </div>
                  {b.note && <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>„{b.note}"</div>}
                </div>
                <span className={`badge ${STATUS_BADGE[b.status]}`}>{STATUS_LABEL[b.status]}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
