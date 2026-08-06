-- AlterTable
-- Separa "a busca falhou" de "foi assim que a busca rodou". Misturados num
-- campo só, toda busca abria com uma caixa de alerta amarela — inclusive as
-- que funcionaram perfeitamente, o que treina qualquer pessoa a ignorar
-- avisos. Agora o erro fica no topo e as notas vão para o rodapé.
ALTER TABLE "Busca" ADD COLUMN "notas" TEXT[];
