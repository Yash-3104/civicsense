import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

const SOCKET_URL = "http://localhost:8031/ws";
const ISSUE_TOPIC = "/topic/issues";

let stompClient = null;

export function connectIssueSocket({
  onConnect,
  onDisconnect,
  onIssueEvent,
} = {}) {
  if (stompClient?.active) {
    return stompClient;
  }

  stompClient = new Client({
    webSocketFactory: () => new SockJS(SOCKET_URL),

    reconnectDelay: 5000,

    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,

    debug: (message) => {
      if (import.meta.env.DEV) {
        console.log("[WebSocket]", message);
      }
    },

    onConnect: () => {
      console.log("Connected to CivicSense realtime socket");

      if (onConnect) {
        onConnect();
      }

      stompClient.subscribe(ISSUE_TOPIC, (message) => {
        try {
          const event = JSON.parse(message.body);

          console.log("Realtime issue event:", event);

          if (onIssueEvent) {
            onIssueEvent(event);
          }
        } catch (error) {
          console.error("Failed to parse realtime event", error);
        }
      });
    },

    onDisconnect: () => {
      console.log("Disconnected from CivicSense realtime socket");

      if (onDisconnect) {
        onDisconnect();
      }
    },

    onStompError: (frame) => {
      console.error("STOMP error:", frame.headers.message);
      console.error("STOMP details:", frame.body);

      if (onDisconnect) {
        onDisconnect();
      }
    },

    onWebSocketError: (error) => {
      console.error("WebSocket error:", error);

      if (onDisconnect) {
        onDisconnect();
      }
    },
  });

  stompClient.activate();

  return stompClient;
}

export function disconnectIssueSocket() {
  if (stompClient?.active) {
    stompClient.deactivate();
  }

  stompClient = null;
}