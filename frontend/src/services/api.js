import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:8031",
});

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
    sessionStorage.removeItem("token");
    localStorage.removeItem("token");
    return null;
  }

  const dotCount = (token.match(/\./g) || []).length;

  if (dotCount !== 2) {
    sessionStorage.removeItem("token");
    localStorage.removeItem("token");
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

export default API;