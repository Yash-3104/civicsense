import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:8031",
});

API.interceptors.request.use((config) => {
  const token =
    sessionStorage.getItem("token") ||
    localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else if (config.headers?.Authorization) {
    delete config.headers.Authorization;
  }

  return config;
});

export default API;