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

const NOTIFICATION_TOPIC_PREFIX = "/topic/notifications/";
let notificationClient = null;

export function connectNotificationSocket({
  userId,
  onConnect,
  onDisconnect,
  onNotificationEvent,
} = {}) {
  if (!userId) {
    return null;
  }

  if (notificationClient?.active) {
    return notificationClient;
  }

  notificationClient = new Client({
    webSocketFactory: () => new SockJS(SOCKET_URL),
    reconnectDelay: 5000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,

    debug: (message) => {
      if (import.meta.env.DEV) {
        console.log("[NotificationSocket]", message);
      }
    },

    onConnect: () => {
      console.log("Connected to CivicSense notification socket");

      if (onConnect) {
        onConnect();
      }

      notificationClient.subscribe(`${NOTIFICATION_TOPIC_PREFIX}${userId}`, (message) => {
        try {
          const event = JSON.parse(message.body);

          console.log("Realtime notification event:", event);

          if (onNotificationEvent) {
            onNotificationEvent(event);
          }
        } catch (error) {
          console.error("Failed to parse realtime notification event", error);
        }
      });
    },

    onDisconnect: () => {
      console.log("Disconnected from CivicSense notification socket");

      if (onDisconnect) {
        onDisconnect();
      }
    },

    onStompError: (frame) => {
      console.error("Notification STOMP error:", frame.headers.message);
      console.error("Notification STOMP details:", frame.body);

      if (onDisconnect) {
        onDisconnect();
      }
    },

    onWebSocketError: (error) => {
      console.error("Notification WebSocket error:", error);

      if (onDisconnect) {
        onDisconnect();
      }
    },
  });

  notificationClient.activate();

  return notificationClient;
}

export function disconnectNotificationSocket() {
  if (notificationClient?.active) {
    notificationClient.deactivate();
  }

  notificationClient = null;
}
