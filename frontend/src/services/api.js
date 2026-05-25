import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8031";

const API = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

function clearInvalidAuthState() {
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("user");
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

function getValidToken() {
  const token =
    sessionStorage.getItem("token") ||
    localStorage.getItem("token");

  if (!token) {
    return null;
  }

  if (
    token === "undefined" ||
    token === "null" ||
    token === "[object Object]"
  ) {
    clearInvalidAuthState();
    return null;
  }

  const dotCount = (token.match(/\./g) || []).length;

  if (dotCount !== 2) {
    clearInvalidAuthState();
    return null;
  }

  return token;
}

API.interceptors.request.use((config) => {
  const token = getValidToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else if (config.headers?.Authorization) {
    delete config.headers.Authorization;
  }

  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const currentPath = window.location.pathname;

    if (status === 401 && currentPath !== "/login") {
      clearInvalidAuthState();
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

export default API;
