'use client';

import { Target } from 'lucide-react';
import Image from 'next/image';
import { Button } from '../shared/Button';
import {
  ALLMAPS_W37_MAP_ID,
  ANCHOR_XY,
  ICON_CENTROID,
  ICON_POLYGON_POINTS,
  MAP_CROP_VIEWBOX,
  OVERLAY_VISIBILITY,
  type OverlayKey,
  PLACE_COORDINATES,
  type StepId,
  TEXT_CENTROID,
  TEXT_POLYGON_POINTS,
  W37_CROP_IMAGE_SRC,
} from './data';

interface MapCropProps {
  step: StepId;
  onPlaceAnchor: () => void;
}

function isVisible(step: StepId, key: OverlayKey): boolean {
  return OVERLAY_VISIBILITY[step].includes(key);
}

export function MapCrop({ step, onPlaceAnchor }: MapCropProps) {
  const showTextPoly = isVisible(step, 'textPolygon');
  const showIconPoly = isVisible(step, 'iconPolygon');
  const showLink = isVisible(step, 'linkLine');
  const showAnchor = isVisible(step, 'anchor');
  const showGeoref = isVisible(step, 'georefHint');
  const [lon, lat] = PLACE_COORDINATES;
  const dLon = 0.2;
  const dLat = 0.14;
  const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lon - dLon}%2C${lat - dLat}%2C${lon + dLon}%2C${lat + dLat}&layer=mapnik&marker=${lat}%2C${lon}`;

  return (
    <section
      aria-labelledby="map-crop-heading"
      className="relative rounded-2xl border border-primary/20 bg-[hsl(45_40%_94%)] p-2 shadow-sm overflow-visible md:p-3"
    >
      <h2 id="map-crop-heading" className="sr-only">
        Spatial anchor on W37
      </h2>
      <Button
        type="button"
        variant={showAnchor ? 'secondary' : 'default'}
        onClick={onPlaceAnchor}
        aria-pressed={showAnchor}
        aria-label={showAnchor ? 'Anchor placed' : 'Place spatial anchor'}
        title={showAnchor ? 'Anchor placed' : 'Place spatial anchor'}
        className="absolute right-5 top-5 z-30 h-11 w-11 rounded-full p-0 shadow-md"
      >
        <Target className="h-5 w-5" aria-hidden />
      </Button>

      <div className="relative mx-auto aspect-[13/7] w-full overflow-hidden rounded-xl border border-primary/15 bg-[hsl(45_40%_88%)]">
        <Image
          src={W37_CROP_IMAGE_SRC}
          alt="Detail of W37 around Ponnani, cropped from the IIIF image referenced by the real annotations."
          fill
          sizes="100vw"
          className="object-cover"
          priority={false}
          unoptimized
        />

        {/* Subtle parchment grain */}
        <div
          aria-hidden
          className="absolute inset-0 mix-blend-multiply opacity-30 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(hsla(45,30%,40%,0.18) 1px, transparent 1px)',
            backgroundSize: '6px 6px',
          }}
        />

        <svg
          viewBox={MAP_CROP_VIEWBOX}
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full pointer-events-none"
          aria-hidden
        >
          {showGeoref && (
            <g>
              <circle
                cx={ANCHOR_XY.x}
                cy={ANCHOR_XY.y}
                r={56}
                fill="none"
                stroke="hsla(197, 37%, 24%, 0.55)"
                strokeWidth={3}
                strokeDasharray="10 8"
              />
            </g>
          )}
          {showTextPoly && (
            <polygon
              points={TEXT_POLYGON_POINTS}
              fill="hsla(173, 58%, 39%, 0.18)"
              stroke="hsl(173, 58%, 39%)"
              strokeWidth={4}
              strokeDasharray="12 8"
            />
          )}
          {showIconPoly && (
            <polygon
              points={ICON_POLYGON_POINTS}
              fill="hsla(12, 70%, 55%, 0.18)"
              stroke="hsl(12, 70%, 50%)"
              strokeWidth={4}
              strokeDasharray="12 8"
            />
          )}
          {showLink && (
            <g>
              <circle
                cx={TEXT_CENTROID.x}
                cy={TEXT_CENTROID.y}
                r={17}
                fill="hsl(165, 22%, 26%)"
                stroke="white"
                strokeWidth={2}
              />
              <text
                x={TEXT_CENTROID.x}
                y={TEXT_CENTROID.y + 5}
                textAnchor="middle"
                fontSize="16"
                fontWeight="700"
                fill="white"
              >
                1
              </text>
              <circle
                cx={ICON_CENTROID.x}
                cy={ICON_CENTROID.y}
                r={17}
                fill="hsl(165, 22%, 26%)"
                stroke="white"
                strokeWidth={2}
              />
              <text
                x={ICON_CENTROID.x}
                y={ICON_CENTROID.y + 5}
                textAnchor="middle"
                fontSize="16"
                fontWeight="700"
                fill="white"
              >
                2
              </text>
            </g>
          )}
          {showAnchor && (
            <g>
              <defs>
                <clipPath id="anchorIconClip">
                  <circle cx={ANCHOR_XY.x} cy={ANCHOR_XY.y - 9} r={9} />
                </clipPath>
              </defs>
              <circle
                cx={ANCHOR_XY.x}
                cy={ANCHOR_XY.y - 9}
                r={14}
                fill="white"
                stroke="hsl(12, 70%, 50%)"
                strokeWidth={3}
              />
              <image
                href="/favicon.ico"
                x={ANCHOR_XY.x - 9}
                y={ANCHOR_XY.y - 18}
                width={18}
                height={18}
                preserveAspectRatio="xMidYMid slice"
                clipPath="url(#anchorIconClip)"
              />
              <path
                d={`M ${ANCHOR_XY.x} ${ANCHOR_XY.y + 14} L ${ANCHOR_XY.x - 7} ${ANCHOR_XY.y + 2} L ${ANCHOR_XY.x + 7} ${ANCHOR_XY.y + 2} Z`}
                fill="hsl(12, 70%, 50%)"
              />
              <circle
                cx={ANCHOR_XY.x}
                cy={ANCHOR_XY.y}
                r={4.5}
                fill="hsl(12, 70%, 50%)"
                stroke="white"
                strokeWidth={1.5}
              />
            </g>
          )}
        </svg>

        {showGeoref && (
          <div className="absolute left-3 top-3 z-20 w-[min(92%,440px)] rounded-lg border border-[hsl(var(--chart-3)/0.35)] bg-card/92 p-2 shadow-sm backdrop-blur-[1px]">
            <p className="text-[11px] font-medium text-[hsl(var(--chart-3))]">
              Current Georeferenced Context (Allmaps + OSM)
            </p>
            <p className="mt-0.5 text-[10px] text-foreground/80">
              Transparent historical snippet over a zoomed OSM view at Ponnani.
            </p>
            <div className="relative mt-2 h-40 overflow-hidden rounded-md border border-[hsl(var(--chart-3)/0.25)] bg-white">
              <iframe
                title="OpenStreetMap georeferenced context around Ponnani"
                src={osmEmbedUrl}
                className="h-full w-full"
                loading="lazy"
              />
              <Image
                src={W37_CROP_IMAGE_SRC}
                alt="Transparent historical map snippet"
                fill
                sizes="440px"
                className="object-cover pointer-events-none"
                style={{ opacity: 0.38, mixBlendMode: 'multiply' }}
                unoptimized
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px]">
              <span className="text-muted-foreground">
                Pair: ({ANCHOR_XY.x}, {ANCHOR_XY.y}) -&gt; (
                {PLACE_COORDINATES[0]}, {PLACE_COORDINATES[1]})
              </span>
              <a
                href={ALLMAPS_W37_MAP_ID}
                target="_blank"
                rel="noreferrer"
                className="text-[hsl(var(--chart-3))] underline underline-offset-2"
              >
                Open Allmaps map
              </a>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
