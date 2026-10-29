import http from "node:http"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLICO = path.join(__dirname, "public")
const PUERTO = Number(process.env.PORT) || 3000

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".fbx": "application/octet-stream",
  ".ico": "image/x-icon",
}

function servir(req, res) {
  const direccion = new URL(req.url, `http://localhost:${PUERTO}`)
  let ruta = decodeURIComponent(direccion.pathname)
  if (ruta === "/") ruta = "/index.html"
  const archivo = path.normalize(path.join(PUBLICO, ruta))
  const raiz = PUBLICO.endsWith(path.sep) ? PUBLICO : PUBLICO + path.sep
  if (archivo !== PUBLICO && !archivo.startsWith(raiz)) {
    res.writeHead(403)
    res.end()
    return
  }

  fs.readFile(archivo, (error, contenido) => {
    if (error) {
      res.writeHead(404)
      res.end("No encontrado")
      return
    }
    const tipo = MIME[path.extname(archivo).toLowerCase()] || "application/octet-stream"
    res.writeHead(200, {
      "Content-Type": tipo,
      "Cache-Control": "no-cache",
    })
    res.end(contenido)
  })
}

const servidor = http.createServer(servir)

servidor.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`El puerto ${PUERTO} ya está en uso.`)
  } else {
    console.error(error)
  }
  process.exit(1)
})

servidor.listen(PUERTO, "0.0.0.0", () => {
  console.log(`Arrecife en http://localhost:${PUERTO}`)
})
