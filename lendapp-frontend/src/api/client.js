const BASE = "/api";

function headers(userId) {
  const h = { "Content-Type": "application/json" };
  if (userId) h["X-User-Id"] = String(userId);
  return h;
}

async function req(method, path, body, userId) {
  const options = { method, headers: headers(userId) };
  if (body !== undefined && method !== "GET" && method !== "DELETE") {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Fehler");
  }
  if (res.status === 204) return null;
  return res.json();
}

// Auth
export const register = (data) => req("POST", "/users/register", data);
export const login = (email, password) => req("POST", "/users/login", { email, password });

// Groups
export const createGroup = (data, uid) => req("POST", `/groups/?user_id=${uid}`, data, uid);
export const getGroup = (id) => req("GET", `/groups/${id}`);
export const joinGroup = (id, code, uid) => req("POST", `/groups/${id}/join?invite_code=${code}&user_id=${uid}`, {}, uid);
export const getMembers = (id) => req("GET", `/groups/${id}/members`);

// Items
export const createItem = (data, uid) => req("POST", `/items/?user_id=${uid}`, data, uid);
export const getItems = (groupId, uid) => req("GET", `/items/group/${groupId}?user_id=${uid}`, undefined, uid);
export const getItem = (id) => req("GET", `/items/${id}`);
export const updateItem = (id, data, uid) => req("PATCH", `/items/${id}?user_id=${uid}`, data, uid);
export const deleteItem = (id, uid) => req("DELETE", `/items/${id}?user_id=${uid}`, undefined, uid);

// Bookings
export const requestBooking = (data, uid) => req("POST", `/bookings/?user_id=${uid}`, data, uid);
export const getBookingsForItem = (itemId) => req("GET", `/bookings/item/${itemId}`);
export const getBookingsForUser = (uid) => req("GET", `/bookings/user/${uid}`, undefined, uid);
export const getPendingForOwner = (uid) => req("GET", `/bookings/pending/owner/${uid}`, undefined, uid);
export const updateBookingStatus = (id, status, uid) => req("PATCH", `/bookings/${id}/status?user_id=${uid}`, { status }, uid);

// Upload
export async function uploadImage(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE}/upload/`, { method: "POST", body: formData });
  if (!res.ok) throw new Error("Upload fehlgeschlagen");
  const data = await res.json();
  return data.url;
}

// Admin – Auth via X-User-Id Header (nur für Admins)
export const adminStats       = (uid) => req("GET",    `/admin/stats`,                    undefined, uid);
export const adminListUsers   = (uid) => req("GET",    `/admin/users`,                    undefined, uid);
export const adminCreateUser  = (data, uid) => req("POST",   `/admin/users`,              data,      uid);
export const adminUpdateUser  = (id, data, uid) => req("PATCH",  `/admin/users/${id}`,   data,      uid);
export const adminDeleteUser  = (id, uid) => req("DELETE", `/admin/users/${id}`,          undefined, uid);
export const adminResetPw     = (id, pw, uid) => req("POST", `/admin/users/${id}/reset-password`, { new_password: pw }, uid);
export const adminListGroups  = (uid) => req("GET",    `/admin/groups`,                   undefined, uid);
export const adminCreateGroup = (data, uid) => req("POST",   `/admin/groups`,             data,      uid);
export const adminUpdateGroup = (id, data, uid) => req("PATCH",  `/admin/groups/${id}`,  data,      uid);
export const adminDeleteGroup = (id, uid) => req("DELETE", `/admin/groups/${id}`,         undefined, uid);
export const adminListItems   = (uid) => req("GET",    `/admin/items`,                    undefined, uid);
export const adminCreateItem  = (data, uid) => req("POST",   `/admin/items`,              data,      uid);
export const adminUpdateItem  = (id, data, uid) => req("PATCH",  `/admin/items/${id}`,   data,      uid);
export const adminDeleteItem  = (id, uid) => req("DELETE", `/admin/items/${id}`,          undefined, uid);

// Multi-Group
export const getUserGroups = (uid) => req("GET", `/groups/user/${uid}/all`, undefined, uid);
