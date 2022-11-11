import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { v4 as uuidv4 } from "uuid";

const RASA_DEFAULT_SOCKET_PATH = "/socket.io";

type SocketIOUtterUser = {
  session_id?: string;
  message: string | object;
};

type SocketIOBotText = {
  text: string;
};

type SocketIOBotQuickReply = {
  text?: string;
  quick_replies: {
    content_type: "text" | "image";
    title: string;
    payload: string;
    clicked?: boolean;
    onClick?: () => void;
  }[];
  clicked?: boolean;
};

type SocketIOBotAttachment = {
  attachment: {
    payload: {
      src: string;
    };
    type: "image";
  };
};

type SocketIOUtterBot = Partial<
  SocketIOBotAttachment & SocketIOBotQuickReply & SocketIOBotText
>;

interface RasaServerEvents {
  session_confirm: (sessionID: string) => void;
  bot_uttered: (message: SocketIOUtterBot) => void;
}

interface ClientEvents {
  user_uttered: (message: SocketIOUtterUser) => void;
  session_request: (sessionID: string | undefined) => void;
}

type RasaMetaInformation = {
  id: string;
  received: boolean;
  type: RasaMessageType;
};

export enum RasaMessageType {
  attachment = "attachment",
  text = "text",
  quickReply = "quick_reply",
  buttons = "buttons",
  unknown = "unknown",
  uploader = "uploader",
}

export type RasaMessage = SocketIOUtterBot & RasaMetaInformation;

export enum RasaStatus {
  connecting,
  connected,
  waitingForResponse,
  disconnected,
  error,
}

/**
 * React hook which establishes bidirectional communication with a given rasa server.
 * @param {string} rasaWebServerUrl Address of the Rasa webserver e.g. https://localhost:3000
 * @param {string} [rasaSocketPath] Specify the path to socket.io on the webserver. Defaults to "/socket.io".
 * @param {string} [sendOnConnect] Optionally send after a successfull connection an utterance to the rasa server e.g. "/greet".
 * @return Returns the status, the message history, a function for sending utterances and another function for modifying the history directly.
 */
export default function useRasa(
  rasaWebServerUrl: string,
  rasaSocketPath = RASA_DEFAULT_SOCKET_PATH,
  sendOnConnect?: string
) {
  const [status, setStatus] = useState<RasaStatus>(RasaStatus.disconnected);
  const [history, setHistory] = useState<RasaMessage[]>([]);
  const socketRef = useRef<Socket<RasaServerEvents, ClientEvents>>();
  const sessionRef = useRef<string>();

  /**
   * React hook which establishes bidirectional communication with a given rasa server.
   * @param {string | object} message Send a message to the rasa server. 
   * @return void
   */
  const utter = useCallback(
    (message: string | object) => {
      const socketIOMessage = {
        session_id: sessionRef.current || "",
        message: message,
      };
      socketRef.current?.emit("user_uttered", socketIOMessage);
      setStatus(RasaStatus.waitingForResponse);
      setHistory((history) => [
        ...history,
        {
          text: message as string,
          id: uuidv4(),
          received: false,
          type: RasaMessageType.text,
        },
      ]);
    },
    [socketRef.current, sessionRef.current]
  );

  useEffect(() => {
    const socket = io(rasaWebServerUrl, { path: rasaSocketPath });
    socketRef.current = socket;
    setStatus(RasaStatus.connecting);

    socket
      .on("connect", () => {
        setStatus(RasaStatus.connected);
        socket.emit("session_request", sessionRef.current);
        console.log("Connected to RASA:", socket.connected);
      })
      .on("session_confirm", (sessionID: string) => {
        console.log("Session confirmed: ", sessionID, "color: green");
        sessionRef.current = sessionID;
        if (sendOnConnect) utter(sendOnConnect);
      })
      .on("bot_uttered", (message: SocketIOUtterBot) => {
        const messageType = getType(message);
        const response = {
          ...message,
          id: uuidv4(),
          type: messageType,
          received: true,
        };
        if (response.quick_replies) {
          response.quick_replies = response.quick_replies.map((q1, i1) => ({
            ...q1,
            clicked: false,
            onClick: () => {
              utter(q1.payload);
              // if a utterance starts with '/' its a command and should not be displayed, as a text message.
              if (q1.payload.startsWith("/")) {
                setHistory((history) => {
                  const index = history.findIndex((v) => v.id === response.id);
                  if (index === -1)
                    throw new Error(`Coudln't find: ${q1} in ${history}`);
                  history[index].quick_replies = history[
                    index
                  ].quick_replies?.map((q2, i2) => ({
                    ...q2,
                    clicked: i1 === i2,
                  }));
                  history[index].clicked = true;

                  return history;
                });
                console.log("Clicked on button: ", q1);
              } else {
                setHistory((history) =>
                  history.filter((r) => r.id !== response.id)
                );
              }
            },
          }));
        }
        console.log("Bot uttered: ", response);
        setHistory((history) => [...history, response]);
        setStatus(RasaStatus.connected);
      })
      .on("disconnect", (reason: Socket.DisconnectReason) => {
        console.log("Disconnected: ", reason);
        setStatus(RasaStatus.disconnected);
      })
      .on("error", (e) => {
        setStatus(RasaStatus.error);
        console.error("Rasa Error: ", e);
      });

    return () => {
      socket.disconnect();
    };
  }, []);

  return { status, history, utter, setHistory };
}

function getType(message: SocketIOUtterBot) {
  if (message.hasOwnProperty("attachment")) {
    return RasaMessageType.attachment;
  }

  if (message.hasOwnProperty("quick_replies")) {
    return RasaMessageType.quickReply;
  }

  if (message.hasOwnProperty("text")) {
    return RasaMessageType.text;
  }

  return RasaMessageType.unknown;
}
