import { create } from "zustand";

function clearStoredAuth() {
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("user");
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

function isJwtLikeToken(token) {
  if (!token || typeof token !== "string") {
    return false;
  }

  if (
    token === "undefined" ||
    token === "null" ||
    token === "[object Object]"
  ) {
    return false;
  }

  return (token.match(/\./g) || []).length === 2;
}

function loadStoredUser() {
  try {
    const storedUser =
      sessionStorage.getItem("user") ||
      localStorage.getItem("user");

    if (!storedUser) {
      return null;
    }

    const parsedUser = JSON.parse(storedUser);

    if (!parsedUser || !parsedUser.token || !isJwtLikeToken(parsedUser.token)) {
      clearStoredAuth();
      return null;
    }

    return parsedUser;
  } catch {
    clearStoredAuth();
    return null;
  }
}

function loadStoredToken() {
  const token =
    sessionStorage.getItem("token") ||
    localStorage.getItem("token");

  if (!isJwtLikeToken(token)) {
    clearStoredAuth();
    return null;
  }

  return token;
}

export const useAuthStore = create((set) => ({
  user: loadStoredUser(),
  token: loadStoredToken(),

  setAuth: (data) => {
    if (!data?.token || !isJwtLikeToken(data.token)) {
      clearStoredAuth();

      set({
        user: null,
        token: null,
      });

      return;
    }

    sessionStorage.setItem("token", data.token);
    sessionStorage.setItem("user", JSON.stringify(data));

    localStorage.removeItem("token");
    localStorage.removeItem("user");

    set({
      user: data,
      token: data.token,
    });
  },

  logout: () => {
    clearStoredAuth();

    set({
      user: null,
      token: null,
    });
  },
}));
