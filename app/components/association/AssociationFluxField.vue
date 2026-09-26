<script setup lang="ts">
const poles = [
  {
    code: 'education',
    label: 'Éducation',
    subtitle: 'Apprendre et transmettre',
    color: '#28f0d1',
    image: '/images/association/education.webp',
    y: 48,
    icon: 'education',
  },
  {
    code: 'inclusion',
    label: 'Inclusion',
    subtitle: 'Accompagner tous les parcours',
    color: '#43e990',
    image: '/images/association/inclusion.webp',
    y: 142,
    icon: 'inclusion',
  },
  {
    code: 'culture',
    label: 'Culture',
    subtitle: 'Créer et partager des expériences',
    color: '#ffae43',
    image: '/images/association/culture.webp',
    y: 236,
    icon: 'culture',
  },
  {
    code: 'sport',
    label: 'Sport',
    subtitle: 'Bouger, se dépasser et faire ensemble',
    color: '#35bfff',
    image: '/images/association/sport.webp',
    y: 330,
    icon: 'sport',
  },
  {
    code: 'numerique',
    label: 'Numérique',
    subtitle: 'Innover et construire demain',
    color: '#c75aff',
    image: '/images/association/numerique.webp',
    y: 424,
    icon: 'numerique',
  },
]

const filamentOffsets = [-16, -12, -8, -4, 0, 4, 8, 12, 16]

function pathFor(y: number, offset = 0) {
  const startX = 191
  const startY = 236 + offset * 0.12

  const endX = 344
  const endY = y + offset * 0.64

  const delta = endY - startY

  return [
    `M ${startX} ${startY}`,
    `C ${224} ${startY + delta * 0.05},`,
    `${274} ${endY - delta * 0.16},`,
    `${endX} ${endY}`,
  ].join(' ')
}

function iconPaths(icon: string) {
  if (icon === 'education') {
    return [
      'M3 10 12 5l9 5-9 5-9-5Z',
      'M7 12.3V17c3.3 2.2 6.7 2.2 10 0v-4.7',
    ]
  }

  if (icon === 'inclusion') {
    return [
      'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
      'M17 11a3 3 0 1 0 0-6',
      'M2 21v-2a6 6 0 0 1 12 0v2',
      'M15 15a5 5 0 0 1 7 4.6V21',
    ]
  }

  if (icon === 'culture') {
    return [
      'M12 3a9 9 0 0 0 0 18h1.5a2 2 0 0 0 0-4H12a2 2 0 0 1 0-4h2.5A6.5 6.5 0 0 0 12 3Z',
      'M7.5 10h.01',
      'M9.5 6.8h.01',
      'M14 6.5h.01',
      'M17 9.5h.01',
    ]
  }

  if (icon === 'sport') {
    return [
      'M13.5 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
      'm8 22 2.8-6 2.2-3 2.8 2.5 3.7 1',
      'm11 9 3 2 2-3',
      'm10.8 16 4.2 2 2 4',
    ]
  }

  return [
    'M4 5h16v11H4V5Z',
    'M2 19h20',
    'M9 19v-3',
    'M15 19v-3',
  ]
}
</script>

<template>
  <div
    class="association-flux"
    aria-label="Les cinq pôles d’IFICS"
  >
    <div class="association-flux__ambient" />

    <svg
      class="association-flux__network"
      viewBox="0 0 650 472"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <defs>
        <filter
          id="fluxGlow"
          x="-80%"
          y="-80%"
          width="260%"
          height="260%"
        >
          <feGaussianBlur
            stdDeviation="3.8"
            result="blur"
          />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter
          id="fluxParticleGlow"
          x="-200%"
          y="-200%"
          width="500%"
          height="500%"
        >
          <feGaussianBlur
            stdDeviation="2.4"
            result="blur"
          />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <radialGradient id="coreAura">
          <stop
            offset="0%"
            stop-color="#25f2b7"
            stop-opacity=".26"
          />
          <stop
            offset="48%"
            stop-color="#17cda1"
            stop-opacity=".08"
          />
          <stop
            offset="100%"
            stop-color="#17cda1"
            stop-opacity="0"
          />
        </radialGradient>
      </defs>

      <circle
        cx="143"
        cy="236"
        r="136"
        fill="url(#coreAura)"
      />

      <g
        v-for="(pole, poleIndex) in poles"
        :key="pole.code"
      >
        <!-- halo principal -->
        <path
          :d="pathFor(pole.y)"
          fill="none"
          :stroke="pole.color"
          stroke-width="9"
          stroke-opacity=".055"
          stroke-linecap="round"
          filter="url(#fluxGlow)"
        />

        <!-- filaments -->
        <path
          v-for="(offset, index) in filamentOffsets"
          :key="`${pole.code}-${offset}`"
          :d="pathFor(pole.y, offset)"
          fill="none"
          :stroke="pole.color"
          :stroke-width="index === 4 ? 1.8 : .72"
          :stroke-opacity="index === 4 ? .88 : .30"
          stroke-linecap="round"
          filter="url(#fluxGlow)"
          class="association-flux__filament"
          :style="{
            animationDelay: `${-(index * .19 + poleIndex * .31)}s`,
          }"
        />

        <!-- noeud d'arrivée -->
        <circle
          cx="344"
          :cy="pole.y"
          r="8"
          :fill="pole.color"
          fill-opacity=".16"
          :stroke="pole.color"
          stroke-width="1"
          filter="url(#fluxGlow)"
          class="association-flux__node"
        />

        <circle
          cx="344"
          :cy="pole.y"
          r="3.2"
          :fill="pole.color"
          filter="url(#fluxParticleGlow)"
        />

        <!-- particules voyageuses -->
        <circle
          v-for="particleIndex in 4"
          :key="`${pole.code}-particle-${particleIndex}`"
          :r="particleIndex === 1 ? 2.6 : 1.7"
          :fill="pole.color"
          filter="url(#fluxParticleGlow)"
          class="association-flux__particle"
        >
          <animateMotion
            :dur="`${3 + particleIndex * .55}s`"
            repeatCount="indefinite"
            :begin="`${-(particleIndex * .82 + poleIndex * .27)}s`"
            :path="pathFor(pole.y, (particleIndex - 2.5) * 4)"
          />
        </circle>
      </g>
    </svg>

    <!-- NOYAU -->
    <div class="association-flux__core">
      <span class="association-flux__orbit association-flux__orbit--one" />
      <span class="association-flux__orbit association-flux__orbit--two" />
      <span class="association-flux__orbit association-flux__orbit--three" />

      <span class="association-flux__core-aura" />

      <div class="association-flux__core-body">
        <span class="association-flux__core-grid" />
        <span class="association-flux__core-sheen" />

        <img
          src="/brand/v2/ifics-wordmark-light.png"
          alt="IFICS"
        >
      </div>
    </div>

    <!-- CARTES -->
    <div class="association-flux__poles">
      <article
        v-for="pole in poles"
        :key="pole.code"
        class="association-flux__pole"
        :class="`association-flux__pole--${pole.code}`"
        :style="{ '--pole-color': pole.color }"
      >
        <span class="association-flux__pole-edge" />

        <div class="association-flux__icon">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              v-for="(path, index) in iconPaths(pole.icon)"
              :key="index"
              :d="path"
            />
          </svg>
        </div>

        <div class="association-flux__copy">
          <strong>{{ pole.label }}</strong>
          <span>{{ pole.subtitle }}</span>
        </div>

        <div class="association-flux__photo">
          <img
            :src="pole.image"
            alt=""
            loading="eager"
          >
          <span class="association-flux__photo-fade" />
        </div>

        <span class="association-flux__arrow">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M5 12h13M14 7l5 5-5 5" />
          </svg>
        </span>
      </article>
    </div>

    <i class="association-flux__spark association-flux__spark--a" />
    <i class="association-flux__spark association-flux__spark--b" />
    <i class="association-flux__spark association-flux__spark--c" />
    <i class="association-flux__spark association-flux__spark--d" />
  </div>
</template>

<style scoped>
.association-flux {
  position: relative;
  width: min(100%, 650px);
  height: 472px;
  margin-inline: auto;
  isolation: isolate;
}

.association-flux__ambient {
  position: absolute;
  z-index: 0;
  inset: -10% -8%;
  pointer-events: none;
  background:
    radial-gradient(circle at 23% 50%, rgba(23, 233, 173, .16), transparent 26%),
    radial-gradient(circle at 58% 21%, rgba(28, 207, 194, .055), transparent 24%),
    radial-gradient(circle at 58% 80%, rgba(116, 62, 239, .05), transparent 28%);
  filter: blur(22px);
}

.association-flux__network {
  position: absolute;
  z-index: 2;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.association-flux__filament {
  stroke-dasharray: 2 7 14 8;
  animation: fluxTravel 4.2s linear infinite;
}

.association-flux__particle {
  opacity: .96;
}

.association-flux__node {
  transform-box: fill-box;
  transform-origin: center;
  animation: nodePulse 2.5s ease-in-out infinite;
}

/* CORE */

.association-flux__core {
  position: absolute;
  z-index: 6;
  left: 22%;
  top: 50%;
  width: 164px;
  height: 164px;
  transform: translate(-50%, -50%);
}

.association-flux__core-aura {
  position: absolute;
  inset: -39px;
  border-radius: 50%;
  background:
    radial-gradient(
      circle,
      rgba(39, 243, 185, .17),
      rgba(31, 194, 150, .045) 46%,
      transparent 69%
    );
  filter: blur(4px);
  animation: coreAura 4.5s ease-in-out infinite;
}

.association-flux__orbit {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}

.association-flux__orbit--one {
  inset: -21px;
  border: 1px solid rgba(48, 242, 185, .18);
  border-left-color: rgba(55, 255, 195, .68);
  transform: rotate(-14deg);
  animation: orbitRotate 14s linear infinite;
}

.association-flux__orbit--two {
  inset: -10px;
  border: 1px solid rgba(43, 238, 181, .22);
  border-right-color: rgba(62, 250, 194, .72);
  transform: rotate(21deg);
  animation: orbitRotateReverse 10s linear infinite;
}

.association-flux__orbit--three {
  inset: 0;
  border: 1px solid rgba(63, 246, 192, .34);
  box-shadow:
    0 0 16px rgba(35, 237, 177, .12),
    inset 0 0 18px rgba(35, 237, 177, .07);
}

.association-flux__core-body {
  position: absolute;
  inset: 11px;
  display: grid;
  place-items: center;
  overflow: hidden;
  padding: 25px;
  border: 1px solid rgba(76, 250, 199, .62);
  border-radius: 50%;
  background:
    radial-gradient(circle at 50% 31%, rgba(48, 218, 169, .21), transparent 39%),
    radial-gradient(circle at 50% 64%, rgba(9, 48, 39, .96), rgba(2, 19, 16, .99));
  box-shadow:
    0 0 12px rgba(43, 240, 182, .22),
    0 0 48px rgba(35, 231, 173, .13),
    inset 0 0 38px rgba(37, 227, 171, .10);
}

.association-flux__core-grid {
  position: absolute;
  inset: 0;
  opacity: .16;
  background:
    linear-gradient(rgba(70, 255, 203, .12) 1px, transparent 1px),
    linear-gradient(90deg, rgba(70, 255, 203, .12) 1px, transparent 1px);
  background-size: 15px 15px;
  mask-image: radial-gradient(circle, #000, transparent 72%);
}

.association-flux__core-sheen {
  position: absolute;
  z-index: 1;
  left: 12%;
  top: 18%;
  width: 76%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(137, 255, 222, .9), transparent);
  box-shadow: 0 0 8px rgba(70, 255, 203, .55);
  animation: coreScan 4.2s ease-in-out infinite;
}

.association-flux__core-body img {
  position: relative;
  z-index: 2;
  width: 110px;
  height: auto;
  object-fit: contain;
}

/* CARDS */

.association-flux__poles {
  position: absolute;
  z-index: 5;
  inset: 0;
  pointer-events: none;
}

.association-flux__pole {
  --pole-color: #3ee5b3;

  position: absolute;
  right: 0;
  width: 306px;
  height: 76px;
  display: grid;
  grid-template-columns: 46px 1fr;
  align-items: center;
  gap: 10px;
  overflow: hidden;
  padding: 0 12px;
  border: 1px solid color-mix(in srgb, var(--pole-color) 62%, transparent);
  border-radius: 9px 23px 23px 9px;
  background: rgba(3, 22, 19, .86);
  box-shadow:
    0 14px 34px rgba(0, 0, 0, .30),
    0 0 20px color-mix(in srgb, var(--pole-color) 8%, transparent),
    inset 0 0 25px color-mix(in srgb, var(--pole-color) 5%, transparent);
  backdrop-filter: blur(11px);
}

.association-flux__pole::after {
  content: "";
  position: absolute;
  z-index: 6;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .06),
    inset 0 0 0 1px color-mix(in srgb, var(--pole-color) 7%, transparent);
}

.association-flux__pole-edge {
  position: absolute;
  z-index: 7;
  left: -1px;
  top: 17%;
  width: 2px;
  height: 66%;
  background: var(--pole-color);
  box-shadow:
    0 0 7px var(--pole-color),
    0 0 18px var(--pole-color);
}

.association-flux__icon {
  position: relative;
  z-index: 8;
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--pole-color) 76%, transparent);
  border-radius: 50%;
  color: var(--pole-color);
  background: color-mix(in srgb, var(--pole-color) 8%, rgba(1, 16, 13, .82));
  box-shadow:
    0 0 17px color-mix(in srgb, var(--pole-color) 13%, transparent),
    inset 0 0 11px color-mix(in srgb, var(--pole-color) 8%, transparent);
}

.association-flux__icon svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.65;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.association-flux__copy {
  position: relative;
  z-index: 8;
  min-width: 0;
}

.association-flux__copy strong {
  display: block;
  margin-bottom: 4px;
  color: #f3faf7;
  font-size: .91rem;
  font-weight: 760;
  letter-spacing: -.01em;
}

.association-flux__copy span {
  display: block;
  max-width: 118px;
  color: rgba(224, 238, 233, .68);
  font-size: .62rem;
  font-weight: 450;
  line-height: 1.27;
}

.association-flux__photo {
  position: absolute;
  z-index: 1;
  top: 0;
  right: 0;
  width: 64%;
  height: 100%;
  overflow: hidden;
  pointer-events: none;
}

.association-flux__photo img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  filter:
    saturate(.92)
    contrast(1.04)
    brightness(.78);
}

.association-flux__pole--education .association-flux__photo img {
  object-position: 82% center;
}

.association-flux__photo::before {
  content: "";
  position: absolute;
  z-index: 2;
  inset: 0;
  background:
    linear-gradient(
      90deg,
      rgba(3, 22, 19, 1) 0%,
      rgba(3, 22, 19, .92) 13%,
      rgba(3, 22, 19, .60) 29%,
      rgba(3, 22, 19, .20) 49%,
      rgba(3, 22, 19, .03) 70%,
      transparent 100%
    );
}

.association-flux__photo::after {
  content: "";
  position: absolute;
  z-index: 3;
  inset: 0;
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--pole-color) 5%, transparent),
      transparent 35%,
      rgba(0, 0, 0, .08)
    );
  box-shadow:
    inset 0 0 24px rgba(0, 0, 0, .14);
}

.association-flux__photo-fade {
  display: none;
}

.association-flux__arrow {
  position: absolute;
  z-index: 10;
  right: 10px;
  top: 50%;
  width: 31px;
  height: 31px;
  display: grid;
  place-items: center;
  transform: translateY(-50%);
  color: var(--pole-color);
  border: 1px solid color-mix(in srgb, var(--pole-color) 70%, transparent);
  border-radius: 50%;
  background: rgba(2, 18, 15, .67);
  box-shadow: 0 0 13px color-mix(in srgb, var(--pole-color) 12%, transparent);
}

.association-flux__arrow svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.association-flux__pole--education {
  top: 10px;
}

.association-flux__pole--inclusion {
  top: 104px;
}

.association-flux__pole--culture {
  top: 198px;
}

.association-flux__pole--sport {
  top: 292px;
}

.association-flux__pole--numerique {
  top: 386px;
}

/* AMBIENT PARTICLES */

.association-flux__spark {
  position: absolute;
  z-index: 3;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #a0ffe5;
  box-shadow:
    0 0 7px #43eab9,
    0 0 15px rgba(67, 234, 185, .6);
  animation: sparkPulse 3.1s ease-in-out infinite;
}

.association-flux__spark--a {
  left: 3%;
  top: 27%;
}

.association-flux__spark--b {
  left: 37%;
  bottom: 8%;
  animation-delay: -.8s;
}

.association-flux__spark--c {
  left: 47%;
  top: 7%;
  animation-delay: -1.7s;
}

.association-flux__spark--d {
  left: 30%;
  top: 13%;
  animation-delay: -2.4s;
}

/* ANIMATION */

@keyframes fluxTravel {
  to {
    stroke-dashoffset: -62;
  }
}

@keyframes nodePulse {
  0%,
  100% {
    opacity: .62;
    transform: scale(.82);
  }

  50% {
    opacity: 1;
    transform: scale(1.22);
  }
}

@keyframes orbitRotate {
  to {
    transform: rotate(346deg);
  }
}

@keyframes orbitRotateReverse {
  to {
    transform: rotate(-339deg);
  }
}

@keyframes coreAura {
  0%,
  100% {
    opacity: .62;
    transform: scale(.94);
  }

  50% {
    opacity: 1;
    transform: scale(1.08);
  }
}

@keyframes coreScan {
  0%,
  100% {
    opacity: .18;
    transform: translateY(-10px);
  }

  50% {
    opacity: .72;
    transform: translateY(52px);
  }
}

@keyframes sparkPulse {
  0%,
  100% {
    opacity: .15;
    transform: scale(.55);
  }

  50% {
    opacity: 1;
    transform: scale(1.55);
  }
}

/* RESPONSIVE */

@media (max-width: 950px) {
  .association-flux {
    max-width: 650px;
  }
}

@media (max-width: 620px) {
  .association-flux {
    left: 50%;
    width: 650px;
    max-width: none;
    transform: translateX(-50%) scale(.72);
    transform-origin: top center;
    margin-bottom: -118px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .association-flux *,
  .association-flux *::before,
  .association-flux *::after {
    animation: none !important;
  }
}
</style>
