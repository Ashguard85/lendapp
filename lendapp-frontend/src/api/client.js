const API_URL = "http://192.168.1.127:8100";

// ─────────────────────────────
// REGISTER
// ─────────────────────────────
export async function register(form) {
  const res = await fetch(`${API_URL}/users/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(form)
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Registrierung fehlgeschlagen");
  }

  return res.json();
}

// ─────────────────────────────
// LOGIN
// ─────────────────────────────
export async function login(email, password) {
  const res = await fetch(`${API_URL}/users/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email,
      password
    })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Login fehlgeschlagen");
  }

  return res.json();
}

// ─────────────────────────────
// GET USER
// ─────────────────────────────
export async function getUser(userId) {
  const res = await fetch(`${API_URL}/users/${userId}`);

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "User nicht gefunden");
  }

  return res.json();
}
