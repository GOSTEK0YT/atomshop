import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = Number(process.env.PORT || 4173);

const products = {
  "kit-elita": {
    name: "Kit Elita",
    price: 14.99,
    commands: ["lp user {nick} parent add elita"],
  },
  "kit-ultra-elita": {
    name: "Kit Ultra Elita",
    price: 19.99,
    commands: ["lp user {nick} parent add ultraelita"],
  },
  "kit-atom": {
    name: "Kit Atom",
    price: 29.99,
    commands: ["lp user {nick} parent add atom"],
  },
  "klucz-rzadka": {
    name: "Klucz do rzadkiej",
    price: 4.99,
    commands: ["crate key give {nick} rzadka 15"],
  },
  "klucz-epicka": {
    name: "Klucz do epickiej",
    price: 9.99,
    commands: ["crate key give {nick} epicka 10"],
  },
  "klucz-atom": {
    name: "Klucz do atom",
    price: 14.99,
    commands: ["crate key give {nick} atom 5"],
  },
};

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

const nickPattern = /^[A-Za-z0-9_]{3,16}$/;
const freeKeyCooldownMs = 24 * 60 * 60 * 1000;
const freeKeyClaims = new Map();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "GET" && url.pathname === "/api/health") {
      return sendJson(res, 200, {
        ok: true,
        panelApiConfigured: Boolean(process.env.PANEL_API_URL && process.env.PANEL_API_KEY && process.env.PANEL_SERVER_ID),
        rconConfigured: Boolean(process.env.RCON_HOST && process.env.RCON_PASSWORD),
        mode: process.env.PAYMENT_MODE || "test",
      });
    }

    if (req.method === "POST" && url.pathname === "/api/orders") {
      return handleOrder(req, res);
    }

    if (req.method === "POST" && url.pathname === "/api/free-key") {
      return handleFreeKey(req, res);
    }

    if (req.method === "GET" || req.method === "HEAD") {
      return serveStatic(url.pathname, req, res);
    }

    sendJson(res, 405, { ok: false, message: "Metoda nie jest obslugiwana." });
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { ok: false, message: "Blad serwera sklepu." });
  }
});

async function handleOrder(req, res) {
  const body = await readJson(req);
  const { nick, email, payment, items } = body || {};

  if (!nickPattern.test(String(nick || ""))) {
    return sendJson(res, 400, { ok: false, message: "Podaj poprawny nick Minecraft." });
  }

  if (!String(email || "").includes("@")) {
    return sendJson(res, 400, { ok: false, message: "Podaj poprawny adres e-mail." });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return sendJson(res, 400, { ok: false, message: "Koszyk jest pusty." });
  }

  const normalizedItems = [];
  const commands = [];
  let total = 0;

  for (const item of items) {
    const product = products[item.id];
    const quantity = Number(item.quantity);

    if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
      return sendJson(res, 400, { ok: false, message: "Koszyk zawiera niepoprawny produkt." });
    }

    normalizedItems.push({ id: item.id, name: product.name, quantity, price: product.price });
    total += product.price * quantity;

    for (let index = 0; index < quantity; index += 1) {
      commands.push(...product.commands.map((command) => command.replaceAll("{nick}", nick)));
    }
  }

  const orderId = `AC-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

  try {
    await grantMinecraftProducts(commands);

    sendJson(res, 200, {
      ok: true,
      orderId,
      mode: process.env.PAYMENT_MODE || "test",
      payment: payment || "test",
      total: Number(total.toFixed(2)),
      items: normalizedItems,
      message: `Zamowienie ${orderId} zostalo nadane graczowi ${nick}.`,
    });
  } catch (error) {
    console.error(`[${orderId}] Minecraft delivery failed`, error);
    sendJson(res, 502, {
      ok: false,
      orderId,
      message: "Zamowienie przyjete, ale nie udalo sie wyslac komend na serwer Minecraft.",
    });
  }
}

async function handleFreeKey(req, res) {
  const body = await readJson(req);
  const nick = String(body?.nick || "").trim();

  if (!nickPattern.test(nick)) {
    return sendJson(res, 400, { ok: false, message: "Podaj poprawny nick Minecraft." });
  }

  const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0].trim();
  const key = `${nick.toLowerCase()}|${ip}`;
  const now = Date.now();
  const lastClaim = freeKeyClaims.get(key) || 0;
  const availableAt = lastClaim + freeKeyCooldownMs;

  if (lastClaim && now < availableAt) {
    return sendJson(res, 429, {
      ok: false,
      message: "Darmowy klucz byl juz odebrany. Sprobuj ponownie pozniej.",
      availableAt,
    });
  }

  try {
    await grantMinecraftProducts([`crate key give ${nick} rzadka 1`]);
    freeKeyClaims.set(key, now);

    sendJson(res, 200, {
      ok: true,
      availableAt: now + freeKeyCooldownMs,
      message: `Darmowy klucz zostal nadany graczowi ${nick}.`,
    });
  } catch (error) {
    console.error("[free-key] Minecraft delivery failed", error);
    sendJson(res, 502, {
      ok: false,
      message: "Nie udalo sie nadac darmowego klucza na serwerze Minecraft.",
    });
  }
}

function serveStatic(urlPath, req, res) {
  const safePath = decodeURIComponent(urlPath).replace(/^\/+/, "");
  const requestedPath = safePath || "index.html";
  const filePath = path.normalize(path.join(__dirname, requestedPath));

  if (!filePath.startsWith(__dirname)) {
    return sendJson(res, 403, { ok: false, message: "Brak dostepu." });
  }

  const finalPath = fs.existsSync(filePath) && fs.statSync(filePath).isFile()
    ? filePath
    : path.join(__dirname, "index.html");

  const extension = path.extname(finalPath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": mimeTypes[extension] || "application/octet-stream",
    "Cache-Control": extension === ".html" ? "no-cache" : "public, max-age=3600",
  });

  if (req.method === "HEAD") {
    return res.end();
  }

  fs.createReadStream(finalPath).pipe(res);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 50_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

async function grantMinecraftProducts(commands) {
  if (process.env.RCON_DRY_RUN === "true") {
    console.log("[delivery dry-run]", commands);
    return;
  }

  if (process.env.PANEL_API_URL && process.env.PANEL_API_KEY && process.env.PANEL_SERVER_ID) {
    await sendPanelCommands(commands);
    return;
  }

  const host = process.env.RCON_HOST;
  const password = process.env.RCON_PASSWORD;
  const rconPort = Number(process.env.RCON_PORT || 25575);

  if (!host || !password) {
    throw new Error("Missing RCON_HOST or RCON_PASSWORD");
  }

  const client = await connectRcon(host, rconPort, password);

  try {
    for (const command of commands) {
      await client.command(command);
    }
  } finally {
    client.close();
  }
}

async function sendPanelCommands(commands) {
  const baseUrl = process.env.PANEL_API_URL.replace(/\/+$/, "");
  const serverId = process.env.PANEL_SERVER_ID;
  const endpoint = `${baseUrl}/api/client/servers/${serverId}/command`;

  for (const command of commands) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${process.env.PANEL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ command }),
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Panel command failed: ${response.status} ${details}`);
    }
  }
}

function connectRcon(host, rconPort, password) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port: rconPort });
    let nextId = 1;
    const pending = new Map();

    const fail = (error) => {
      for (const { reject: rejectPending } of pending.values()) {
        rejectPending(error);
      }
      pending.clear();
      reject(error);
    };

    socket.setTimeout(8000);
    socket.on("timeout", () => fail(new Error("RCON timeout")));
    socket.on("error", fail);
    socket.on("data", (buffer) => {
      let offset = 0;
      while (offset + 4 <= buffer.length) {
        const length = buffer.readInt32LE(offset);
        if (offset + 4 + length > buffer.length) break;

        const id = buffer.readInt32LE(offset + 4);
        const body = buffer.subarray(offset + 12, offset + 4 + length - 2).toString("utf8");
        const request = pending.get(id);
        pending.delete(id);

        if (request) {
          request.resolve(body);
        }

        offset += 4 + length;
      }
    });

    const send = (type, body) => new Promise((resolveSend, rejectSend) => {
      const id = nextId;
      nextId += 1;
      const payload = Buffer.from(body, "utf8");
      const packet = Buffer.alloc(14 + payload.length);

      packet.writeInt32LE(10 + payload.length, 0);
      packet.writeInt32LE(id, 4);
      packet.writeInt32LE(type, 8);
      payload.copy(packet, 12);
      packet.writeInt16LE(0, 12 + payload.length);

      pending.set(id, { resolve: resolveSend, reject: rejectSend });
      socket.write(packet);
    });

    socket.on("connect", async () => {
      try {
        await send(3, password);
        resolve({
          command: (command) => send(2, command),
          close: () => socket.end(),
        });
      } catch (error) {
        reject(error);
      }
    });
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

server.listen(port, () => {
  console.log(`AtomShop server listening on ${port}`);
});
