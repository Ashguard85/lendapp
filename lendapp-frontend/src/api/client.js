const BASE = process.env.REACT_APP_API_URL || "http://localhost:8100";

function headers(userId) {
  const h = { "Content-Type": "application/json" };
  if (userId) h["X-User-Id"] = userId;
  return h;
}

async function req(method, path, body, userId) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(userId),
    body: body ? JSON.stringify(body) : undefined,
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
  req("GET", `/users/login?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`);

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
