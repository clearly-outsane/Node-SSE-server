const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const https = require("https");
const v4 = require("uuid").v4;
require("dotenv").config();

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

  //find if stream are open of the same match
  const otherStreams = streams.filter((stream) => stream.matchId === matchId);
  if (otherStreams.length === 0) {
    console.log("Starting stream for matchId: ", matchId);
    const req = https.get(
      `https://live.wh.geniussports.com/v2/basketball/read/${matchId}?ak=${process.env.API_KEY}`,
      (res) => {
        const streamObject = {
          matchId,
          res,
        };
        streams.push(streamObject);
        res.on("data", (chunk) => {
          messageBuffer = messageBuffer + Buffer.from(chunk).toString("utf-8");
          while (messageBuffer.includes("\r\n")) {
            const message = messageBuffer.split("\r\n", 1)[0];
            messageBuffer = messageBuffer.slice(message.length + 2);
            //   let parsedChunk = JSON.parse(messageBuffer.replace(/\r\n$/, ""));
            const parsedMessage = JSON.parse(message);
            if (parsedMessage.type === "status") {
              parsedMessage.cached = true;

              updateMatch(matchId, parsedMessage);
            }
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
          streams = streams.filter((stream) => stream.matchId !== matchId);
        });
      }
    );
  }

  //Add new client to clients array
  const newClient = {
    id: clientId,
    matchId,
    response,
  };
  sendInitialMessage(matchId, newClient);
  console.log("New client added for matchId: ", matchId);
  clients.push(newClient);

  request.on("close", () => {
    console.log(`Connection closed for client ${clientId}`);
    const disconnectedClient = clients.find((client) => client.id === clientId);

    // if (otherClients.length === 0) {
    //   disconnectedClient.streamingRequest.destroy();
    // }
    clients = clients.filter((client) => client.id !== clientId);
  });
}

function sendEventsToAll(data, matchId) {
  clients.forEach((client) => {
    if (client.matchId !== matchId) return;
    console.log("Connected clients--", clients.length);
    client.response.write(`id: ${v4()}\n`);
    client.response.write(`event: message\n`);
    client.response.write(`data: ${JSON.stringify(data)}\n\n`);
    return;
  });
}

function updateMatch(matchId, data) {
  //first find if match exists in matchInfo
  const foundMatch = matchInfo.filter((match) => match.matchId === matchId);
  if (foundMatch.length === 0) {
    matchInfo.push({
      matchId,
      data,
    });
  } else {
    matchInfo.forEach((match) => {
      if (match.matchId === matchId) {
        match.data = data;
      }
    });
  }
}

function sendInitialMessage(matchId, client) {
  const foundMatch = matchInfo.filter((match) => match.matchId === matchId);
  console.log(matchId, " has been saved");
  if (foundMatch.length > 0) {
    client.response.write(`id: ${v4()}\n`);
    client.response.write(`event: message\n`);
    client.response.write(`data: ${JSON.stringify(foundMatch[0].data)}\n\n`);
    return;
  }
}

app.get("/events", eventsHandler);

const PORT = 3001;

let clients = [];
let matchInfo = [];
let streams = [];
let messageBuffer = "";

app.listen(PORT, () => {
  console.log(`Events service listening at http://localhost:${PORT}`);
});
