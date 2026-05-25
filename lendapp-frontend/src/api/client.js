const BASE = "/api";

function headers(userId) {
  const h = { "Content-Type": "application/json" };
  if (userId) h["X-User-Id"] = String(userId);
  return h;
}

async function req(method, path, body, userId) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(userId),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Fehler");
  }
  if (res.status === 204) return null;
  return res.json();
}

// Auth
export const register = (data) => req("POST", "/users/register", data);
export const login = (email, password) =>
  req("POST", "/users/login", { email, password });

// Groups
export const createGroup = (data, uid) => req("POST", `/groups/?user_id=${uid}`, data, uid);
export const getGroup = (id) => req("GET", `/groups/${id}`);
export const joinGroup = (id, code, uid) => req("POST", `/groups/${id}/join?invite_code=${code}&user_id=${uid}`, {}, uid);
export const getMembers = (id) => req("GET", `/groups/${id}/members`);

// Items
export const createItem = (data, uid) => req("POST", `/items/?user_id=${uid}`, data, uid);
export const getItems = (groupId, uid) => req("GET", `/items/group/${groupId}?user_id=${uid}`, null, uid);
export const getItem = (id) => req("GET", `/items/${id}`);
export const updateItem = (id, data, uid) => req("PATCH", `/items/${id}?user_id=${uid}`, data, uid);
export const deleteItem = (id, uid) => req("DELETE", `/items/${id}?user_id=${uid}`, null, uid);

// Bookings
export const requestBooking = (data, uid) => req("POST", `/bookings/?user_id=${uid}`, data, uid);
export const getBookingsForItem = (itemId) => req("GET", `/bookings/item/${itemId}`);
export const getBookingsForUser = (uid) => req("GET", `/bookings/user/${uid}`);
export const updateBookingStatus = (id, status, uid) =>
  req("PATCH", `/bookings/${id}/status?user_id=${uid}`, { status }, uid);

// Upload
export async function uploadImage(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE}/upload/`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Upload fehlgeschlagen");
  const data = await res.json();
  return data.url;
}

// Admin
export const adminStats        = (uid) => req("GET", `/admin/stats?admin_id=${uid}`);
export const adminListUsers    = (uid) => req("GET", `/admin/users?admin_id=${uid}`);
export const adminCreateUser   = (data, uid) => req("POST", `/admin/users?admin_id=${uid}`, data);
export const adminUpdateUser   = (id, data, uid) => req("PATCH", `/admin/users/${id}?admin_id=${uid}`, data);
export const adminDeleteUser   = (id, uid) => req("DELETE", `/admin/users/${id}?admin_id=${uid}`);
export const adminResetPw      = (id, pw, uid) => req("POST", `/admin/users/${id}/reset-password?admin_id=${uid}`, { new_password: pw });
export const adminListGroups   = (uid) => req("GET", `/admin/groups?admin_id=${uid}`);
export const adminCreateGroup  = (data, uid) => req("POST", `/admin/groups?admin_id=${uid}`, data);
export const adminUpdateGroup  = (id, data, uid) => req("PATCH", `/admin/groups/${id}?admin_id=${uid}`, data);
export const adminDeleteGroup  = (id, uid) => req("DELETE", `/admin/groups/${id}?admin_id=${uid}`);
export const adminListItems    = (uid) => req("GET", `/admin/items?admin_id=${uid}`);
export const adminCreateItem   = (data, uid) => req("POST", `/admin/items?admin_id=${uid}`, data);
export const adminUpdateItem   = (id, data, uid) => req("PATCH", `/admin/items/${id}?admin_id=${uid}`, data);
export const adminDeleteItem   = (id, uid) => req("DELETE", `/admin/items/${id}?admin_id=${uid}`);
