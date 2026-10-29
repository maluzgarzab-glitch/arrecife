// El arrecife se dibuja con Three.js. El acceso de Google sigue en HTML.
// El buzo y los peces salen de los FBX de public/Modelos, con sus animaciones.

import * as THREE from "three"
import { FBXLoader } from "./vendor/addons/loaders/FBXLoader.js"
import { clone as clonarEsqueleto } from "./vendor/addons/utils/SkeletonUtils.js"
import { GOOGLE_CLIENT_ID } from "./config.js"

const CLAVE_PERFIL = "perfil-arrecife"
const ROCAS = [
  { x: -12, y: 0.2, z: -8, r: 1.7 },
  { x: 10, y: 0.1, z: 6, r: 2.1 },
  { x: 14, y: 0.3, z: -12, r: 1.5 },
  { x: -5, y: 0.2, z: 11, r: 1.8 },
  { x: 2, y: 0.15, z: -14, r: 1.6 },
  { x: -15, y: 0.25, z: 4, r: 1.4 },
  { x: 6, y: 0.2, z: -4, r: 1.3 },
]
const ARENA = { minX: -18.4, maxX: 18.4, minY: 0.15, maxY: 12.2, minZ: -18.4, maxZ: 18.4 }
const RUTAS = {
  buzo: "Modelos/Modelos/Personaje/Modelo_Neopreno.fbx",
  textura: "Modelos/Modelos/Personaje/basecolor_buzo.png",
  reposo: "Modelos/Modelos/Personaje/Animaciones/Swim_Aim_Idle.fbx",
  nado: "Modelos/Modelos/Personaje/Animaciones/Swim_Front.fbx",
  makiReposo: "Modelos/Modelos/Peces/Maki%20Maki/MakiMaki_Idle.fbx",
  makiNado: "Modelos/Modelos/Peces/Maki%20Maki/MakiMaki_Swim_Front.fbx",
  salmonReposo: "Modelos/Modelos/Peces/Salmonete/Salmonete_Idle.fbx",
  salmonNado: "Modelos/Modelos/Peces/Salmonete/Salmonete_Swim_Front.fbx",
}

const pantallaAcceso = document.querySelector("#pantalla-acceso")
const pantallaBienvenida = document.querySelector("#pantalla-bienvenida")
const botonGoogle = document.querySelector("#boton-google")
const avisoConfig = document.querySelector("#aviso-config")
const errorAcceso = document.querySelector("#error")
const fotoPerfil = document.querySelector("#foto-perfil")
const nombrePerfil = document.querySelector("#nombre-perfil")
const correoPerfil = document.querySelector("#correo-perfil")
const estadoModelos = document.querySelector("#estado-modelos")
const btnBucear = document.querySelector("#btn-bucear")
const btnSalir = document.querySelector("#btn-salir")
const btnSalirHud = document.querySelector("#btn-salir-hud")
const hud = document.querySelector("#hud")
const nombreHud = document.querySelector("#nombre-hud")
const velo = document.querySelector("#velo")

const escena = new THREE.Scene()
const COLOR_AGUA = 0x0c5c72
escena.background = new THREE.Color(COLOR_AGUA)
escena.fog = new THREE.Fog(COLOR_AGUA, 18, 48)

const camara = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 120)
escena.add(camara)

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.domElement.id = "vista"
document.body.prepend(renderer.domElement)

const cargadorFbx = new FBXLoader()
const cargadorTextura = new THREE.TextureLoader()
const algas = []
const peces = []
const teclas = new Set()
const velocidad = new THREE.Vector3()
const mirada = new THREE.Vector3()
const derecha = new THREE.Vector3()
const deseo = new THREE.Vector3()
const arriba = new THREE.Vector3(0, 1, 0)

let buzo = null
let mezcladorBuzo = null
let accionReposo = null
let accionNado = null
let accionActual = null
let modelosListos = false
let jugando = false
let yaw = 0
let pitch = 0
let anguloMenu = 0

function cargarFbx(url) {
  return new Promise((resolve, reject) => {
    cargadorFbx.load(url, resolve, undefined, reject)
  })
}

function clipEnSuLugar(clip, nombre) {
  const pistas = clip.tracks.filter((pista) => !pista.name.endsWith(".scale"))
  return new THREE.AnimationClip(nombre, -1, pistas)
}

function ajustarTamano(objeto, medida, apoyarEnPiso) {
  objeto.updateMatrixWorld(true)
  const caja = new THREE.Box3().setFromObject(objeto)
  const tamano = caja.getSize(new THREE.Vector3())
  const base = apoyarEnPiso ? tamano.y : Math.max(tamano.x, tamano.y, tamano.z)
  if (base > 0) objeto.scale.multiplyScalar(medida / base)
  objeto.updateMatrixWorld(true)
  const ajustada = new THREE.Box3().setFromObject(objeto)
  const centro = ajustada.getCenter(new THREE.Vector3())
  objeto.position.x -= centro.x
  objeto.position.z -= centro.z
  objeto.position.y -= apoyarEnPiso ? ajustada.min.y : centro.y
}

function quitarLucesYCamaras(objeto) {
  const quitar = []
  objeto.traverse((hijo) => {
    if (hijo.isLight || hijo.isCamera) quitar.push(hijo)
  })
  for (const nodo of quitar) nodo.parent?.remove(nodo)
}

function pintarMallas(objeto, material) {
  objeto.traverse((hijo) => {
    if (!hijo.isMesh) return
    hijo.material = material
    hijo.castShadow = false
    hijo.receiveShadow = false
  })
}

function crearAlga(x, z, semilla) {
  const grupo = new THREE.Group()
  const material = new THREE.MeshStandardMaterial({
    color: semilla % 2 ? 0x1e7a45 : 0x2f9e6a,
    roughness: 0.85,
  })
  const alto = 1.8 + (semilla % 5) * 0.35
  for (let i = 0; i < 3; i += 1) {
    const tira = new THREE.Mesh(new THREE.BoxGeometry(0.1, alto, 0.04), material)
    tira.position.set((i - 1) * 0.16, alto / 2, 0)
    grupo.add(tira)
  }
  grupo.position.set(x, 0, z)
  grupo.userData.semilla = semilla
  return grupo
}

function texturaArena() {
  const lienzo = document.createElement("canvas")
  lienzo.width = 256
  lienzo.height = 256
  const contexto = lienzo.getContext("2d")
  contexto.fillStyle = "#c4a36b"
  contexto.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 2200; i += 1) {
    contexto.fillStyle = i % 2 ? "#b08d52" : "#d8bc84"
    contexto.fillRect(Math.random() * 256, Math.random() * 256, 2, 2)
  }
  const textura = new THREE.CanvasTexture(lienzo)
  textura.wrapS = THREE.RepeatWrapping
  textura.wrapT = THREE.RepeatWrapping
  textura.repeat.set(6, 6)
  textura.colorSpace = THREE.SRGBColorSpace
  textura.anisotropy = renderer.capabilities.getMaxAnisotropy()
  return textura
}

function texturaBurbuja() {
  const lienzo = document.createElement("canvas")
  lienzo.width = 64
  lienzo.height = 64
  const contexto = lienzo.getContext("2d")
  const gradiente = contexto.createRadialGradient(32, 32, 2, 32, 32, 30)
  gradiente.addColorStop(0, "rgba(255,255,255,0.9)")
  gradiente.addColorStop(0.4, "rgba(210,240,255,0.35)")
  gradiente.addColorStop(1, "rgba(255,255,255,0)")
  contexto.fillStyle = gradiente
  contexto.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(lienzo)
}

function crearMundo() {
  escena.add(new THREE.HemisphereLight(0xb7e6ff, 0x6a5433, 1.05))
  const sol = new THREE.DirectionalLight(0xe8f7ff, 1.2)
  sol.position.set(8, 20, 6)
  escena.add(sol)
  escena.userData.sol = sol

  const suelo = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({ map: texturaArena(), roughness: 1 }),
  )
  suelo.rotation.x = -Math.PI / 2
  escena.add(suelo)

  const superficie = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({
      color: 0x9ee7ff,
      transparent: true,
      opacity: 0.28,
      roughness: 0.15,
      side: THREE.DoubleSide,
    }),
  )
  superficie.rotation.x = -Math.PI / 2
  superficie.position.y = 14.55
  escena.add(superficie)
  escena.userData.superficie = superficie

  const materialPared = new THREE.MeshStandardMaterial({ color: 0x14566a, roughness: 1 })
  const medidas = [
    [40, 16, 1, 0, 8, -20],
    [40, 16, 1, 0, 8, 20],
    [1, 16, 40, -20, 8, 0],
    [1, 16, 40, 20, 8, 0],
  ]
  for (const [ancho, alto, fondo, x, y, z] of medidas) {
    const pared = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, fondo), materialPared)
    pared.position.set(x, y, z)
    escena.add(pared)
  }

  ROCAS.forEach((roca, indice) => {
    const malla = new THREE.Mesh(
      new THREE.IcosahedronGeometry(roca.r, 0),
      new THREE.MeshStandardMaterial({
        color: indice % 2 ? 0x6d604f : 0x4e5960,
        roughness: 0.96,
        flatShading: true,
      }),
    )
    malla.position.set(roca.x, roca.y, roca.z)
    malla.rotation.set(roca.r, roca.x, roca.z)
    escena.add(malla)
  })

  for (let i = 0; i < 18; i += 1) {
    const alga = crearAlga(Math.sin(i * 12.989) * 16, Math.cos(i * 78.233) * 16, i)
    algas.push(alga)
    escena.add(alga)
  }

  const total = 80
  const posiciones = new Float32Array(total * 3)
  const velocidades = []
  for (let i = 0; i < total; i += 1) {
    posiciones[i * 3] = (Math.random() - 0.5) * 36
    posiciones[i * 3 + 1] = Math.random() * 14
    posiciones[i * 3 + 2] = (Math.random() - 0.5) * 36
    velocidades.push(0.35 + Math.random() * 0.9)
  }
  const geometria = new THREE.BufferGeometry()
  geometria.setAttribute("position", new THREE.BufferAttribute(posiciones, 3))
  const burbujas = new THREE.Points(
    geometria,
    new THREE.PointsMaterial({
      color: 0xd8f6ff,
      map: texturaBurbuja(),
      size: 0.45,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    }),
  )
  burbujas.userData.velocidades = velocidades
  escena.add(burbujas)
  escena.userData.burbujas = burbujas
}

function cambiarAnimacion(accion) {
  if (!accion || accion === accionActual) return
  accion.reset()
  accion.fadeIn(0.25).play()
  if (accionActual) accionActual.fadeOut(0.25)
  accionActual = accion
}

function aleatorio(minimo, maximo) {
  return minimo + Math.random() * (maximo - minimo)
}

function posicionLibre() {
  for (let intento = 0; intento < 20; intento += 1) {
    const punto = {
      x: aleatorio(-15, 15),
      y: aleatorio(2.2, 9),
      z: aleatorio(-15, 15),
    }
    const libre = ROCAS.every((roca) => {
      const dx = punto.x - roca.x
      const dy = punto.y - roca.y
      const dz = punto.z - roca.z
      return Math.hypot(dx, dy, dz) > roca.r + 1.5
    })
    if (libre) return punto
  }
  return { x: 0, y: 5, z: 0 }
}

function crearPez(modeloBase, clipReposo, clipNado, color, largo) {
  const modelo = clonarEsqueleto(modeloBase)
  quitarLucesYCamaras(modelo)
  pintarMallas(modelo, new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.04 }))
  ajustarTamano(modelo, largo, false)
  modelo.rotation.y = Math.PI
  const grupo = new THREE.Group()
  grupo.add(modelo)
  const punto = posicionLibre()
  grupo.position.set(punto.x, punto.y, punto.z)
  const mezclador = new THREE.AnimationMixer(modelo)
  const reposo = mezclador.clipAction(clipReposo)
  const nado = mezclador.clipAction(clipNado)
  nado.play()
  escena.add(grupo)
  peces.push({
    grupo,
    mezclador,
    reposo,
    nado,
    nadando: true,
    heading: Math.random() * Math.PI * 2,
    velocidad: aleatorio(1.1, 2.2),
    baseY: punto.y,
    edad: Math.random() * 6,
    pausa: 0,
  })
}

async function cargarModelos() {
  estadoModelos.textContent = "Cargando modelos..."
  const [modelo, reposoFbx, nadoFbx, textura, makiReposo, makiNado, salmonReposo, salmonNado] = await Promise.all([
    cargarFbx(RUTAS.buzo),
    cargarFbx(RUTAS.reposo),
    cargarFbx(RUTAS.nado),
    cargadorTextura.loadAsync(RUTAS.textura),
    cargarFbx(RUTAS.makiReposo),
    cargarFbx(RUTAS.makiNado),
    cargarFbx(RUTAS.salmonReposo),
    cargarFbx(RUTAS.salmonNado),
  ])

  textura.colorSpace = THREE.SRGBColorSpace
  textura.flipY = true
  quitarLucesYCamaras(modelo)
  pintarMallas(
    modelo,
    new THREE.MeshStandardMaterial({ map: textura, roughness: 0.62, metalness: 0.02 }),
  )
  ajustarTamano(modelo, 1.75, true)
  modelo.rotation.y = Math.PI

  buzo = new THREE.Group()
  buzo.add(modelo)
  buzo.position.set(0, 2.2, 10)
  escena.add(buzo)
  mezcladorBuzo = new THREE.AnimationMixer(modelo)
  accionReposo = mezcladorBuzo.clipAction(clipEnSuLugar(reposoFbx.animations[0], "reposo"))
  accionNado = mezcladorBuzo.clipAction(clipEnSuLugar(nadoFbx.animations[0], "nado"))
  accionReposo.play()
  accionActual = accionReposo

  const reposoMaki = clipEnSuLugar(makiReposo.animations[0], "reposo")
  const nadoMaki = clipEnSuLugar(makiNado.animations[0], "nado")
  const reposoSalmon = clipEnSuLugar(salmonReposo.animations[0], "reposo")
  const nadoSalmon = clipEnSuLugar(salmonNado.animations[0], "nado")
  for (let i = 0; i < 5; i += 1) crearPez(makiReposo, reposoMaki, nadoMaki, 0xf0c14d, 1.7)
  for (let i = 0; i < 5; i += 1) crearPez(salmonReposo, reposoSalmon, nadoSalmon, 0xe07a3d, 2.15)

  modelosListos = true
  estadoModelos.textContent = "Los modelos ya están en el arrecife."
  btnBucear.disabled = false
}

function limitar(valor, minimo, maximo) {
  return Math.min(maximo, Math.max(minimo, valor))
}

function empujarRocas(punto, radio) {
  for (let paso = 0; paso < 2; paso += 1) {
    for (const roca of ROCAS) {
      const dx = punto.x - roca.x
      const dy = punto.y - roca.y
      const dz = punto.z - roca.z
      const dist = Math.hypot(dx, dy, dz) || 0.0001
      const minimo = roca.r + radio
      if (dist < minimo) {
        punto.x = roca.x + (dx / dist) * minimo
        punto.y = roca.y + (dy / dist) * minimo
        punto.z = roca.z + (dz / dist) * minimo
      }
    }
  }
  punto.x = limitar(punto.x, ARENA.minX, ARENA.maxX)
  punto.y = limitar(punto.y, ARENA.minY, ARENA.maxY)
  punto.z = limitar(punto.z, ARENA.minZ, ARENA.maxZ)
}

function actualizarPeces(dt) {
  for (const pez of peces) {
    pez.mezclador.update(dt)
    pez.edad += dt
    if (pez.pausa > 0) {
      pez.pausa -= dt
      if (pez.nadando) {
        pez.nadando = false
        pez.reposo.reset().fadeIn(0.2).play()
        pez.nado.fadeOut(0.2)
      }
    } else {
      if (!pez.nadando) {
        pez.nadando = true
        pez.nado.reset().fadeIn(0.2).play()
        pez.reposo.fadeOut(0.2)
      }
      if (Math.random() < dt * 0.08) pez.pausa = aleatorio(0.8, 1.6)
      pez.grupo.position.x += Math.cos(pez.heading) * pez.velocidad * dt
      pez.grupo.position.z += Math.sin(pez.heading) * pez.velocidad * dt
      if (Math.random() < dt * 0.35) pez.heading += (Math.random() - 0.5) * 1.2
      if (pez.grupo.position.x < -16 || pez.grupo.position.x > 16) {
        pez.grupo.position.x = limitar(pez.grupo.position.x, -16, 16)
        pez.heading = Math.PI - pez.heading
      }
      if (pez.grupo.position.z < -16 || pez.grupo.position.z > 16) {
        pez.grupo.position.z = limitar(pez.grupo.position.z, -16, 16)
        pez.heading = -pez.heading
      }
    }
    pez.grupo.position.y = limitar(pez.baseY + Math.sin(pez.edad * 0.8) * 0.45, 1.6, 11)
    empujarRocas(pez.grupo.position, 0.6)
    const x = pez.grupo.position.x
    const y = pez.grupo.position.y
    const z = pez.grupo.position.z
    pez.grupo.lookAt(x + Math.cos(pez.heading), y, z + Math.sin(pez.heading))
  }
}

function moverBuzo(dt) {
  camara.rotation.order = "YXZ"
  mirada.set(
    -Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    -Math.cos(yaw) * Math.cos(pitch),
  ).normalize()
  derecha.crossVectors(mirada, arriba)
  if (derecha.lengthSq() < 1e-4) derecha.set(1, 0, 0)
  derecha.normalize()
  derecha.y = 0

  deseo.set(0, 0, 0)
  if (teclas.has("KeyW") || teclas.has("ArrowUp")) deseo.add(mirada)
  if (teclas.has("KeyS") || teclas.has("ArrowDown")) deseo.sub(mirada)
  if (teclas.has("KeyD") || teclas.has("ArrowRight")) deseo.add(derecha)
  if (teclas.has("KeyA") || teclas.has("ArrowLeft")) deseo.sub(derecha)

  if (deseo.lengthSq() > 0) {
    deseo.normalize().multiplyScalar(14)
    velocidad.addScaledVector(deseo, dt)
  }
  velocidad.multiplyScalar(Math.exp(-2.8 * dt))
  if (velocidad.length() > 6.5) velocidad.setLength(6.5)
  buzo.position.addScaledVector(velocidad, dt)
  empujarRocas(buzo.position, 0.55)

  buzo.rotation.order = "YXZ"
  const horizontal = Math.hypot(velocidad.x, velocidad.z)
  buzo.rotation.y = horizontal > 0.4 ? Math.atan2(-velocidad.x, -velocidad.z) : yaw
  buzo.rotation.x = limitar(pitch * 0.35, -0.45, 0.45)
  cambiarAnimacion(velocidad.length() > 0.8 ? accionNado : accionReposo)
}

function colocarCamara() {
  const distancia = 3.1
  const lado = 1.15
  const atrasX = Math.sin(yaw)
  const atrasZ = Math.cos(yaw)
  const ladoX = Math.cos(yaw)
  const ladoZ = -Math.sin(yaw)
  camara.position.set(
    buzo.position.x + atrasX * distancia + ladoX * lado,
    buzo.position.y + 0.95 - pitch * 0.45,
    buzo.position.z + atrasZ * distancia + ladoZ * lado,
  )
  camara.lookAt(
    buzo.position.x - atrasX * 1.4,
    buzo.position.y + 0.78 + pitch * 2.2,
    buzo.position.z - atrasZ * 1.4,
  )
}

function fondoMenu(dt) {
  anguloMenu += dt * 0.12
  camara.position.set(Math.sin(anguloMenu) * 15, 8.4, Math.cos(anguloMenu) * 15)
  camara.lookAt(0, 2.2, 0)
}

function actualizarVelo() {
  const bloqueado = document.pointerLockElement === renderer.domElement
  velo.classList.toggle("hidden", !jugando || bloqueado)
}

function leerPerfil() {
  try {
    const texto = sessionStorage.getItem(CLAVE_PERFIL)
    return texto ? JSON.parse(texto) : null
  } catch {
    return null
  }
}

function mostrarError(texto) {
  errorAcceso.textContent = texto
}

function mostrarAcceso() {
  pantallaBienvenida.classList.add("hidden")
  pantallaAcceso.classList.remove("hidden")
}

function mostrarBienvenida(perfil) {
  nombrePerfil.textContent = perfil.nombre
  correoPerfil.textContent = perfil.correo
  nombreHud.textContent = perfil.nombre
  if (perfil.foto) {
    fotoPerfil.src = perfil.foto
    fotoPerfil.classList.remove("hidden")
  } else {
    fotoPerfil.removeAttribute("src")
    fotoPerfil.classList.add("hidden")
  }
  pantallaAcceso.classList.add("hidden")
  pantallaBienvenida.classList.remove("hidden")
}

function guardarPerfil(perfil) {
  sessionStorage.setItem(CLAVE_PERFIL, JSON.stringify(perfil))
  mostrarBienvenida(perfil)
}

function perfilDesdeToken(token) {
  const parte = token.split(".")[1]
  const base64 = parte.replace(/-/g, "+").replace(/_/g, "/")
  const json = decodeURIComponent(
    atob(base64)
      .split("")
      .map((caracter) => `%${caracter.charCodeAt(0).toString(16).padStart(2, "0")}`)
      .join(""),
  )
  const datos = JSON.parse(json)
  return {
    nombre: datos.name || "Sin nombre",
    correo: datos.email || "",
    foto: datos.picture || "",
  }
}

function prepararGoogle() {
  if (!GOOGLE_CLIENT_ID) {
    avisoConfig.textContent = "Falta el ID de cliente de Google en public/config.js."
    avisoConfig.classList.remove("hidden")
    return
  }

  const iniciar = () => {
    if (!window.google?.accounts?.id) return false
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (respuesta) => {
        try {
          guardarPerfil(perfilDesdeToken(respuesta.credential))
          mostrarError("")
        } catch {
          mostrarError("No se pudo leer el perfil de Google.")
        }
      },
    })
    window.google.accounts.id.renderButton(botonGoogle, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "pill",
      locale: "es",
      width: 320,
    })
    return true
  }

  if (iniciar()) return
  const espera = setInterval(() => {
    if (iniciar()) clearInterval(espera)
  }, 100)
  setTimeout(() => clearInterval(espera), 8000)
}

function cerrarSesion() {
  jugando = false
  teclas.clear()
  if (document.pointerLockElement) document.exitPointerLock()
  hud.classList.add("hidden")
  velo.classList.add("hidden")
  sessionStorage.removeItem(CLAVE_PERFIL)
  if (window.google?.accounts?.id) window.google.accounts.id.disableAutoSelect()
  mostrarError("")
  mostrarAcceso()
}

function empezarBuceo() {
  if (!modelosListos || !buzo) return
  jugando = true
  pantallaBienvenida.classList.add("hidden")
  hud.classList.remove("hidden")
  renderer.domElement.requestPointerLock()
  actualizarVelo()
}

btnSalir.addEventListener("click", cerrarSesion)
btnSalirHud.addEventListener("click", cerrarSesion)
btnBucear.addEventListener("click", empezarBuceo)
velo.addEventListener("click", () => {
  if (jugando) renderer.domElement.requestPointerLock()
})
document.addEventListener("pointerlockchange", actualizarVelo)

document.addEventListener("mousemove", (evento) => {
  if (!jugando || document.pointerLockElement !== renderer.domElement) return
  yaw -= evento.movementX * 0.0022
  pitch -= evento.movementY * 0.002
  pitch = limitar(pitch, -1.05, 0.85)
})

window.addEventListener("keydown", (evento) => {
  if (evento.target instanceof HTMLInputElement) return
  teclas.add(evento.code)
})
window.addEventListener("keyup", (evento) => teclas.delete(evento.code))
window.addEventListener("blur", () => teclas.clear())
window.addEventListener("resize", () => {
  camara.aspect = window.innerWidth / window.innerHeight
  camara.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

const reloj = new THREE.Clock()
function animar() {
  requestAnimationFrame(animar)
  const dt = Math.min(reloj.getDelta(), 0.05)
  const tiempo = reloj.elapsedTime

  if (jugando && buzo) {
    moverBuzo(dt)
    colocarCamara()
    mezcladorBuzo?.update(dt)
  } else {
    fondoMenu(dt)
    mezcladorBuzo?.update(dt)
  }

  actualizarPeces(dt)
  for (const alga of algas) {
    alga.rotation.z = Math.sin(tiempo * 1.3 + alga.userData.semilla) * 0.12
  }
  const burbujas = escena.userData.burbujas
  if (burbujas) {
    const posiciones = burbujas.geometry.attributes.position
    const velocidades = burbujas.userData.velocidades
    for (let i = 0; i < velocidades.length; i += 1) {
      let y = posiciones.getY(i) + velocidades[i] * dt
      if (y > 14.5) y = 0.4
      posiciones.setY(i, y)
    }
    posiciones.needsUpdate = true
  }
  if (escena.userData.superficie) {
    escena.userData.superficie.position.y = 14.55 + Math.sin(tiempo * 0.8) * 0.08
    escena.userData.sol.intensity = 1.15 + Math.sin(tiempo * 1.6) * 0.12
  }
  renderer.render(escena, camara)
}

const perfilGuardado = leerPerfil()
if (perfilGuardado?.nombre) mostrarBienvenida(perfilGuardado)
else mostrarAcceso()

crearMundo()
prepararGoogle()
cargarModelos().catch((error) => {
  console.error(error)
  estadoModelos.textContent = "No se pudieron cargar los modelos."
})
animar()
