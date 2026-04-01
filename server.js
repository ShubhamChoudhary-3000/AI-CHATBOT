const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;

function loadEnvFile() {
  const envPath = path.join(ROOT_DIR, ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

async function handleChat(req, res) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return sendJson(res, 500, { error: "Missing GOOGLE_API_KEY environment variable" });
  }

  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });

  req.on("end", async () => {
    try {
      const payload = JSON.parse(body || "{}");
      const apiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await apiResponse.json();
      return sendJson(res, apiResponse.status, data);
    } catch (error) {
      return sendJson(res, 500, { error: error.message || "Unexpected server error" });
    }
  });
}

function handleStatic(req, res) {
  let requestPath = req.url === "/" ? "/index.html" : req.url;
  requestPath = requestPath.split("?")[0];

  const filePath = path.join(ROOT_DIR, requestPath);
  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": getContentType(filePath) });
    res.end(data);
  });
}

loadEnvFile();

const server = http.createServer((req, res) => {
  if (req.url === "/api/chat" && req.method === "POST") {
    return handleChat(req, res);
  }

  if (req.url === "/api/chat") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  return handleStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
