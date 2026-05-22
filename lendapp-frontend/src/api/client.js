const BASE = process.env.REACT_APP_API_URL || "http://192.168.1.127:8100";

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Fehler");
  }

  if (res.status === 204) return null;
  return res.json();
}

// ─────────────────────
// AUTH
// ─────────────────────
export const register = (data) =>
  req("POST", "/users/register", data);

export const login = (email, password) =>
  req("POST", "/users/login", {
    email,
    password
  });

// ─────────────────────
// GROUPS
// ─────────────────────
export const createGroup = (data) =>
  req("POST", "/groups/", data);

export const getGroup = (id) =>
  req("GET", `/groups/${id}`);

export const joinGroup = (id, invite_code) =>
  req("POST", `/groups/${id}/join`, {
    invite_code
  });

export const getMembers = (id) =>
  req("GET", `/groups/${id}/members`);

// ─────────────────────
// ITEMS
// ─────────────────────
export const createItem = (data) =>
  req("POST", "/items/", data);

export const getItems = (groupId) =>
  req("GET", `/items/group/${groupId}`);

export const getItem = (id) =>
  req("GET", `/items/${id}`);

export const updateItem = (id, data) =>
  req("PATCH", `/items/${id}`, data);

export const deleteItem = (id) =>
  req("DELETE", `/items/${id}`);

// ─────────────────────
// BOOKINGS
// ─────────────────────
export const requestBooking = (data) =>
  req("POST", "/bookings/", data);

export const getBookingsForItem = (itemId) =>
  req("GET", `/bookings/item/${itemId}`);

export const getBookingsForUser = (uid) =>
  req("GET", `/bookings/user/${uid}`);

export const updateBookingStatus = (id, status) =>
  req("PATCH", `/bookings/${id}/status`, {
    status
  });
