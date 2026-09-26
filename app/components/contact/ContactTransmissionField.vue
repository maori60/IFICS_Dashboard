<script setup lang="ts">
const channels = [
  {
    code: 'project',
    label: 'Projet IFICS',
    subtitle: 'Territoires et actions à impact',
    color: '#22e6a8',
    y: 92,
    icon: 'users',
  },
  {
    code: 'tech',
    label: 'KREATORTECH',
    subtitle: 'Solutions IT sur mesure',
    color: '#35bfff',
    y: 204,
    icon: 'laptop',
  },
  {
    code: 'partner',
    label: 'Partenariat',
    subtitle: 'Coopérations et financement',
    color: '#ffad42',
    y: 316,
    icon: 'link',
  },
]

const offsets = [-30, -24, -18, -12, -7, 0, 7, 12, 18, 24, 30]

/*
 * Point source commun : France.
 * Les cartes commencent à x=438 en CSS.
 * On prolonge volontairement le SVG jusqu'à 466 :
 * la fin du flux passe ainsi sous la carte et ne laisse aucun vide.
 */
const franceX = 274
const franceY = 142
const energyEndX = 466

function pathFor(y: number, offset = 0) {
  const startX = franceX
  const startY = franceY
  const endX = energyEndX
  const endY = y

  const normalized = offset / 30
  const amplitude = Math.abs(normalized)

  /*
   * Les filaments partent tous du même point et arrivent tous
   * au même point. Seuls leurs points de contrôle s'écartent :
   * cela produit un véritable champ autour du faisceau central.
   */
  const c1x = startX + 55
  const c2x = endX - 58

  const base1 = startY + (endY - startY) * .24
  const base2 = startY + (endY - startY) * .72

  const field1 = normalized * (48 + amplitude * 18)
  const field2 = -normalized * (38 + amplitude * 16)

  return [
    `M ${startX} ${startY}`,
    `C ${c1x} ${base1 + field1},`,
    `${c2x} ${base2 + field2},`,
    `${endX} ${endY}`,
  ].join(' ')
}
</script>

<template>
  <div
    class="contact-transmission"
    aria-label="Les trois pôles de contact IFICS"
  >
    <div class="contact-transmission__ambient" />

    <svg
      class="contact-transmission__network"
      viewBox="0 0 720 430"
      aria-hidden="true"
    >
      <defs>
        <filter
          id="contact-glow"
          x="-80%"
          y="-80%"
          width="260%"
          height="260%"
        >
          <feGaussianBlur
            stdDeviation="4"
            result="blur"
          />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <radialGradient id="contact-earth">
          <stop
            offset="0%"
            stop-color="#16d9b1"
            stop-opacity=".28"
          />
          <stop
            offset="55%"
            stop-color="#063e39"
            stop-opacity=".42"
          />
          <stop
            offset="100%"
            stop-color="#021916"
            stop-opacity=".96"
          />
        </radialGradient>
      </defs>

      <g class="contact-transmission__stars">
        <circle cx="90" cy="75" r="1.6" />
        <circle cx="150" cy="132" r="1" />
        <circle cx="206" cy="54" r="1.4" />
        <circle cx="335" cy="68" r="1.1" />
        <circle cx="392" cy="360" r="1.5" />
        <circle cx="260" cy="390" r="1" />
        <circle cx="108" cy="337" r="1.3" />
        <circle cx="352" cy="176" r=".9" />
      </g>

      <g
        v-for="channel in channels"
        :key="channel.code"
        class="contact-transmission__energy-channel"
      >
        <!-- Champ énergétique très diffus -->
        <path
          :d="pathFor(channel.y)"
          fill="none"
          :stroke="channel.color"
          stroke-opacity=".12"
          stroke-width="44"
          stroke-linecap="round"
          filter="url(#contact-glow)"
          class="contact-transmission__energy-aura"
        />

        <!-- Halo intermédiaire -->
        <path
          :d="pathFor(channel.y)"
          fill="none"
          :stroke="channel.color"
          stroke-opacity=".34"
          stroke-width="18"
          stroke-linecap="round"
          filter="url(#contact-glow)"
          class="contact-transmission__energy-halo"
        />

        <!-- Filaments du champ -->
        <path
          v-for="offset in offsets"
          :key="`${channel.code}-${offset}`"
          :d="pathFor(channel.y, offset)"
          fill="none"
          :stroke="channel.color"
          :stroke-opacity="offset === 0 ? .98 : .42"
          :stroke-width="offset === 0 ? 3 : 1.05"
          stroke-linecap="round"
          class="contact-transmission__filament"
          :style="{
            animationDelay: `${(-Math.abs(offset) * .09) - channels.indexOf(channel) * .18}s`,
          }"
        />

        <!-- Coeur blanc/énergétique -->
        <path
          :d="pathFor(channel.y)"
          fill="none"
          stroke="rgba(255,255,255,.82)"
          stroke-width=".85"
          stroke-linecap="round"
          class="contact-transmission__energy-core-line"
        />

        <!-- Particules circulantes -->
        <circle
          v-for="particle in 3"
          :key="`${channel.code}-particle-${particle}`"
          :r="particle === 1 ? 2.8 : 1.7"
          :fill="channel.color"
          filter="url(#contact-glow)"
          class="contact-transmission__particle"
        >
          <animateMotion
            :dur="`${2.25 + channels.indexOf(channel) * .22}s`"
            :begin="`${-(particle - 1) * .72}s`"
            repeatCount="indefinite"
            :path="pathFor(channel.y)"
          />
        </circle>

        <!-- Impact sur la carte -->
        <circle
          cx="466"
          :cy="channel.y"
          r="12"
          fill="none"
          :stroke="channel.color"
          stroke-width="1"
          class="contact-transmission__impact-ring"
        />

        <circle
          cx="466"
          :cy="channel.y"
          r="5.2"
          :fill="channel.color"
          filter="url(#contact-glow)"
          class="contact-transmission__impact-core"
        />
      </g>

      <!-- Noyau commun sur la France -->
      <circle
        cx="274"
        cy="142"
        r="15"
        fill="none"
        stroke="#8ffff0"
        stroke-width="1"
        class="contact-transmission__france-pulse"
      />
      <circle
        cx="258"
        cy="173"
        r="5"
        fill="#dffff8"
        filter="url(#contact-glow)"
        class="contact-transmission__france-core"
      />

      <g
        class="contact-transmission__globe"
        opacity="0"
      >
        <circle
          cx="224"
          cy="246"
          r="112"
          fill="url(#contact-earth)"
        />

        <ellipse
          cx="224"
          cy="246"
          rx="112"
          ry="43"
        />
        <ellipse
          cx="224"
          cy="246"
          rx="58"
          ry="112"
        />
        <ellipse
          cx="224"
          cy="246"
          rx="91"
          ry="112"
        />

        <path d="M112 246h224" />
        <path d="M126 199c58 23 138 23 196 0" />
        <path d="M126 293c58-23 138-23 196 0" />

        <path
          class="contact-transmission__continent"
          d="M175 171c17-10 39-17 55-9l11 14 17 2 8 13-10 17-22 4-8 19-18 3-13-15-17-7-13-19 10-22Zm65 79 20-12 22 10 12 19-13 13-3 26-18 21-13-14 3-21-14-18 4-24Z"
        />

        <circle
          cx="224"
          cy="246"
          r="121"
          class="contact-transmission__globe-ring"
        />
        <circle
          cx="224"
          cy="246"
          r="132"
          class="contact-transmission__globe-ring contact-transmission__globe-ring--outer"
        />
      </g>

    </svg>

    <div class="contact-transmission__generated-globe">
      <img
        src="/images/contact/contact-globe-clean.png"
        alt=""
        aria-hidden="true"
      >
    </div>


    <div
      v-for="channel in channels"
      :key="`card-${channel.code}`"
      class="contact-transmission__card"
      :class="`contact-transmission__card--${channel.code}`"
      :style="{
        '--channel-color': channel.color,
        top: `${channel.y - 42}px`,
      }"
    >
      <div class="contact-transmission__icon">
        <svg
          v-if="channel.icon === 'users'"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20v-2a6 6 0 0 1 12 0v2M17 11a3 3 0 1 0 0-6M16 15a5 5 0 0 1 5 5" />
        </svg>

        <svg
          v-else-if="channel.icon === 'laptop'"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <rect x="4" y="4" width="16" height="12" rx="1" />
          <path d="M2 20h20M8 20l1-4h6l1 4" />
        </svg>

        <svg
          v-else
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1" />
          <path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1" />
        </svg>
      </div>

      <div>
        <strong>{{ channel.label }}</strong>
        <span>{{ channel.subtitle }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>

.contact-transmission {
  position: relative;
  width: min(100%, 720px);
  height: 430px;
  isolation: isolate;
}

.contact-transmission__ambient {
  position: absolute;
  inset: 2% 3% 0 0;
  background:
    radial-gradient(circle at 31% 57%, rgba(26, 222, 179, .14), transparent 29%),
    radial-gradient(circle at 65% 33%, rgba(45, 191, 255, .06), transparent 28%);
  filter: blur(22px);
  pointer-events: none;
}

.contact-transmission__network {
  position: absolute;
  z-index: 3;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}


.contact-transmission__energy-aura {
  transform-origin: center;
  animation: contactEnergyBreath 2.8s ease-in-out infinite;
}

.contact-transmission__energy-halo {
  animation: contactEnergyBreath 2.1s ease-in-out infinite reverse;
}

.contact-transmission__filament {
  stroke-dasharray: 2 6 11 9;
  filter: url(#contact-glow);
  animation:
    contactFlow 1.15s linear infinite,
    contactFilamentPulse 2.2s ease-in-out infinite;
}

.contact-transmission__energy-core-line {
  stroke-dasharray: 16 5;
  animation: contactCoreFlow 1.15s linear infinite;
  filter: url(#contact-glow);
}

.contact-transmission__particle {
  opacity: .96;
}

.contact-transmission__impact-ring {
  transform-box: fill-box;
  transform-origin: center;
  animation: contactImpactRing 1.8s ease-out infinite;
  filter: url(#contact-glow);
}

.contact-transmission__impact-core {
  animation: contactImpactCore 1.25s ease-in-out infinite;
}

.contact-transmission__france-pulse {
  transform-box: fill-box;
  transform-origin: center;
  animation: contactFrancePulse 2s ease-out infinite;
  filter: url(#contact-glow);
}

.contact-transmission__france-core {
  filter: url(#contact-glow);
  animation: contactFranceCore .95s ease-in-out infinite;
}

.contact-transmission__stars {
  fill: #54f5d3;
  opacity: .72;
}

.contact-transmission__stars circle {
  animation: contactStar 3.6s ease-in-out infinite;
}

.contact-transmission__stars circle:nth-child(2n) {
  animation-delay: -1.4s;
}

.contact-transmission__stars circle:nth-child(3n) {
  animation-delay: -2.3s;
}

.contact-transmission__filament {
  stroke-dasharray: 3 8;
  animation: contactFlow 2.4s linear infinite;
}

.contact-transmission__globe > ellipse,
.contact-transmission__globe > path:not(.contact-transmission__continent) {
  fill: none;
  stroke: rgba(72, 239, 207, .20);
  stroke-width: .8;
}

.contact-transmission__continent {
  fill: rgba(57, 236, 202, .20);
  stroke: rgba(86, 255, 224, .66);
  stroke-width: 1.2;
  filter: url(#contact-glow);
}

.contact-transmission__globe-ring {
  fill: none;
  stroke: rgba(42, 240, 202, .42);
  stroke-width: 1;
  stroke-dasharray: 3 7;
  transform-origin: 224px 246px;
  animation: contactOrbit 18s linear infinite;
}

.contact-transmission__globe-ring--outer {
  opacity: .35;
  animation-direction: reverse;
  animation-duration: 25s;
}

.contact-transmission__orbit {
  fill: none;
  stroke: rgba(56, 236, 204, .28);
  stroke-width: 1;
  stroke-dasharray: 3 8;
}

.contact-transmission__orbit circle {
  fill: #5affda;
  filter: url(#contact-glow);
}

.contact-transmission__generated-globe {
  position: absolute;
  z-index: 2;
  left: -7px;
  top: 26px;
  width: 465px;
  height: 378px;
  overflow: hidden;
  pointer-events: none;
}

.contact-transmission__generated-globe img {
  display: block;
  width: 700px;
  height: 378px;
  max-width: none;
  object-fit: cover;
  object-position: left center;
  mix-blend-mode: screen;
}

.contact-transmission__core {
  position: absolute;
  z-index: 4;
  left: 132px;
  top: 202px;
  width: 184px;
  height: 88px;
  display: grid;
  place-items: center;
  pointer-events: none;
}

.contact-transmission__core img {
  display: block;
  width: 116px;
  height: auto;
  filter: drop-shadow(0 0 12px rgba(32, 235, 194, .24));
}

.contact-transmission__card {
  --channel-color: #22e6a8;

  position: absolute;
  z-index: 5;
  left: 438px;
  width: 264px;
  min-height: 84px;
  display: grid;
  grid-template-columns: 52px 1fr;
  align-items: center;
  gap: 13px;
  padding: 13px 18px;
  border: 1px solid color-mix(in srgb, var(--channel-color) 68%, transparent);
  border-radius: 15px;
  background:
    linear-gradient(105deg, rgba(3, 28, 24, .95), rgba(3, 20, 18, .78));
  box-shadow:
    0 0 28px color-mix(in srgb, var(--channel-color) 10%, transparent),
    inset 0 0 20px rgba(255, 255, 255, .015);
  backdrop-filter: blur(14px);
}

.contact-transmission__card {
  animation: contactCardEnergy 2.4s ease-in-out infinite;
}

.contact-transmission__card--tech {
  animation-delay: -.8s;
}

.contact-transmission__card--partner {
  animation-delay: -1.6s;
}

.contact-transmission__card::before {
  content: "";
  position: absolute;
  left: -1px;
  top: 20%;
  bottom: 20%;
  width: 2px;
  background: var(--channel-color);
  box-shadow: 0 0 13px var(--channel-color);
}

.contact-transmission__icon {
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  border: 1px solid var(--channel-color);
  border-radius: 50%;
  color: var(--channel-color);
  background: rgba(1, 17, 15, .58);
  box-shadow: 0 0 18px color-mix(in srgb, var(--channel-color) 10%, transparent);
}

.contact-transmission__icon svg {
  width: 23px;
  height: 23px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.contact-transmission__card strong,
.contact-transmission__card span {
  display: block;
}

.contact-transmission__card strong {
  color: #f6f9f7;
  font-family: Montserrat, sans-serif;
  font-size: 15px;
  font-weight: 700;
}

.contact-transmission__card span {
  margin-top: 5px;
  color: rgba(221, 236, 231, .62);
  font-size: 11px;
  line-height: 1.35;
}

@keyframes contactFlow {
  to {
    stroke-dashoffset: -22;
  }
}

@keyframes contactOrbit {
  to {
    transform: rotate(360deg);
  }
}

@keyframes contactStar {
  0%,
  100% {
    opacity: .2;
  }

  50% {
    opacity: 1;
  }
}

@media (max-width: 620px) {
  .contact-transmission {
    left: 50%;
    width: 720px;
    max-width: none;
    transform: translateX(-50%) scale(.68);
    transform-origin: top center;
    margin-bottom: -138px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .contact-transmission *,
  .contact-transmission *::before,
  .contact-transmission *::after {
    animation: none !important;
  }
}

@keyframes contactEnergyBreath {
  0%, 100% {
    opacity: .56;
  }
  50% {
    opacity: 1;
  }
}

@keyframes contactFilamentPulse {
  0%, 100% {
    opacity: .34;
  }
  50% {
    opacity: .92;
  }
}

@keyframes contactCoreFlow {
  to {
    stroke-dashoffset: -42;
  }
}

@keyframes contactImpactRing {
  0% {
    opacity: .95;
    transform: scale(.45);
  }
  100% {
    opacity: 0;
    transform: scale(1.9);
  }
}

@keyframes contactImpactCore {
  0%, 100% {
    opacity: .72;
  }
  50% {
    opacity: 1;
  }
}

@keyframes contactFrancePulse {
  0% {
    opacity: .9;
    transform: scale(.45);
  }
  100% {
    opacity: 0;
    transform: scale(2.1);
  }
}

@keyframes contactFranceCore {
  0%, 100% {
    opacity: .75;
  }
  50% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .contact-transmission__energy-aura,
  .contact-transmission__energy-halo,
  .contact-transmission__filament,
  .contact-transmission__energy-core-line,
  .contact-transmission__impact-ring,
  .contact-transmission__impact-core,
  .contact-transmission__france-pulse,
  .contact-transmission__france-core {
    animation: none !important;
  }
}


@keyframes contactCardEnergy {
  0%, 100% {
    box-shadow:
      0 0 28px color-mix(in srgb, var(--channel-color) 10%, transparent),
      inset 0 0 20px rgba(255, 255, 255, .015);
  }

  50% {
    box-shadow:
      0 0 38px color-mix(in srgb, var(--channel-color) 18%, transparent),
      inset 0 0 24px color-mix(in srgb, var(--channel-color) 5%, transparent);
  }
}

</style>
