# react-rasa-hook
A simple react hook for the RASA conversational user interface framework.

### 👷 How to install

```
npm install react-rasa-hook
```
### 🔧 How to use
The hook can be used just like a react hook.
The hook returns the status, the message history, a function for sending utterances and another function for modifying the history directly.
The utterance can be a string or object.

Params:
- rasaWebServerUrl Address of the Rasa webserver e.g. https://localhost:3000
- [rasaSocketPath] Specify the path to socket.io on the webserver. Defaults to "/socket.io".
- [sendOnConnect] Send optionally after a successfull connection an utterance to the rasa server e.g. "/greet".

```jsx
import useRasa, {RasaStatus} from "react-rasa-hook";

function ReactComponent(){
  const { status, history, utter, setHistory } = useRasa("http://localhost:3000");
  
  useEffect(() => {
    utter("Hey Bot! This is a test message.");
    utter("/greet") //This specifies directly an intent.
  }, [])
  
  
  useEffect(() => {
    // Console.logs the last message of the conversation
    console.log(history[history.length - 1]);
  },[history])
 
 
return  (
 <>
   <div>
      {status === RasaStatus.connecting ? "Trying to connect..." : history[history.length - 1]}
   </div>
    <div>
      {status === RasaStatus.waitingForResponse ? "..." : null}
   </div>
 </>
 )
}
```



### 🪧 Status codes

- connecting
- connected
- waitingForResponse
- disconnected
- error


### ✉️ Default message types

There are 4 default message types (RasaMessage & RasaMessageType)
- attachment 
- text 
- quickReply 
- unknown (everything which does not belong to the upper categories, for example custom types)

Each message in the history holds additional metainformation. 
```typescript
type RasaMetaInformation = {
  id: string;
  received: boolean;
  type: RasaMessageType;
};
```
The id is a unique string identifier. Received is true, if the message was sent by the bot, otherwise it's the user message (which is also stored in the history).
The type specifies the stored information. In case its unknown, the user needs to handle it. 



#### ⏭️ quickreply (buttons)
Each quick reply is equiped with a function, which can be called (e.g. in onClick) to send the quick reply payload.
A function call will set the group and the given button as »clicked«. 


```typescript
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
```


#### 🖼️ attachment (e.g. images)
```typescript
type SocketIOBotAttachment = {
  attachment: {
    payload: {
      src: string;
    };
    type: "image";
  };
};
```

#### 💬 text
```typescript
type SocketIOBotText = {
  text: string;
};
```

The meta information, and the optional attributes above are not given by the rasa server. 
If you like you can ignore them and do your own processing completely based on the non-optional attributes. 

