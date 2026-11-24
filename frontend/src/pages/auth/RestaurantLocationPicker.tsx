import { useRef, useState, type PointerEvent } from "react";
import { useLanguage } from "../../shared/i18n/LanguageProvider";

type Point = { lat: number; lon: number };
type Drag = { startX: number; startY: number; x: number; y: number; moved: boolean };
const TILE_SIZE = 256;
const INITIAL_CENTER: Point = { lat: 17.9757, lon: 102.6331 };

export default function RestaurantLocationPicker({ value, onChange }: { value: Point | null; onChange: (point: Point | null) => void }) {
  const { t } = useLanguage();
  const [center, setCenter] = useState(INITIAL_CENTER);
  const [zoom, setZoom] = useState(12);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<Drag | null>(null);
  const [locationError, setLocationError] = useState("");
  const centerPixel = project(center, zoom);
  const count = 2 ** zoom;
  const centerTileX = Math.floor(centerPixel.x / TILE_SIZE);
  const centerTileY = Math.floor(centerPixel.y / TILE_SIZE);
  const tileOffsetX = centerPixel.x % TILE_SIZE;
  const tileOffsetY = centerPixel.y % TILE_SIZE;
  const pinPixel = value ? project(value, zoom) : null;
  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startY: event.clientY, x: 0, y: 0, moved: false };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const active = drag.current;
    if (!active) return;
    active.x = event.clientX - active.startX;
    active.y = event.clientY - active.startY;
    if (Math.abs(active.x) + Math.abs(active.y) > 5) active.moved = true;
    setDragOffset({ x: active.x, y: active.y });
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const active = drag.current;
    if (!active) return;
    if (active.moved) {
      setCenter(unproject({ x: centerPixel.x - active.x, y: centerPixel.y - active.y }, zoom));
    } else {
      const bounds = event.currentTarget.getBoundingClientRect();
      onChange(unproject({
        x: centerPixel.x + event.clientX - bounds.left - bounds.width / 2,
        y: centerPixel.y + event.clientY - bounds.top - bounds.height / 2,
      }, zoom));
    }
    drag.current = null;
    setDragOffset({ x: 0, y: 0 });
  }

  function useCurrentLocation() {
    setLocationError("");
    if (!navigator.geolocation) {
      setLocationError(t("map.geo_unsupported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const point = { lat: coords.latitude, lon: coords.longitude };
      setCenter(point);
      setZoom(16);
      onChange(point);
    }, () => setLocationError(t("map.geo_denied")));
  }

  return <div className="space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-xs font-medium text-[#6e786f]">{t("map.instructions")}</span>
      <button type="button" onClick={useCurrentLocation} className="text-xs font-bold text-[#14543b] hover:underline">{t("map.use_current")}</button>
    </div>
    <div className="relative h-72 touch-none select-none overflow-hidden rounded-xl border border-[#d5c4aa] bg-[#e8eee8] sm:h-80" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      {Array.from({ length: 25 }, (_, index) => {
        const dx = index % 5 - 2;
        const dy = Math.floor(index / 5) - 2;
        const rawX = centerTileX + dx;
        const tileX = ((rawX % count) + count) % count;
        const tileY = centerTileY + dy;
        if (tileY < 0 || tileY >= count) return null;
        return <img key={`${zoom}-${rawX}-${tileY}`} draggable={false} alt="" src={`https://tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`} className="pointer-events-none absolute max-w-none" style={{ width: TILE_SIZE, height: TILE_SIZE, left: `calc(50% + ${dx * TILE_SIZE - tileOffsetX + dragOffset.x}px)`, top: `calc(50% + ${dy * TILE_SIZE - tileOffsetY + dragOffset.y}px)` }} />;
      })}
      {pinPixel && <div aria-label={t("map.pin_aria")} className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full text-3xl drop-shadow" style={{ left: `calc(50% + ${pinPixel.x - centerPixel.x + dragOffset.x}px)`, top: `calc(50% + ${pinPixel.y - centerPixel.y + dragOffset.y}px)` }}>📍</div>}
      <div className="absolute right-2 top-2 z-20 flex flex-col overflow-hidden rounded-lg border border-slate-300 bg-white shadow">
        <button type="button" aria-label={t("map.zoom_in")} onPointerDown={(event) => event.stopPropagation()} onClick={() => setZoom((current) => Math.min(18, current + 1))} className="h-9 w-9 text-xl font-bold text-slate-700 hover:bg-slate-100">+</button>
        <button type="button" aria-label={t("map.zoom_out")} onPointerDown={(event) => event.stopPropagation()} onClick={() => setZoom((current) => Math.max(3, current - 1))} className="h-9 w-9 border-t text-xl font-bold text-slate-700 hover:bg-slate-100">−</button>
      </div>
      <span className="pointer-events-none absolute bottom-1 left-1 z-10 rounded bg-white/85 px-1.5 py-0.5 text-[10px] text-slate-700">© OpenStreetMap contributors</span>
    </div>
    {locationError && <p role="status" className="text-xs text-rose-700">{locationError}</p>}
    {value ? <p className="text-xs font-medium text-[#315842]">{t("map.selected_coordinates", { lat: value.lat.toFixed(6), lon: value.lon.toFixed(6) })} <button type="button" onClick={() => onChange(null)} className="ml-2 text-rose-700 underline">{t("map.remove_pin")}</button></p> : <p className="text-xs text-[#6e786f]">{t("map.no_location")}</p>}
  </div>;
}

function project({ lat, lon }: Point, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom;
  const boundedLat = Math.max(-85.0511, Math.min(85.0511, lat));
  const sin = Math.sin(boundedLat * Math.PI / 180);
  return { x: (lon + 180) / 360 * scale, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale };
}

function unproject({ x, y }: { x: number; y: number }, zoom: number): Point {
  const scale = TILE_SIZE * 2 ** zoom;
  const lon = x / scale * 360 - 180;
  const n = Math.PI - 2 * Math.PI * y / scale;
  return { lat: 180 / Math.PI * Math.atan(Math.sinh(n)), lon };
}
