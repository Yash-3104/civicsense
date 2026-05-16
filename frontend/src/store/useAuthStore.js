import { create } from "zustand";

function loadStoredUser() {
  try {
    const storedUser =
      sessionStorage.getItem("user") ||
      localStorage.getItem("user");

    if (!storedUser) {
      return null;
    }

    return JSON.parse(storedUser);
  } catch {
    sessionStorage.removeItem("user");
    localStorage.removeItem("user");
    return null;
  }
}

function loadStoredToken() {
  return (
    sessionStorage.getItem("token") ||
    localStorage.getItem("token")
  );
}

export const useAuthStore = create((set) => ({
  user: loadStoredUser(),
  token: loadStoredToken(),

  setAuth: (data) => {
    // sessionStorage is per-tab, so different workers can be tested in different tabs.
    sessionStorage.setItem("token", data.token);
    sessionStorage.setItem("user", JSON.stringify(data));

    // Remove old shared login state so another tab/account does not overwrite this tab.
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    set({
      user: data,
      token: data.token,
    });
  },

  logout: () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");

    localStorage.removeItem("token");
    localStorage.removeItem("user");

    set({
      user: null,
      token: null,
    });
  },
}));