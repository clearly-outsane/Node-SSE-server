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
  const headers = {
    "Content-Type": "text/event-stream",
    Connection: "keep-alive",
    "Cache-Control": "no-cache",
  };
  response.writeHead(200, headers);

  https.get(
    `https://live.wh.geniussports.com/v2/basketball/read/2261294?ak=5c1f6cae123427ca457f62f88e7b26ab`,
    (res) => {
      res.on("data", (chunk) => {
        let parsedChunk = JSON.parse(
          Buffer.from(chunk).toString("utf-8").replace(/\r\n$/, "")
        );

        sendEventsToAll(parsedChunk);

        // clients.forEach((client) =>
        //   client.response.write(`${JSON.stringify(parsedChunk)}\n`)
        // );
      });

      res.on("end", () => {
        console.log("ENDING");
      });
    }
  );

  //   const data = `data: ${JSON.stringify(facts)}\n\n`;

  //   response.write(data);

  const clientId = Date.now();

  const newClient = {
    id: clientId,
    response,
  };

  clients.push(newClient);

  response.write(`lalaalal\n`);
  console.log("lalalal");

  request.on("close", () => {
    console.log(`${clientId} Connection closed`);
    clients = clients.filter((client) => client.id !== clientId);
  });
}

app.get("/events", eventsHandler);

function sendEventsToAll(data) {
  clients.forEach((client) => {
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

app.listen(PORT, () => {
  console.log(`Facts Events service listening at http://localhost:${PORT}`);
});
