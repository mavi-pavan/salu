-- AlterEnum
-- Nova procedência de zona: consulta ao WFS oficial do GeoSampa, feita na hora
-- da busca. Separado da migration seguinte de propósito: em PostgreSQL antigo,
-- ADD VALUE não pode dividir transação com o uso do próprio valor.
ALTER TYPE "OrigemZona" ADD VALUE 'GEOSAMPA';
