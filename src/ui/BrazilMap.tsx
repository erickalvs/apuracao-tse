import { useMemo, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { Result } from "../api";
import { percent } from "../format";
import { buildLeaderLegend } from "../mapColors";
import { ViewMode } from "./useUrlState";

type Props = {
  geo: GeoJSON.FeatureCollection;
  selectedUf?: string;
  mode: ViewMode;
  results: Map<string, Result>;
  nationalResult?: Result;
  onSelectUf: (uf: string) => void;
};

export function BrazilMap({ geo, selectedUf, mode, results, nationalResult, onSelectUf }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const orientedGeo = useMemo(() => reorientGeoJson(geo), [geo]);
  const projection = useMemo(() => geoMercator().fitExtent([[36, 28], [924, 732]], orientedGeo), [orientedGeo]);
  const path = useMemo(() => geoPath(projection), [projection]);
  const selectedFeature = useMemo(
    () => orientedGeo.features.find((feature: any) => feature.properties.uf === selectedUf),
    [orientedGeo, selectedUf]
  );
  const viewBox = useMemo(() => {
    if (!selectedFeature) return "0 0 960 760";
    const [[x0, y0], [x1, y1]] = path.bounds(selectedFeature);
    const width = x1 - x0;
    const height = y1 - y0;
    const padding = Math.max(width, height) * 0.18;
    return `${Math.max(0, x0 - padding)} ${Math.max(0, y0 - padding)} ${Math.min(960, width + padding * 2)} ${Math.min(760, height + padding * 2)}`;
  }, [path, selectedFeature]);
  const colorByCandidate = useMemo(() => {
    const names = new Map<string, string>();
    for (const item of buildLeaderLegend(results)) {
      names.set(item.key, item.color);
    }
    return names;
  }, [results]);

  return (
    <svg
      className={`brazil-map ${selectedUf ? "is-zoomed" : ""}`}
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Mapa do Brasil por unidades federativas"
    >
      <g>
        {orientedGeo.features.map((feature: any) => {
          const uf = feature.properties.uf as string;
          const name = feature.properties.name as string;
          const result = results.get(uf);
          const d = path(feature) ?? "";
          const centroid = path.centroid(feature);
          const active = selectedUf === uf;
          const fill = fillFor(result, mode, colorByCandidate, nationalResult);
          return (
            <g key={uf}>
              <path
                d={d}
                className={`state ${active ? "selected" : ""} ${selectedUf && !active ? "context" : ""}`}
                fill={fill}
                tabIndex={0}
                role="button"
                aria-label={`${name}, ${uf.toUpperCase()}. ${ariaSummary(result)}`}
                onClick={() => onSelectUf(uf)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") onSelectUf(uf);
                }}
                onMouseEnter={() => setHovered(uf)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(uf)}
                onBlur={() => setHovered(null)}
              />
              <text x={centroid[0]} y={centroid[1]} className="state-label" aria-hidden="true">
                {uf.toUpperCase()}
              </text>
            </g>
          );
        })}
      </g>
      <g className="tooltip-layer">
        {orientedGeo.features.map((feature: any) => {
          const uf = feature.properties.uf as string;
          if (hovered !== uf) return null;
          const name = feature.properties.name as string;
          const result = results.get(uf);
          const centroid = path.centroid(feature);
          return (
            <foreignObject key={uf} x={Math.min(centroid[0] + 12, 740)} y={Math.max(centroid[1] - 64, 12)} width="220" height="104" className="map-tooltip">
              <div>
                <strong>
                  {name} ({uf.toUpperCase()})
                </strong>
                <span>{ariaSummary(result)}</span>
              </div>
            </foreignObject>
          );
        })}
      </g>
    </svg>
  );
}

function reorientGeoJson(geo: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  return {
    ...geo,
    features: geo.features.map((feature) => ({
      ...feature,
      geometry: reorientGeometry(feature.geometry)
    }))
  };
}

function reorientGeometry(geometry: GeoJSON.Geometry): GeoJSON.Geometry {
  if (geometry.type === "Polygon") {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((ring) => [...ring].reverse())
    };
  }
  if (geometry.type === "MultiPolygon") {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((polygon) => polygon.map((ring) => [...ring].reverse()))
    };
  }
  return geometry;
}

function fillFor(result: Result | undefined, mode: ViewMode, candidateColors: Map<string, string>, nationalResult?: Result) {
  if (!result) return "#d8ded8";
  if (mode === "leader") {
    if (result.leading?.status === "tie") return "#7f8c8d";
    const leader = result.leading?.candidates[0];
    return leader ? candidateColors.get(leader.number) ?? "#64748b" : "#d8ded8";
  }
  if (mode === "official") {
    return result.leading?.status === "official" ? "#1f7a4d" : result.summary.countingStatus === "final" ? "#8c6d1f" : "#d8ded8";
  }
  if (mode === "candidate") {
    const target = nationalResult?.leading?.candidates[0]?.number;
    const candidate = result.candidates.find((item) => item.number === target);
    return scale(candidate?.percent ?? 0, 0, 60, ["#eef2f0", "#0f766e"]);
  }
  return scale(result.summary.sectionsPercent ?? 0, 0, 100, ["#eef2f0", "#265f4b"]);
}

function scale(value: number, min: number, max: number, colors: [string, string]) {
  const amount = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const a = hex(colors[0]);
  const b = hex(colors[1]);
  const mixed = a.map((channel, index) => Math.round(channel + (b[index] - channel) * amount));
  return `rgb(${mixed.join(",")})`;
}

function hex(color: string) {
  const clean = color.replace("#", "");
  return [0, 2, 4].map((index) => parseInt(clean.slice(index, index + 2), 16));
}

function ariaSummary(result?: Result) {
  if (!result) return "Resultado nao disponivel na fonte.";
  const leader = result.leading?.candidates.map((item) => item.ballotName).join(", ");
  const status = result.leading?.status === "tie" ? "empate" : result.leading?.status === "official" ? "situacao oficial publicada" : "lideranca parcial";
  return `${percent(result.summary.sectionsPercent)} das secoes totalizadas; ${leader ? `${status}: ${leader}` : "sem lideranca identificada"}.`;
}
