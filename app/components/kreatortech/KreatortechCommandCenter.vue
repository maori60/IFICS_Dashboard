<script setup lang="ts">
const services = [
  {
    code: '01',
    key: 'workplace',
    title: 'Workplace',
    subtitle: 'Environnements de travail',
    x: 3,
    y: 10,
  },
  {
    code: '02',
    key: 'itsm',
    title: 'ITSM',
    subtitle: 'Support et services',
    x: 5,
    y: 38,
  },
  {
    code: '03',
    key: 'infrastructure',
    title: 'Infrastructure',
    subtitle: 'Réseaux, serveurs et sécurité',
    x: 2,
    y: 68,
  },
  {
    code: '04',
    key: 'automation',
    title: 'Automation',
    subtitle: 'Processus et intégration',
    x: 75,
    y: 10,
  },
  {
    code: '05',
    key: 'development',
    title: 'Développement',
    subtitle: 'Applications sur mesure',
    x: 77,
    y: 40,
  },
  {
    code: '06',
    key: 'training',
    title: 'Conseil & formation',
    subtitle: 'Accompagnement des équipes',
    x: 75,
    y: 70,
  },
]
</script>

<template>
  <div class="kt-world">
    <div class="kt-world__grid" aria-hidden="true" />
    <div class="kt-world__halo" aria-hidden="true" />

    <div class="kt-world__globe" aria-hidden="true">
      <img
        src="/images/kreatortech/kreatortech-globe.png"
        alt=""
      >
    </div>

    <svg
      class="kt-world__network"
      viewBox="0 0 1000 520"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <filter id="ktWorldGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <linearGradient id="ktWorldGreen" x1="1" x2="0">
          <stop offset="0" stop-color="#68f1c2" />
          <stop offset=".5" stop-color="#27d99d" />
          <stop offset="1" stop-color="#27d99d" stop-opacity=".12" />
        </linearGradient>

        <linearGradient id="ktWorldBlue" x1="1" x2="0">
          <stop offset="0" stop-color="#56d5ff" />
          <stop offset=".5" stop-color="#25aef0" />
          <stop offset="1" stop-color="#25aef0" stop-opacity=".12" />
        </linearGradient>

        <linearGradient id="ktWorldAmber" x1="1" x2="0">
          <stop offset="0" stop-color="#ffd36d" />
          <stop offset=".5" stop-color="#ffae42" />
          <stop offset="1" stop-color="#ffae42" stop-opacity=".12" />
        </linearGradient>

        <path
          id="ktPath1"
          d="M510 205 C420 160 335 120 205 105"
        />
        <path
          id="ktPath2"
          d="M510 205 C410 205 315 240 220 250"
        />
        <path
          id="ktPath3"
          d="M510 205 C405 270 310 350 195 405"
        />

        <path
          id="ktPath4"
          d="M510 205 C610 150 700 115 790 105"
        />
        <path
          id="ktPath5"
          d="M510 205 C620 205 720 240 805 250"
        />
        <path
          id="ktPath6"
          d="M510 205 C620 275 705 355 790 405"
        />
      </defs>

      <g class="kt-world__orbits">
        <ellipse cx="510" cy="238" rx="250" ry="185" />
        <ellipse
          cx="510"
          cy="238"
          rx="290"
          ry="135"
          transform="rotate(-17 510 238)"
        />
        <ellipse
          cx="510"
          cy="238"
          rx="292"
          ry="132"
          transform="rotate(19 510 238)"
        />
      </g>

      <g class="kt-world__flows">
        <use href="#ktPath1" class="kt-world__flow flow-green" />
        <use href="#ktPath2" class="kt-world__flow flow-amber" />
        <use href="#ktPath3" class="kt-world__flow flow-green" />

        <use href="#ktPath4" class="kt-world__flow flow-green" />
        <use href="#ktPath5" class="kt-world__flow flow-blue" />
        <use href="#ktPath6" class="kt-world__flow flow-amber" />
      </g>

      <g class="kt-world__particles">
        <circle r="3.2" class="particle-green">
          <animateMotion dur="3.9s" repeatCount="indefinite">
            <mpath href="#ktPath1" />
          </animateMotion>
        </circle>

        <circle r="3.2" class="particle-amber">
          <animateMotion dur="4.7s" begin="-2s" repeatCount="indefinite">
            <mpath href="#ktPath2" />
          </animateMotion>
        </circle>

        <circle r="3.2" class="particle-green">
          <animateMotion dur="5.2s" begin="-1.4s" repeatCount="indefinite">
            <mpath href="#ktPath3" />
          </animateMotion>
        </circle>

        <circle r="3.2" class="particle-green">
          <animateMotion dur="4.2s" begin="-1s" repeatCount="indefinite">
            <mpath href="#ktPath4" />
          </animateMotion>
        </circle>

        <circle r="3.2" class="particle-blue">
          <animateMotion dur="4.8s" begin="-2.6s" repeatCount="indefinite">
            <mpath href="#ktPath5" />
          </animateMotion>
        </circle>

        <circle r="3.2" class="particle-amber">
          <animateMotion dur="5.4s" begin="-3.1s" repeatCount="indefinite">
            <mpath href="#ktPath6" />
          </animateMotion>
        </circle>
      </g>

      <g class="kt-world__france">
        <circle cx="510" cy="205" r="19" class="france-pulse" />
        <circle cx="510" cy="205" r="7" class="france-core" />
        <circle cx="510" cy="205" r="2.5" class="france-dot" />
      </g>
    </svg>

    <div
      v-for="service in services"
      :key="service.code"
      class="kt-world__service"
      :class="`is-${service.key}`"
      :style="{
        left: `${service.x}%`,
        top: `${service.y}%`,
      }"
    >
      <div class="kt-world__service-icon" aria-hidden="true">
        <svg
          v-if="service.key === 'workplace'"
          viewBox="0 0 24 24"
        >
          <rect x="3" y="4" width="18" height="13" rx="1.5" />
          <path d="M8 21h8M12 17v4" />
        </svg>

        <svg
          v-else-if="service.key === 'itsm'"
          viewBox="0 0 24 24"
        >
          <path d="M4 13v-2a8 8 0 0 1 16 0v2" />
          <path d="M4 13v5h4v-6H5M20 13v5h-4v-6h3" />
          <path d="M16 20h-4" />
        </svg>

        <svg
          v-else-if="service.key === 'infrastructure'"
          viewBox="0 0 24 24"
        >
          <rect x="3" y="3" width="18" height="5" rx="1" />
          <rect x="3" y="10" width="18" height="5" rx="1" />
          <rect x="3" y="17" width="18" height="4" rx="1" />
          <path d="M7 5.5h.01M7 12.5h.01M7 19h.01" />
        </svg>

        <svg
          v-else-if="service.key === 'automation'"
          viewBox="0 0 24 24"
        >
          <path d="M12 3l2 2.2 3-.3.8 2.9 2.6 1.5-1.1 2.8 1.1 2.8-2.6 1.5-.8 2.9-3-.3L12 21l-2-2.2-3 .3-.8-2.9-2.6-1.5 1.1-2.8-1.1-2.8 2.6-1.5.8-2.9 3 .3L12 3z" />
          <circle cx="12" cy="12" r="3" />
        </svg>

        <svg
          v-else-if="service.key === 'development'"
          viewBox="0 0 24 24"
        >
          <path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />
        </svg>

        <svg
          v-else
          viewBox="0 0 24 24"
        >
          <circle cx="9" cy="8" r="3" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M3 20v-2a6 6 0 0 1 12 0v2M14 15a5 5 0 0 1 7 4v1" />
        </svg>
      </div>

      <div class="kt-world__service-copy">
        <div>
          <strong>{{ service.title }}</strong>
          <span>{{ service.code }}</span>
        </div>

        <p>{{ service.subtitle }}</p>

        <div class="kt-world__signal" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>
    </div>

    <div class="kt-world__base" aria-hidden="true">
      <div class="kt-world__base-ring ring-a" />
      <div class="kt-world__base-ring ring-b" />
      <div class="kt-world__base-ring ring-c" />

      <div class="kt-world__base-core">
        <i />
        <div>
          <strong>KREATORTECH</strong>
          <span class="kt-world__base-live">
            <i />
            LIVE NETWORK
          </span>
        </div>
      </div>
    </div>

    <div class="kt-world__status status-health">
      <span>SERVICE HEALTH</span>
      <strong>99.8%</strong>
      <i><b /></i>
    </div>

    <div class="kt-world__status status-auto">
      <span>AUTOMATION</span>
      <strong>ACTIVE</strong>
      <small>14 workflows</small>
    </div>


  </div>
</template>

<style scoped>
.kt-world {
  position: relative;
  width: min(1120px, 100%);
  height: 570px;
  margin-inline: auto;
  overflow: hidden;
  isolation: isolate;
  border: 1px solid rgba(91, 211, 169, .12);
  border-radius: 16px;
  background:
    radial-gradient(circle at 50% 42%, rgba(14, 110, 78, .16), transparent 34%),
    linear-gradient(180deg, rgba(2, 11, 8, .97), rgba(2, 13, 9, .99));
  box-shadow:
    0 45px 110px rgba(0, 0, 0, .42),
    0 0 80px rgba(40, 184, 135, .045);
}

.kt-world__grid {
  position: absolute;
  z-index: 0;
  inset: 0;
  opacity: .26;
  background-image:
    linear-gradient(rgba(78, 172, 140, .09) 1px, transparent 1px),
    linear-gradient(90deg, rgba(78, 172, 140, .09) 1px, transparent 1px);
  background-size: 34px 34px;
  mask-image: radial-gradient(circle at 50% 47%, #000 18%, transparent 78%);
}

.kt-world__halo {
  position: absolute;
  z-index: 0;
  left: 50%;
  top: 42%;
  width: 580px;
  height: 470px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: rgba(41, 210, 155, .075);
  filter: blur(70px);
}

.kt-world__globe {
  position: absolute;
  z-index: 2;
  left: 50%;
  top: 43%;
  width: 480px;
  height: 480px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  filter:
    saturate(.93)
    contrast(1.05)
    drop-shadow(0 0 24px rgba(67, 222, 185, .18));
  animation: ktWorldFloat 8s ease-in-out infinite;
}

.kt-world__globe::after {
  content: "";
  position: absolute;
  inset: 7%;
  border-radius: 50%;
  box-shadow:
    inset -30px -18px 70px rgba(0, 0, 0, .38),
    inset 18px 0 45px rgba(56, 226, 184, .035);
  pointer-events: none;
}

.kt-world__globe img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  border-radius: 50%;
}

.kt-world__network {
  position: absolute;
  z-index: 5;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.kt-world__orbits ellipse {
  fill: none;
  stroke: rgba(74, 219, 174, .16);
  stroke-width: .8;
  stroke-dasharray: 3 7;
}

.kt-world__flow {
  fill: none;
  stroke-width: 1.45;
  stroke-linecap: round;
  filter: url(#ktWorldGlow);
  opacity: .84;
  stroke-dasharray: 5 7 17 9;
  animation: ktWorldFlow 1.7s linear infinite;
}

.kt-world__flow.flow-green { stroke: url(#ktWorldGreen); }
.kt-world__flow.flow-blue { stroke: url(#ktWorldBlue); }
.kt-world__flow.flow-amber { stroke: url(#ktWorldAmber); }

.particle-green {
  fill: #75f1c7;
  filter: url(#ktWorldGlow);
}

.particle-blue {
  fill: #65d9ff;
  filter: url(#ktWorldGlow);
}

.particle-amber {
  fill: #ffd16b;
  filter: url(#ktWorldGlow);
}

.france-pulse {
  fill: none;
  stroke: #8cf6d2;
  stroke-width: 1;
  transform-origin: 510px 205px;
  animation: ktWorldFrancePulse 2.2s ease-out infinite;
}

.france-core {
  fill: rgba(102, 245, 196, .16);
  stroke: #81f0ca;
  stroke-width: 1.2;
  filter: url(#ktWorldGlow);
}

.france-dot {
  fill: #e5fff6;
  filter: url(#ktWorldGlow);
}

.kt-world__service {
  position: absolute;
  z-index: 9;
  width: 220px;
  min-height: 88px;
  display: grid;
  grid-template-columns: 48px 1fr;
  gap: 12px;
  padding: 12px 13px;
  border: 1px solid rgba(107, 226, 185, .22);
  border-radius: 10px;
  background:
    linear-gradient(135deg, rgba(7, 40, 30, .94), rgba(3, 19, 14, .94));
  box-shadow:
    0 20px 48px rgba(0, 0, 0, .34),
    0 0 25px rgba(61, 205, 155, .035);
  backdrop-filter: blur(14px);
  transition:
    transform .3s ease,
    border-color .3s ease,
    box-shadow .3s ease;
}

.kt-world__service:hover {
  transform: translateY(-3px);
  border-color: rgba(107, 226, 185, .5);
  box-shadow:
    0 24px 55px rgba(0, 0, 0, .4),
    0 0 34px rgba(61, 205, 155, .10);
}

.kt-world__service-icon {
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(89, 218, 173, .22);
  border-radius: 9px;
  background: rgba(7, 38, 28, .7);
}

.kt-world__service-icon svg {
  width: 25px;
  height: 25px;
  fill: none;
  stroke: #5ce0b2;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.kt-world__service-copy {
  min-width: 0;
}

.kt-world__service-copy > div:first-child {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.kt-world__service-copy strong {
  color: #ecf9f4;
  font-size: .72rem;
  font-weight: 690;
}

.kt-world__service-copy span {
  color: #4c8f78;
  font-size: .47rem;
  font-weight: 750;
  letter-spacing: .1em;
}

.kt-world__service-copy p {
  margin: 6px 0 0;
  color: #769086;
  font-size: .56rem;
  line-height: 1.35;
}

.kt-world__signal {
  height: 13px;
  display: flex;
  align-items: flex-end;
  gap: 3px;
  margin-top: 6px;
}

.kt-world__signal i {
  width: 4px;
  display: block;
  border-radius: 1px;
  background: #3ac793;
  animation: ktWorldSignal 2s ease-in-out infinite alternate;
}

.kt-world__signal i:nth-child(1) { height: 4px; }
.kt-world__signal i:nth-child(2) { height: 7px; animation-delay: -.3s; }
.kt-world__signal i:nth-child(3) { height: 10px; animation-delay: -.6s; }
.kt-world__signal i:nth-child(4) { height: 6px; animation-delay: -.9s; }
.kt-world__signal i:nth-child(5) { height: 12px; animation-delay: -1.2s; }

.kt-world__base {
  position: absolute;
  z-index: 7;
  left: 50%;
  bottom: -40px;
  width: 390px;
  height: 125px;
  transform: translateX(-50%);
  perspective: 500px;
}

.kt-world__base-ring {
  position: absolute;
  left: 50%;
  top: 50%;
  border: 1px solid rgba(91, 225, 179, .24);
  border-radius: 50%;
  transform: translate(-50%, -50%) rotateX(68deg);
  box-shadow: 0 0 18px rgba(69, 215, 164, .08);
}

.kt-world__base-ring.ring-a {
  width: 100%;
  height: 100%;
}

.kt-world__base-ring.ring-b {
  width: 76%;
  height: 76%;
}

.kt-world__base-ring.ring-c {
  width: 51%;
  height: 51%;
}

.kt-world__base-core {
  position: absolute;
  left: 50%;
  top: 9px;
  min-width: 170px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 9px 15px;
  transform: translateX(-50%);
  border: 1px solid rgba(93, 229, 182, .28);
  border-radius: 8px;
  background:
    radial-gradient(circle at 50% 0%, rgba(77, 219, 169, .12), transparent 75%),
    rgba(3, 21, 15, .96);
  box-shadow:
    0 12px 35px rgba(0, 0, 0, .45),
    0 0 24px rgba(74, 220, 169, .08);
  backdrop-filter: blur(12px);
}

.kt-world__base-core > i {
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #67e4b8;
  box-shadow:
    0 0 6px #67e4b8,
    0 0 16px rgba(103, 228, 184, .65);
  animation: ktWorldCoreLight 1.8s ease-in-out infinite;
}

.kt-world__base-core div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.kt-world__base-core strong {
  color: #dff8ef;
  font-size: .57rem;
  font-weight: 720;
  letter-spacing: .13em;
}

.kt-world__base-core span {
  color: #568273;
  font-size: .39rem;
  font-weight: 700;
  letter-spacing: .18em;
}

.kt-world__base-live {
  display: flex !important;
  flex-direction: row !important;
  align-items: center;
  gap: 6px !important;
}

.kt-world__base-live > i {
  width: 4px;
  height: 4px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #67e4b8;
  box-shadow: 0 0 8px rgba(103, 228, 184, .8);
}

@keyframes ktWorldCoreLight {
  50% {
    opacity: .45;
    box-shadow:
      0 0 3px #67e4b8,
      0 0 8px rgba(103, 228, 184, .35);
  }
}

.kt-world__status {
  position: absolute;
  z-index: 10;
  padding: 10px 11px;
  border: 1px solid rgba(113, 217, 181, .15);
  border-radius: 8px;
  background: rgba(3, 20, 15, .88);
  backdrop-filter: blur(12px);
}

.kt-world__status > span {
  display: block;
  color: #557269;
  font-size: .43rem;
  font-weight: 750;
  letter-spacing: .12em;
}

.kt-world__status > strong {
  display: block;
  margin-top: 5px;
  color: #e4f5ef;
  font-size: .84rem;
  font-weight: 670;
}

.status-health {
  left: 26%;
  top: 7%;
  width: 120px;
}

.status-health > i {
  height: 2px;
  display: block;
  margin-top: 8px;
  overflow: hidden;
  background: #143228;
}

.status-health > i b {
  width: 88%;
  height: 100%;
  display: block;
  background: #57d7a9;
  animation: ktWorldHealth 4s ease-in-out infinite;
}

.status-auto {
  right: 25%;
  top: 6%;
  width: 126px;
}

.status-auto small {
  display: block;
  margin-top: 3px;
  color: #536c63;
  font-size: .46rem;
}

.status-live {
  left: 50%;
  bottom: 15px;
  display: flex;
  align-items: center;
  gap: 7px;
  transform: translateX(-50%);
  color: #607d72;
  font-size: .45rem;
  font-weight: 750;
  letter-spacing: .12em;
}

.status-live i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #60e1b4;
  box-shadow: 0 0 10px rgba(96, 225, 180, .8);
}

@keyframes ktWorldFlow {
  to { stroke-dashoffset: -38; }
}

@keyframes ktWorldFloat {
  0%, 100% { transform: translate(-50%, -50%) translateY(0); }
  50% { transform: translate(-50%, -50%) translateY(-7px); }
}

@keyframes ktWorldFrancePulse {
  0% {
    opacity: .9;
    transform: scale(.45);
  }

  100% {
    opacity: 0;
    transform: scale(2.3);
  }
}

@keyframes ktWorldSignal {
  to { transform: scaleY(.55); opacity: .55; }
}

@keyframes ktWorldHealth {
  0%, 100% { width: 84%; }
  50% { width: 98%; }
}

@media (max-width: 960px) {
  .kt-world {
    height: 530px;
  }

  .kt-world__globe {
    width: 420px;
    height: 420px;
  }

  .kt-world__service {
    width: 190px;
  }
}

@media (max-width: 640px) {
  .kt-world {
    left: 50%;
    width: 1000px;
    max-width: none;
    height: 570px;
    transform: translateX(-50%) scale(.52);
    transform-origin: top center;
    margin-bottom: -265px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .kt-world *,
  .kt-world *::before,
  .kt-world *::after {
    animation: none !important;
  }
}
</style>

<style scoped>
/* ============================================================
   KREATORTECH COMMAND CENTER — MOBILE NATIVE
   Desktop validé inchangé.
   ============================================================ */

@media (max-width: 640px) {
  .kt-world {
    left: auto;
    width: 100%;
    max-width: 100%;
    height: auto;
    min-height: 0;
    margin: 0;
    padding: 24px 14px 18px;
    overflow: hidden;
    transform: none;
    border-radius: 14px;
  }

  .kt-world__grid {
    opacity: .18;
  }

  .kt-world__halo {
    left: 50%;
    top: 185px;
    width: 340px;
    height: 300px;
  }

  /*
   * Sur mobile on conserve le globe comme élément central,
   * mais le réseau SVG desktop n'a plus à relier des cartes
   * positionnées hors écran.
   */
  .kt-world__network {
    display: none;
  }

  .kt-world__globe {
    position: relative;
    left: 50%;
    top: auto;
    width: min(82vw, 330px);
    height: min(82vw, 330px);
    margin: 24px 0 34px;
    transform: translateX(-50%);
    animation: ktWorldFloatMobile 8s ease-in-out infinite;
  }

  .kt-world__status {
    z-index: 11;
    top: 18px;
    width: auto;
    min-width: 104px;
    padding: 8px 9px;
  }

  .status-health {
    left: 14px;
  }

  .status-auto {
    right: 14px;
  }

  .kt-world__status > span {
    font-size: .38rem;
  }

  .kt-world__status > strong {
    font-size: .72rem;
  }

  .status-auto small {
    font-size: .4rem;
  }

  .kt-world__service,
  .kt-world__service.is-workplace,
  .kt-world__service.is-itsm,
  .kt-world__service.is-infrastructure,
  .kt-world__service.is-automation,
  .kt-world__service.is-development,
  .kt-world__service.is-training {
    position: relative;
    left: auto !important;
    top: auto !important;
    width: 100%;
    min-height: 104px;
    grid-template-columns: 38px minmax(0, 1fr);
    gap: 9px;
    padding: 11px 10px;
  }

  /*
   * Les six cartes deviennent une grille mobile réelle.
   * display: contents permet de réutiliser le DOM existant.
   */
  .kt-world {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .kt-world__grid,
  .kt-world__halo,
  .kt-world__network,
  .kt-world__globe,
  .kt-world__base,
  .kt-world__status {
    grid-column: 1 / -1;
  }

  .kt-world__globe {
    grid-row: 1;
  }

  .kt-world__service {
    grid-row: auto;
  }

  .kt-world__service-icon {
    width: 36px;
    height: 36px;
  }

  .kt-world__service-icon svg {
    width: 20px;
    height: 20px;
  }

  .kt-world__service-copy strong {
    font-size: .66rem;
    line-height: 1.15;
  }

  .kt-world__service-copy span {
    font-size: .42rem;
  }

  .kt-world__service-copy p {
    margin-top: 5px;
    font-size: .51rem;
    line-height: 1.35;
  }

  .kt-world__signal {
    margin-top: 7px;
  }

  .kt-world__base {
    position: relative;
    left: auto;
    bottom: auto;
    width: 100%;
    height: 72px;
    margin-top: 6px;
    transform: none;
  }

  .kt-world__base-core {
    top: 10px;
  }

  .kt-world__base-ring {
    opacity: .55;
  }
}

@keyframes ktWorldFloatMobile {
  0%, 100% {
    transform: translateX(-50%) translateY(0);
  }

  50% {
    transform: translateX(-50%) translateY(-5px);
  }
}

@media (max-width: 380px) {
  .kt-world {
    grid-template-columns: 1fr;
  }

  .kt-world__globe,
  .kt-world__base,
  .kt-world__status {
    grid-column: 1;
  }

  .kt-world__service {
    min-height: 88px;
  }
}
</style>

<style scoped>
/* KREATORTECH — MOBILE COMPACT + NETWORK ANIMATION */
@media (max-width: 640px) {
  .kt-world {
    padding: 18px 12px 16px;
    gap: 8px;
  }

  .kt-world__globe {
    width: min(66vw, 270px);
    height: min(66vw, 270px);
    margin: 42px 0 24px;
  }

  /*
   * Réseau animé visible uniquement autour du globe.
   * Les cartes restent dans leur grille mobile.
   */
  .kt-world__network {
    display: block;
    z-index: 5;
    top: 36px;
    left: 50%;
    width: min(96vw, 390px);
    height: 300px;
    transform: translateX(-50%);
    overflow: hidden;
  }

  .kt-world__orbits {
    opacity: .8;
  }

  .kt-world__flows {
    opacity: .9;
  }

  .kt-world__service,
  .kt-world__service.is-workplace,
  .kt-world__service.is-itsm,
  .kt-world__service.is-infrastructure,
  .kt-world__service.is-automation,
  .kt-world__service.is-development,
  .kt-world__service.is-training {
    min-height: 86px;
    padding: 9px;
    grid-template-columns: 34px minmax(0, 1fr);
    gap: 8px;
  }

  .kt-world__service-icon {
    width: 32px;
    height: 32px;
  }

  .kt-world__service-icon svg {
    width: 18px;
    height: 18px;
  }

  .kt-world__service-copy strong {
    font-size: .61rem;
  }

  .kt-world__service-copy p {
    margin-top: 4px;
    font-size: .46rem;
  }

  .kt-world__signal {
    height: 10px;
    margin-top: 4px;
  }

  .kt-world__signal i {
    width: 3px;
  }

  .kt-world__status {
    top: 12px;
    min-width: 92px;
    padding: 7px 8px;
  }

  .status-health {
    left: 10px;
  }

  .status-auto {
    right: 10px;
  }

  .kt-world__base {
    height: 62px;
    margin-top: 2px;
  }
}
</style>
