"use client";

import { useEffect, useMemo, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type OfferPoint = {
  task_id: string;
  summary: string;
  category: string;
  task_lat?: number | null;
  task_lng?: number | null;
  distance_km?: number | null;
  location_context: string;
};

type Props = {
  offers: OfferPoint[];
  currentLocation?: { lat: number; lng: number } | null;
};

const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: [
        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
    },
  ],
};

export function OffersMap({ offers, currentLocation }: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const validOffers = useMemo(
    () => offers.filter((offer) => typeof offer.task_lat === "number" && typeof offer.task_lng === "number"),
    [offers]
  );

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = new maplibregl.Map({
      container: mapRef.current,
      style: OSM_STYLE,
      center: currentLocation ? [currentLocation.lng, currentLocation.lat] : [77.209, 28.6139],
      zoom: currentLocation ? 11 : 4.5,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    mapInstanceRef.current = map;

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [currentLocation]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    if (currentLocation) {
      const currentDot = document.createElement("div");
      currentDot.style.width = "14px";
      currentDot.style.height = "14px";
      currentDot.style.borderRadius = "9999px";
      currentDot.style.background = "#0284c7";
      currentDot.style.border = "2px solid white";
      currentDot.style.boxShadow = "0 0 0 2px rgba(2,132,199,.35)";

      const marker = new maplibregl.Marker({ element: currentDot })
        .setLngLat([currentLocation.lng, currentLocation.lat])
        .setPopup(new maplibregl.Popup({ offset: 10 }).setHTML("<b>Your current location</b>"))
        .addTo(map);

      markersRef.current.push(marker);
    }

    validOffers.forEach((offer) => {
      const pin = document.createElement("div");
      pin.style.width = "16px";
      pin.style.height = "16px";
      pin.style.borderRadius = "9999px";
      pin.style.background = "#be123c";
      pin.style.border = "2px solid white";
      pin.style.boxShadow = "0 1px 4px rgba(0,0,0,.25)";

      const popupHtml = `
        <div style="min-width:180px">
          <div style="font-weight:700">${offer.summary}</div>
          <div style="font-size:12px;color:#475569;margin-top:2px">${offer.category}</div>
          <div style="font-size:12px;color:#334155;margin-top:4px">${offer.location_context}</div>
          <div style="font-size:12px;color:#0369a1;margin-top:4px">${typeof offer.distance_km === "number" ? `${offer.distance_km.toFixed(2)} km away` : "Distance unavailable"}</div>
        </div>
      `;

      const marker = new maplibregl.Marker({ element: pin })
        .setLngLat([offer.task_lng as number, offer.task_lat as number])
        .setPopup(new maplibregl.Popup({ offset: 10 }).setHTML(popupHtml))
        .addTo(map);

      markersRef.current.push(marker);
    });

    const bounds = new maplibregl.LngLatBounds();
    let hasBounds = false;

    if (currentLocation) {
      bounds.extend([currentLocation.lng, currentLocation.lat]);
      hasBounds = true;
    }
    validOffers.forEach((offer) => {
      bounds.extend([offer.task_lng as number, offer.task_lat as number]);
      hasBounds = true;
    });

    if (hasBounds) {
      map.fitBounds(bounds, { padding: 52, maxZoom: 13, duration: 350 });
    }
  }, [validOffers, currentLocation]);

  return <div ref={mapRef} className="h-[320px] w-full rounded-2xl border border-slate-200" />;
}
