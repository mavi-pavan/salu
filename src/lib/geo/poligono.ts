/**
 * Geometria de polígono, sem dependência de sistema de coordenadas.
 *
 * As funções aqui trabalham em x/y genérico: servem tanto para o GeoJSON local
 * em graus (x = longitude, y = latitude) quanto para as feições do GeoSampa em
 * metros UTM. Quem chama é que decide em qual espaço está — e precisa manter
 * ponto e polígono no mesmo.
 */

export type Posicao = [number, number];
export type Anel = Posicao[];
/** Primeiro anel é o contorno externo; os demais são buracos. */
export type Poligono = Anel[];
export type Bbox = [number, number, number, number];

export interface GeometriaGeoJSON {
  type: string;
  coordinates: unknown;
}

/** Aceita Polygon e MultiPolygon; ignora ponto, linha e coleção. */
export function extrairPoligonos(geometria: GeometriaGeoJSON | null | undefined): Poligono[] {
  if (!geometria) return [];
  if (geometria.type === "Polygon") return [geometria.coordinates as Poligono];
  if (geometria.type === "MultiPolygon") return geometria.coordinates as Poligono[];
  return [];
}

export function calcularBbox(poligonos: Poligono[]): Bbox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const poligono of poligonos) {
    for (const anel of poligono) {
      for (const [x, y] of anel) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return [minX, minY, maxX, maxY];
}

export function dentroDaBbox(x: number, y: number, [minX, minY, maxX, maxY]: Bbox): boolean {
  return x >= minX && x <= maxX && y >= minY && y <= maxY;
}

/** Ray casting padrão: conta os cruzamentos à direita do ponto. */
export function pontoNoAnel(x: number, y: number, anel: Anel): boolean {
  let dentro = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
    const atual = anel[i];
    const anterior = anel[j];
    if (!atual || !anterior) continue;

    const [xi, yi] = atual;
    const [xj, yj] = anterior;
    const cruza = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

export function pontoNoPoligono(x: number, y: number, poligono: Poligono): boolean {
  const [contorno, ...buracos] = poligono;
  if (!contorno || !pontoNoAnel(x, y, contorno)) return false;
  return !buracos.some((buraco) => pontoNoAnel(x, y, buraco));
}

export function pontoEmAlgum(x: number, y: number, poligonos: Poligono[]): boolean {
  return poligonos.some((p) => pontoNoPoligono(x, y, p));
}
