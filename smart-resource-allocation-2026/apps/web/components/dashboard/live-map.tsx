"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { Card } from "@/components/ui/card";

const pointsGeoJson = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", properties: { weight: 0.9 }, geometry: { type: "Point", coordinates: [77.209, 28.6139] } },
    { type: "Feature", properties: { weight: 0.6 }, geometry: { type: "Point", coordinates: [77.1025, 28.7041] } },
    { type: "Feature", properties: { weight: 0.4 }, geometry: { type: "Point", coordinates: [72.8777, 19.076] } },
  ],
};

export function LiveMap() {
  const mapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
    const style = key
      ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${key}`
      : "https://demotiles.maplibre.org/style.json";

    const map = new maplibregl.Map({
      container: mapRef.current,
      style,
      center: [77.2, 28.6],
      zoom: 4.4,
    });

    map.on("load", () => {
      map.addSource("needs", { type: "geojson", data: pointsGeoJson as any });
      map.addLayer({
        id: "heat",
        type: "heatmap",
        source: "needs",
        paint: {
          "heatmap-weight": ["get", "weight"],
          "heatmap-intensity": 1,
          "heatmap-radius": 35,
          "heatmap-opacity": 0.72,
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,
            "rgba(14,165,233,0)",
            0.3,
            "#38bdf8",
            0.6,
            "#f59e0b",
            1,
            "#ef4444"
          ]
        }
      });
    });

    return () => map.remove();
  }, []);

  return (
    <Card className="h-[360px] overflow-hidden p-2 md:h-full">
      <div ref={mapRef} className="h-full w-full rounded-xl" />
    </Card>
  );
}
