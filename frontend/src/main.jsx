import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";

import App from "./App";
import "./index.css";

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import AppQueryProvider from "./providers/QueryProvider";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppQueryProvider>
        <App />

        <Toaster
          position="top-right"
          richColors
          closeButton
          theme="dark"
        />

      </AppQueryProvider>
    </BrowserRouter>
  </React.StrictMode>
);