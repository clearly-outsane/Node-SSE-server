const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const https = require("https");
const v4 = require("uuid").v4;

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.get("/status", (request, response) =>
  response.json({ clients: clients.length })
);

function eventsHandler(request, response, next) {
  const matchId = request.query.matchId ?? "2261294";
  const headers = {
    "Content-Type": "text/event-stream",
    Connection: "keep-alive",
    "Cache-Control": "no-cache",
    // "Access-Control-Allow-Origin": "*",
  };
  response.writeHead(200, headers);
  const clientId = Date.now();

  //find if any other clients are connected to the same match
  const otherClients = clients.filter(
    (client) => client.matchId === matchId && client.id !== clientId
  );
  if (otherClients.length === 0) {
    const req = https.get(
      `https://live.wh.geniussports.com/v2/basketball/read/${matchId}?ak=5c1f6cae123427ca457f62f88e7b26ab`,
      (res) => {
        res.on("data", (chunk) => {
          messageBuffer = messageBuffer + Buffer.from(chunk).toString("utf-8");
          while (messageBuffer.includes("\r\n")) {
            const message = messageBuffer.split("\r\n", 1)[0];
            messageBuffer = messageBuffer.slice(message.length + 2);
            //   let parsedChunk = JSON.parse(messageBuffer.replace(/\r\n$/, ""));
            sendEventsToAll(message, matchId);
          }
          // let parsedChunk = JSON.parse(
          //   Buffer.from(chunk).toString("utf-8").replace(/\r\n$/, "")
          // );

          // clients.forEach((client) =>
          //   client.response.write(`${JSON.stringify(parsedChunk)}\n`)
          // );
        });

        res.on("close", () => {
          console.log("Ending stream with matchId: ", matchId);
        });
      }
    );
    const newClient = {
      id: clientId,
      matchId,
      response,
      streamingRequest: req,
    };

    clients.push(newClient);
  }

  //   const data = `data: ${JSON.stringify(facts)}\n\n`;

  //   response.write(data);

  if (otherClients.length > 0) {
    //add new client here only if there is already a client connected to the same match; since we are doing the same thing when a new matchId comes in up top ^^^

    const newClient = {
      id: clientId,
      matchId,
      response,
      streamingRequest: otherClients[0].streamingRequest,
    };

    clients.push(newClient);
  }

  request.on("close", () => {
    console.log(`${clientId} Connection closed`);
    const disconnectedClient = clients.find((client) => client.id === clientId);
    //find if any other clients are connected to the same match

    if (otherClients.length === 0) {
      disconnectedClient.streamingRequest.destroy();
    }
    clients = clients.filter((client) => client.id !== clientId);
  });
}

app.get("/events", eventsHandler);

function sendEventsToAll(data, matchId) {
  clients.forEach((client) => {
    if (client.matchId !== matchId) return;
    console.log("clients--", clients.length);
    client.response.write(`id: ${v4()}\n`);
    client.response.write(`event: message\n`);
    client.response.write(`data: ${JSON.stringify(data)}\n\n`);
    return;
  });
}

async function getData(request, response, next) {
  const data = request.body;
  messages.push(data);
  response.json(data);
  return sendEventsToAll(data);
}

app.post("/events", getData);

const PORT = 3001;

let clients = [];
let messages = [];
let messageBuffer = "";

app.listen(PORT, () => {
  console.log(`Facts Events service listening at http://localhost:${PORT}`);
});
