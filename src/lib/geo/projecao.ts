/**
 * Projeção geográfica (WGS84) → SIRGAS 2000 / UTM 23S, o EPSG:31983.
 *
 * Por que isto existe: 31983 é o CRS nativo de todas as camadas do GeoSampa.
 * Consultar o WFS nas coordenadas dele evita a armadilha clássica da ordem dos
 * eixos — em EPSG:4326, "x,y" significa lat,lon ou lon,lat dependendo de como
 * o código do CRS foi escrito na requisição, e quando erra o serviço não
 * reclama: devolve zero feição. Zero feição é indistinguível de "este ponto
 * não está em zona nenhuma", ou seja, o app confirmaria "não é ZEU" para a
 * cidade inteira sem nenhum sinal de erro. Em UTM não há ambiguidade: x é
 * sempre leste em metros, y é sempre norte em metros.
 *
 * SIRGAS 2000 usa o elipsoide GRS80 e o WGS84 usa um praticamente idêntico
 * (o achatamento difere na nona casa decimal). Para localizar um lote, a
 * diferença entre os dois é de centímetros — irrelevante aqui, onde a
 * incerteza da geocodificação já é de dezenas de metros.
 *
 * Fórmulas: série padrão de Transversa de Mercator (USGS Professional Paper
 * 1395, "Map Projections — A Working Manual", eqs. 8-5 a 8-9).
 */

/** Semieixo maior do GRS80, em metros. */
const A = 6_378_137;
/** Achatamento do GRS80. */
const F = 1 / 298.257222101;
/** Fator de escala no meridiano central, comum a todos os fusos UTM. */
const K0 = 0.9996;
/** Meridiano central do fuso 23. */
const LAMBDA0 = (-45 * Math.PI) / 180;
const FALSO_LESTE = 500_000;
/** Deslocamento aplicado no hemisfério sul para manter y positivo. */
const FALSO_NORTE = 10_000_000;

const E2 = F * (2 - F);
const EP2 = E2 / (1 - E2);

export interface PontoUtm {
  /** Leste, em metros. */
  x: number;
  /** Norte, em metros. */
  y: number;
}

/**
 * Retângulo que envolve o município de São Paulo, com uma folga pequena.
 *
 * Serve para não gastar requisição ao GeoSampa com coordenada que a
 * geocodificação jogou longe — anúncio de "Alphaville" ou "Jardim São Paulo"
 * cai em outra cidade com frequência.
 *
 * É um retângulo, não o contorno do município: vizinhos que se encaixam no
 * mapa (Guarulhos, Diadema, Taboão) continuam passando por aqui. Quem dá a
 * palavra final é o próprio GeoSampa, que devolve "nenhuma zona" para ponto
 * fora da cidade.
 */
export const LIMITES_SAO_PAULO = {
  latMin: -24.03,
  latMax: -23.34,
  lngMin: -46.85,
  lngMax: -46.34,
} as const;

export function dentroDeSaoPaulo(latitude: number, longitude: number): boolean {
  return (
    latitude >= LIMITES_SAO_PAULO.latMin &&
    latitude <= LIMITES_SAO_PAULO.latMax &&
    longitude >= LIMITES_SAO_PAULO.lngMin &&
    longitude <= LIMITES_SAO_PAULO.lngMax
  );
}

/** Converte grau decimal (lat, lng) para metros no EPSG:31983. */
export function paraUtm23S(latitude: number, longitude: number): PontoUtm {
  const fi = (latitude * Math.PI) / 180;
  const lambda = (longitude * Math.PI) / 180;

  const senFi = Math.sin(fi);
  const cosFi = Math.cos(fi);
  const tanFi = Math.tan(fi);

  const n = A / Math.sqrt(1 - E2 * senFi * senFi);
  const t = tanFi * tanFi;
  const c = EP2 * cosFi * cosFi;
  const a1 = (lambda - LAMBDA0) * cosFi;

  // Arco de meridiano do equador até a latitude do ponto.
  const m =
    A *
    ((1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256) * fi -
      ((3 * E2) / 8 + (3 * E2 ** 2) / 32 + (45 * E2 ** 3) / 1024) * Math.sin(2 * fi) +
      ((15 * E2 ** 2) / 256 + (45 * E2 ** 3) / 1024) * Math.sin(4 * fi) -
      ((35 * E2 ** 3) / 3072) * Math.sin(6 * fi));

  const x =
    K0 *
      n *
      (a1 +
        ((1 - t + c) * a1 ** 3) / 6 +
        ((5 - 18 * t + t * t + 72 * c - 58 * EP2) * a1 ** 5) / 120) +
    FALSO_LESTE;

  const y =
    K0 *
      (m +
        n *
          tanFi *
          ((a1 * a1) / 2 +
            ((5 - t + 9 * c + 4 * c * c) * a1 ** 4) / 24 +
            ((61 - 58 * t + t * t + 600 * c - 330 * EP2) * a1 ** 6) / 720)) +
    (latitude < 0 ? FALSO_NORTE : 0);

  return { x, y };
}
