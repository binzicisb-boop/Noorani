import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { createHash, randomInt, randomUUID } from "node:crypto";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const sharedData = join(root, "../../packages/shared/src/data.json");
const storePath = join(root, "data/store.json");
const port = Number(process.env.PORT || 3000);
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8" };
const json = (response, status, value) => { response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); response.end(JSON.stringify(value)); };
const readStore = async () => JSON.parse(await readFile(storePath, "utf8"));
const writeStore = store => writeFile(storePath, JSON.stringify(store, null, 2));
const body = request => new Promise((resolve, reject) => { let value = ""; request.on("data", chunk => { value += chunk; if (value.length > 1000000) request.destroy(); }); request.on("end", () => { try { resolve(value ? JSON.parse(value) : {}); } catch (error) { reject(error); } }); request.on("error", reject); });
const digest = value => createHash("sha256").update(value).digest("hex");

const server = createServer(async (request, response) => {
  try {
    if (request.url === "/api/data") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      response.end(await readFile(sharedData));
      return;
    }
    if (request.method === "GET" && request.url === "/api/integrations") {
      json(response, 200, { maps: Boolean(process.env.MAP_PROVIDER_KEY), flights: Boolean(process.env.FLIGHT_API_KEY), hotels: Boolean(process.env.HOTEL_API_KEY), currency: Boolean(process.env.CURRENCY_API_KEY), realtimeTracking: Boolean(process.env.REALTIME_TRACKING_URL) });
      return;
    }
    if (request.method === "POST" && request.url === "/api/tracking") {
      const input = await body(request);
      if (!input.journeyId || typeof input.latitude !== "number" || typeof input.longitude !== "number") return json(response, 400, { error: "journeyId, latitude, and longitude are required." });
      const store = await readStore();
      store.trackingUpdates.push({ journeyId: input.journeyId, latitude: input.latitude, longitude: input.longitude, recordedAt: new Date().toISOString() });
      store.trackingUpdates = store.trackingUpdates.slice(-1000);
      await writeStore(store);
      json(response, 202, { message: "Location update accepted." });
      return;
    }
    if (request.method === "GET" && request.url.startsWith("/api/tracking/")) {
      const journeyId = request.url.split("/").pop();
      const store = await readStore();
      json(response, 200, { journeyId, updates: store.trackingUpdates.filter(item => item.journeyId === journeyId).slice(-50) });
      return;
    }
    if (request.method === "POST" && request.url === "/api/auth/request-otp") {
      const input = await body(request);
      if (!input.mobile && !input.email) return json(response, 400, { error: "A mobile number or email is required." });
      const code = String(randomInt(100000, 1000000));
      const store = await readStore();
      store.otpChallenges = store.otpChallenges.filter(item => item.expiresAt > Date.now());
      store.otpChallenges.push({ id: randomUUID(), mobile: input.mobile || null, email: input.email || null, codeHash: digest(code), expiresAt: Date.now() + 5 * 60 * 1000 });
      await writeStore(store);
      json(response, 200, { message: "Verification code created.", developmentCode: process.env.NODE_ENV === "production" ? undefined : code });
      return;
    }
    if (request.method === "POST" && request.url === "/api/auth/verify-otp") {
      const input = await body(request);
      const store = await readStore();
      const challenge = store.otpChallenges.find(item => (input.mobile && item.mobile === input.mobile || input.email && item.email === input.email) && item.expiresAt > Date.now());
      if (!challenge || digest(String(input.otp || "")) !== challenge.codeHash) return json(response, 401, { error: "The verification code is invalid or expired." });
      const user = store.users.find(item => item.mobile === challenge.mobile || item.email === challenge.email) || { id: randomUUID(), mobile: challenge.mobile, email: challenge.email, createdAt: new Date().toISOString() };
      if (!store.users.some(item => item.id === user.id)) store.users.push(user);
      store.otpChallenges = store.otpChallenges.filter(item => item !== challenge);
      await writeStore(store);
      json(response, 200, { user: { id: user.id, mobile: user.mobile, email: user.email } });
      return;
    }
    if (request.method === "POST" && request.url === "/api/community") {
      const input = await body(request);
      const required = ["name", "documentType", "documentNumber", "gender", "age", "mobile"];
      if (required.some(field => !input[field])) return json(response, 400, { error: "Name, identity document, gender, age, and mobile are required." });
      const store = await readStore();
      store.communityApplications.push({ ...input, id: randomUUID(), createdAt: new Date().toISOString() });
      await writeStore(store);
      json(response, 201, { message: "Community registration received." });
      return;
    }
    const requested = request.url === "/" ? "/index.html" : normalize(request.url.split("?")[0]);
    const file = join(root, requested);
    if (!file.startsWith(root)) throw new Error("Invalid path");
    response.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream" });
    response.end(await readFile(file));
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(port, () => console.log(`Nooranis web app: http://localhost:${port}`));
