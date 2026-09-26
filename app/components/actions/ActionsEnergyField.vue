<script setup lang="ts">
import * as THREE from 'three'

const root = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const core = ref<HTMLElement | null>(null)
const nodeA = ref<HTMLElement | null>(null)
const nodeB = ref<HTMLElement | null>(null)
const nodeC = ref<HTMLElement | null>(null)

let renderer: THREE.WebGLRenderer | undefined
let scene: THREE.Scene | undefined
let camera: THREE.OrthographicCamera | undefined
let resizeObserver: ResizeObserver | undefined
let frameId = 0
let visibilityHandler: (() => void) | undefined
let reduceMotionQuery: MediaQueryList | undefined
let reduceMotionHandler: (() => void) | undefined

type Channel = {
  color: THREE.Color
  curves: THREE.CatmullRomCurve3[]
  lines: THREE.Line[]
  particles: THREE.Points[]
  particleOffsets: number[]
}

let channels: Channel[] = []
let width = 1
let height = 1
let reducedMotion = false
let running = true
let lastWidth = 0
let lastHeight = 0

const COLORS = [
  new THREE.Color('#36f0a5'),
  new THREE.Color('#38c8ff'),
  new THREE.Color('#ffb547'),
]

function localPoint(element: HTMLElement, side: 'left' | 'right' | 'center') {
  const container = root.value?.getBoundingClientRect()
  const rect = element.getBoundingClientRect()

  if (!container)
    return { x: 0, y: 0 }

  const x = side === 'left'
    ? rect.left - container.left
    : side === 'right'
      ? rect.right - container.left
      : rect.left - container.left + rect.width / 2

  return {
    x,
    y: rect.top - container.top + rect.height / 2,
  }
}

function worldPoint(x: number, y: number, z = 0) {
  return new THREE.Vector3(
    x - width / 2,
    height / 2 - y,
    z,
  )
}

function clearScene() {
  if (!scene)
    return

  channels.forEach((channel) => {
    channel.lines.forEach((line) => {
      scene?.remove(line)
      line.geometry.dispose()
      const material = line.material
      if (Array.isArray(material))
        material.forEach(item => item.dispose())
      else
        material.dispose()
    })

    channel.particles.forEach((points) => {
      scene?.remove(points)
      points.geometry.dispose()
      const material = points.material
      if (Array.isArray(material))
        material.forEach(item => item.dispose())
      else
        material.dispose()
    })
  })

  channels = []
}

function createCurve(
  start: { x: number, y: number },
  end: { x: number, y: number },
  index: number,
  count: number,
  channelIndex: number,
) {
  const spread = (index - (count - 1) / 2)
  const normalized = spread / Math.max(count / 2, 1)
  const direction = channelIndex === 0 ? -1 : channelIndex === 2 ? 1 : 0

  /*
   * Connexion physique du faisceau :
   * p0 touche exactement le bord droit du noyau.
   * p3 touche exactement le bord gauche de la carte.
   * L'évasement des filaments n'existe qu'entre ces deux points.
   */
  const startX = start.x
  const startY = start.y
  const endX = end.x
  const endY = end.y

  const distance = Math.max(80, endX - startX)

  const waveA = Math.sin(index * 1.73 + channelIndex * 2.4) * 25
  const waveB = Math.cos(index * 1.31 + channelIndex * 1.7) * 32

  const spreadA = normalized * 38
  const spreadB = normalized * 48

  const p0 = worldPoint(
    startX,
    startY,
    0,
  )

  const p1 = worldPoint(
    startX + distance * 0.24,
    startY + spreadA + direction * 42 + waveA,
    normalized * 13,
  )

  const p2 = worldPoint(
    startX + distance * 0.60,
    endY + spreadB - direction * 36 + waveB,
    normalized * 9,
  )

  const p3 = worldPoint(
    endX,
    endY,
    0,
  )

  return new THREE.CatmullRomCurve3(
    [p0, p1, p2, p3],
    false,
    'catmullrom',
    0.55,
  )
}

function rebuildField() {
  if (
    !scene
    || !root.value
    || !core.value
    || !nodeA.value
    || !nodeB.value
    || !nodeC.value
  )
    return

  clearScene()

  const start = localPoint(core.value, 'right')
  const targets = [
    localPoint(nodeA.value, 'left'),
    localPoint(nodeB.value, 'left'),
    localPoint(nodeC.value, 'left'),
  ]

  const compact = width < 620
  const filamentCount = compact ? 13 : 23
  const segments = compact ? 42 : 64

  targets.forEach((target, channelIndex) => {
    const channel: Channel = {
      color: COLORS[channelIndex]!.clone(),
      curves: [],
      lines: [],
      particles: [],
      particleOffsets: [],
    }

    for (let i = 0; i < filamentCount; i++) {
      const curve = createCurve(
        start,
        target,
        i,
        filamentCount,
        channelIndex,
      )

      const points = curve.getPoints(segments)
      const geometry = new THREE.BufferGeometry().setFromPoints(points)

      const centerDistance = Math.abs(i - (filamentCount - 1) / 2)
      const alpha = Math.max(
        0.075,
        0.31 - centerDistance * 0.015,
      )

      const material = new THREE.LineBasicMaterial({
        color: channel.color,
        transparent: true,
        opacity: alpha,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })

      const line = new THREE.Line(geometry, material)
      line.renderOrder = 1
      scene!.add(line)

      channel.curves.push(curve)
      channel.lines.push(line)

      if (i % (compact ? 4 : 3) === 0) {
        const particleGeometry = new THREE.BufferGeometry()
        particleGeometry.setAttribute(
          'position',
          new THREE.Float32BufferAttribute([0, 0, 0], 3),
        )

        const particleMaterial = new THREE.PointsMaterial({
          color: channel.color,
          size: compact ? 3.2 : 4.4,
          transparent: true,
          opacity: 0.92,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          sizeAttenuation: false,
        })

        const particle = new THREE.Points(
          particleGeometry,
          particleMaterial,
        )

        scene!.add(particle)
        channel.particles.push(particle)
        channel.particleOffsets.push(
          (i / filamentCount + channelIndex * 0.19) % 1,
        )
      }
    }

    channels.push(channel)
  })
}

function resize() {
  if (!root.value || !renderer || !camera)
    return

  const rect = root.value.getBoundingClientRect()
  const nextWidth = Math.max(1, Math.round(rect.width))
  const nextHeight = Math.max(1, Math.round(rect.height))

  if (nextWidth === lastWidth && nextHeight === lastHeight)
    return

  lastWidth = nextWidth
  lastHeight = nextHeight
  width = nextWidth
  height = nextHeight

  const dpr = Math.min(window.devicePixelRatio || 1, 1.75)
  renderer.setPixelRatio(dpr)
  renderer.setSize(width, height, false)

  camera.left = -width / 2
  camera.right = width / 2
  camera.top = height / 2
  camera.bottom = -height / 2
  camera.updateProjectionMatrix()

  requestAnimationFrame(rebuildField)
}

function updateField(time: number) {
  const seconds = time * 0.001

  channels.forEach((channel, channelIndex) => {
    const phase = (seconds / 3.6 + channelIndex * 0.18) % 1

    channel.lines.forEach((line, lineIndex) => {
      const material = line.material as THREE.LineBasicMaterial
      const centerDistance = Math.abs(
        lineIndex - (channel.lines.length - 1) / 2,
      )

      const base = Math.max(
        0.065,
        0.28 - centerDistance * 0.014,
      )

      const pulsePosition = phase * channel.lines.length
      const pulseDistance = Math.abs(lineIndex - pulsePosition)
      const pulse = Math.max(0, 1 - pulseDistance / 5)

      material.opacity = reducedMotion
        ? base
        : base + pulse * 0.19
    })

    channel.particles.forEach((particle, particleIndex) => {
      const curveIndex = Math.min(
        particleIndex * (width < 620 ? 4 : 3),
        channel.curves.length - 1,
      )

      const curve = channel.curves[curveIndex]
      if (!curve)
        return

      const offset = channel.particleOffsets[particleIndex] ?? 0
      const speed = 0.055 + particleIndex * 0.004
      const t = reducedMotion
        ? offset
        : (offset + seconds * speed) % 1

      const point = curve.getPointAt(t)
      const positions = particle.geometry.attributes.position

      if (positions) {
        positions.setXYZ(0, point.x, point.y, point.z + 2)
        positions.needsUpdate = true
      }

      const material = particle.material as THREE.PointsMaterial
      const envelope = Math.sin(Math.PI * t)
      material.opacity = 0.35 + envelope * 0.65
    })
  })
}

function render(time = 0) {
  if (!renderer || !scene || !camera)
    return

  if (running) {
    updateField(time)
    renderer.render(scene, camera)
  }

  frameId = requestAnimationFrame(render)
}

onMounted(() => {
  if (!canvas.value || !root.value)
    return

  reducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches

  renderer = new THREE.WebGLRenderer({
    canvas: canvas.value,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
  })

  renderer.setClearColor(0x000000, 0)

  scene = new THREE.Scene()

  camera = new THREE.OrthographicCamera(
    -1,
    1,
    1,
    -1,
    -100,
    100,
  )
  camera.position.z = 10

  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(root.value)

  visibilityHandler = () => {
    running = !document.hidden
  }

  document.addEventListener(
    'visibilitychange',
    visibilityHandler,
  )

  reduceMotionQuery = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  )

  reduceMotionHandler = () => {
    reducedMotion = reduceMotionQuery?.matches ?? false
  }

  reduceMotionQuery.addEventListener(
    'change',
    reduceMotionHandler,
  )

  resize()
  frameId = requestAnimationFrame(render)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frameId)
  resizeObserver?.disconnect()

  if (visibilityHandler) {
    document.removeEventListener(
      'visibilitychange',
      visibilityHandler,
    )
  }

  if (reduceMotionQuery && reduceMotionHandler) {
    reduceMotionQuery.removeEventListener(
      'change',
      reduceMotionHandler,
    )
  }

  clearScene()
  renderer?.dispose()

  renderer = undefined
  scene = undefined
  camera = undefined
})
</script>

<template>
  <div
    ref="root"
    class="energy-field"
    aria-hidden="true"
  >
    <canvas
      ref="canvas"
      class="energy-field__canvas"
    />

    <div class="energy-field__ambient energy-field__ambient--green" />
    <div class="energy-field__ambient energy-field__ambient--blue" />
    <div class="energy-field__ambient energy-field__ambient--amber" />

    <div
      ref="core"
      class="energy-field__core"
    >
      <span class="energy-field__core-orbit energy-field__core-orbit--a" />
      <span class="energy-field__core-orbit energy-field__core-orbit--b" />

      <div class="energy-field__core-body">
        <span>IFICS</span>
        <strong>AGIR</strong>
        <small>IMPACT LOCAL</small>
      </div>
    </div>

    <div class="energy-field__nodes">
      <article
        ref="nodeA"
        class="energy-field__node energy-field__node--green"
      >
        <div class="energy-field__node-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="4" width="18" height="13" rx="2" />
            <path d="M8 21h8M12 17v4" />
          </svg>
        </div>

        <div>
          <small>01 · CONCEVOIR</small>
          <strong>Numérique</strong>
          <span>Ingénierie &amp; solutions</span>
        </div>
      </article>

      <article
        ref="nodeB"
        class="energy-field__node energy-field__node--blue"
      >
        <div class="energy-field__node-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m3 10 9-5 9 5-9 5-9-5Z" />
            <path d="M7 12.5V17c3 2 7 2 10 0v-4.5" />
          </svg>
        </div>

        <div>
          <small>02 · TRANSMETTRE</small>
          <strong>Éducation</strong>
          <span>Compétences &amp; inclusion</span>
        </div>
      </article>

      <article
        ref="nodeC"
        class="energy-field__node energy-field__node--amber"
      >
        <div class="energy-field__node-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="9" cy="8" r="3" />
            <circle cx="17" cy="9" r="2.3" />
            <path d="M3.5 20c.4-4 2.2-6 5.5-6s5.1 2 5.5 6" />
            <path d="M14.5 15c3.6-.8 5.6.9 6 4" />
          </svg>
        </div>

        <div>
          <small>03 · RÉUNIR</small>
          <strong>Culture &amp; sport</strong>
          <span>Pratique &amp; lien social</span>
        </div>
      </article>
    </div>

    <div class="energy-field__status">
      <i />
      <span>3 PÔLES · 1 MISSION</span>
    </div>
  </div>
</template>

<style scoped>
.energy-field {
  position: relative;
  width: min(100%, 620px);
  height: 430px;
  isolation: isolate;
  overflow: visible;
}

.energy-field__canvas {
  position: absolute;
  inset: 0;
  z-index: 2;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.energy-field__ambient {
  position: absolute;
  z-index: 0;
  width: 240px;
  height: 170px;
  border-radius: 999px;
  opacity: .15;
  filter: blur(62px);
  pointer-events: none;
}

.energy-field__ambient--green {
  top: 20px;
  right: 60px;
  background: #20e99b;
}

.energy-field__ambient--blue {
  top: 135px;
  right: 15px;
  background: #24bfff;
}

.energy-field__ambient--amber {
  right: 40px;
  bottom: 15px;
  background: #ffae35;
}

.energy-field__core {
  position: absolute;
  z-index: 4;
  top: 50%;
  left: 16%;
  width: 136px;
  height: 136px;
  transform: translate(-50%, -50%);
  display: grid;
  place-items: center;
}

.energy-field__core::before {
  content: "";
  position: absolute;
  inset: -44px;
  border-radius: 50%;
  background:
    radial-gradient(
      circle,
      rgba(44, 246, 165, .18) 0,
      rgba(44, 246, 165, .07) 35%,
      transparent 70%
    );
  filter: blur(5px);
  animation: energy-core-halo 4.8s ease-in-out infinite;
}

.energy-field__core-orbit {
  position: absolute;
  inset: -15px;
  border: 1px solid rgba(72, 247, 180, .22);
  border-radius: 50%;
  box-shadow:
    0 0 28px rgba(42, 239, 164, .08),
    inset 0 0 24px rgba(42, 239, 164, .05);
}

.energy-field__core-orbit--a {
  animation: energy-orbit-a 10s linear infinite;
}

.energy-field__core-orbit--b {
  inset: -27px;
  border-color: rgba(62, 221, 169, .1);
  border-style: dashed;
  animation: energy-orbit-b 16s linear infinite;
}

.energy-field__core-body {
  position: relative;
  width: 116px;
  height: 116px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(81, 255, 188, .55);
  border-radius: 50%;
  color: #effff9;
  background:
    radial-gradient(
      circle at 42% 34%,
      rgba(40, 116, 90, .42),
      rgba(6, 30, 25, .96) 48%,
      rgba(2, 10, 9, .99) 75%
    );
  box-shadow:
    0 0 10px rgba(63, 255, 184, .34),
    0 0 34px rgba(33, 234, 158, .18),
    inset 0 0 28px rgba(40, 242, 167, .12);
}

.energy-field__core-body::after {
  content: "";
  position: absolute;
  inset: 6px;
  border-radius: inherit;
  border-top: 1px solid rgba(188, 255, 230, .25);
  opacity: .7;
}

.energy-field__core-body span,
.energy-field__core-body strong,
.energy-field__core-body small {
  position: relative;
  z-index: 1;
}

.energy-field__core-body span {
  margin-bottom: 2px;
  color: #8cf5cb;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .19em;
}

.energy-field__core-body strong {
  font-family: Montserrat, sans-serif;
  font-size: 23px;
  line-height: 1;
  letter-spacing: -.03em;
}

.energy-field__core-body small {
  margin-top: 7px;
  color: rgba(218, 239, 231, .54);
  font-size: 7px;
  font-weight: 700;
  letter-spacing: .13em;
}

.energy-field__nodes {
  position: absolute;
  z-index: 5;
  inset: 0;
}

.energy-field__node {
  position: absolute;
  right: 0;
  width: 205px;
  min-height: 92px;
  display: flex;
  gap: 13px;
  align-items: center;
  padding: 15px 16px;
  border: 1px solid rgba(255, 255, 255, .1);
  border-radius: 14px;
  backdrop-filter: blur(12px);
  background: rgba(5, 15, 17, .82);
  box-shadow:
    0 16px 36px rgba(0, 0, 0, .22),
    inset 0 1px rgba(255, 255, 255, .025);
}

.energy-field__node::before {
  content: "";
  position: absolute;
  top: 17%;
  bottom: 17%;
  left: -1px;
  width: 2px;
  border-radius: 2px;
  background: currentColor;
  box-shadow: 0 0 18px currentColor;
  opacity: .8;
}

.energy-field__node--green {
  top: 22px;
  color: #47efaa;
  border-color: rgba(65, 239, 170, .28);
  background:
    linear-gradient(
      105deg,
      rgba(18, 70, 53, .30),
      rgba(5, 15, 17, .87) 48%
    );
  animation: energy-card-green 10.8s ease-in-out infinite;
}

.energy-field__node--blue {
  top: 168px;
  color: #49caff;
  border-color: rgba(65, 195, 255, .30);
  background:
    linear-gradient(
      105deg,
      rgba(13, 60, 82, .32),
      rgba(5, 15, 17, .87) 48%
    );
  animation: energy-card-blue 10.8s ease-in-out infinite;
}

.energy-field__node--amber {
  top: 314px;
  color: #ffbb55;
  border-color: rgba(255, 181, 71, .30);
  background:
    linear-gradient(
      105deg,
      rgba(82, 52, 13, .31),
      rgba(5, 15, 17, .87) 48%
    );
  animation: energy-card-amber 10.8s ease-in-out infinite;
}

.energy-field__node-icon {
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 1px solid currentColor;
  border-radius: 9px;
  background: rgba(255, 255, 255, .025);
  box-shadow: inset 0 0 16px rgba(255, 255, 255, .025);
}

.energy-field__node-icon svg {
  width: 19px;
  height: 19px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.45;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.energy-field__node small,
.energy-field__node strong,
.energy-field__node span {
  display: block;
}

.energy-field__node small {
  margin-bottom: 5px;
  color: currentColor;
  font-size: 7px;
  font-weight: 800;
  letter-spacing: .14em;
}

.energy-field__node strong {
  color: #f3f8f6;
  font-family: Montserrat, sans-serif;
  font-size: 14px;
  line-height: 1.12;
}

.energy-field__node span {
  margin-top: 4px;
  color: rgba(218, 230, 226, .55);
  font-size: 9px;
  line-height: 1.2;
}

.energy-field__status {
  position: absolute;
  z-index: 6;
  bottom: -2px;
  left: 16%;
  display: flex;
  align-items: center;
  gap: 8px;
  transform: translateX(-50%);
  color: rgba(216, 232, 226, .5);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: .14em;
  white-space: nowrap;
}

.energy-field__status i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #40eaa7;
  box-shadow: 0 0 10px #40eaa7;
  animation: energy-status 2.2s ease-in-out infinite;
}

@keyframes energy-core-halo {
  0%,
  100% {
    opacity: .68;
    transform: scale(.94);
  }

  50% {
    opacity: 1;
    transform: scale(1.08);
  }
}

@keyframes energy-orbit-a {
  to {
    transform: rotate(360deg);
  }
}

@keyframes energy-orbit-b {
  to {
    transform: rotate(-360deg);
  }
}

@keyframes energy-status {
  50% {
    opacity: .35;
  }
}

@keyframes energy-card-green {
  0%,
  22%,
  100% {
    box-shadow: 0 16px 36px rgba(0, 0, 0, .22);
  }

  9% {
    box-shadow:
      0 16px 36px rgba(0, 0, 0, .22),
      0 0 25px rgba(54, 240, 165, .13);
  }
}

@keyframes energy-card-blue {
  0%,
  30%,
  55%,
  100% {
    box-shadow: 0 16px 36px rgba(0, 0, 0, .22);
  }

  42% {
    box-shadow:
      0 16px 36px rgba(0, 0, 0, .22),
      0 0 25px rgba(56, 200, 255, .14);
  }
}

@keyframes energy-card-amber {
  0%,
  62%,
  88%,
  100% {
    box-shadow: 0 16px 36px rgba(0, 0, 0, .22);
  }

  75% {
    box-shadow:
      0 16px 36px rgba(0, 0, 0, .22),
      0 0 25px rgba(255, 181, 71, .14);
  }
}

@media (max-width: 720px) {
  .energy-field {
    width: 100%;
    max-width: 560px;
    height: 420px;
    margin-inline: auto;
  }

  .energy-field__core {
    left: 17%;
    width: 116px;
    height: 116px;
  }

  .energy-field__core-body {
    width: 100px;
    height: 100px;
  }

  .energy-field__core-body strong {
    font-size: 20px;
  }

  .energy-field__node {
    width: 190px;
    min-height: 86px;
    padding: 13px 14px;
  }

  .energy-field__node--green {
    top: 25px;
  }

  .energy-field__node--blue {
    top: 166px;
  }

  .energy-field__node--amber {
    top: 307px;
  }

  .energy-field__status {
    left: 17%;
  }
}

@media (max-width: 520px) {
  .energy-field {
    height: 445px;
  }

  .energy-field__core {
    top: 49%;
    left: 19%;
    transform: translate(-50%, -50%) scale(.82);
  }

  .energy-field__node {
    right: 0;
    width: 170px;
    min-height: 82px;
    gap: 9px;
    padding: 11px;
  }

  .energy-field__node-icon {
    width: 29px;
    height: 29px;
  }

  .energy-field__node-icon svg {
    width: 16px;
    height: 16px;
  }

  .energy-field__node strong {
    font-size: 12px;
  }

  .energy-field__node span {
    font-size: 8px;
  }

  .energy-field__node--green {
    top: 32px;
  }

  .energy-field__node--blue {
    top: 181px;
  }

  .energy-field__node--amber {
    top: 330px;
  }

  .energy-field__status {
    bottom: 2px;
    left: 19%;
    font-size: 7px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .energy-field__core::before,
  .energy-field__core-orbit,
  .energy-field__node,
  .energy-field__status i {
    animation: none !important;
  }
}
</style>
