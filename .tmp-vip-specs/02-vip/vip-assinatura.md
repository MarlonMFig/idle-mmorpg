# VIP — Assinatura Mensal

Modelo escolhido: **só assinatura recorrente**, sem nível permanente
por gasto acumulado. Tom de monetização definido como **F2P-friendly**
— a assinatura dá conveniência e progressão mais rápida, evita
concentrar poder que o F2P nunca alcança.

## Regra de escopo importante

**Gemas diárias NÃO são benefício VIP.** O login diário de gemas é um
sistema geral, disponível pra qualquer jogador (F2P ou assinante). Não
duplicar essa fonte dentro do pacote de assinatura.

## Benefícios da assinatura

| Benefício | Detalhe |
|---|---|
| +20% de EXP | Progressão de nível de conta mais rápida |
| +15% de taxa de loot | Ver seção "Alcance do bônus de loot" abaixo — **TBD** |
| Compra automática de poção | Sistema recompra Poção de Aceleração sozinho quando acaba, sem o jogador precisar voltar à loja |
| +1 Cristal de Refinamento/semana | Soma ao limite F2P de 2/semana → assinante tem 3/semana |
| Teto de ganho offline ampliado | Mais horas de acúmulo idle sem precisar abrir o jogo |
| Criação de Guild | Exclusivo assinante. Jogador free pode **entrar** em qualquer guild, mas não pode **fundar** uma |
| Moldura/ícone exclusivo | Cosmético, sem efeito em stats |

## Alcance do bônus de +15% loot — TBD

Não foi decidido se o bônus se aplica:

- **(Recomendado)** Só na chance de "não dropar nada" — reduz kills
  vazios, sem inflar a chance de Lendário/Mítico. Mantém o tom
  F2P-friendly, porque quem não assina ainda alcança qualquer raridade
  no mesmo ritmo esperado, só com mais kills vazios no caminho.
- Aplicado geral em todas as raridades, incluindo Lendário/Mítico —
  gera vantagem mecânica maior pro assinante, mais perto de
  "balanceado" do que "F2P-friendly".

Escolher antes de implementar o cálculo de drop rate.

## Guardrails de monetização (já validados na conversa)

- Nenhum item de loja vende personagem/fragmento **Lendário ou
  Mítico** diretamente — só Comum a Épico como conveniência.
- Nenhum benefício comprável garante resultado (drop, refinamento,
  etc.) — sempre probabilístico, pagamento dá tentativa extra, não
  garantia.
- Teste de sanidade F2P: qualquer coisa que só dá pra conseguir
  pagando (mesmo que "tecnicamente" possível de graça, mas
  absurdamente lento) quebra o tom F2P-friendly. Revisar todo novo
  benefício contra essa pergunta antes de adicionar.

## Fora de escopo deste pacote (fica pra depois)

- Preço da assinatura (R$/mês) — não definido
- Sistema de Guild completo (moeda, loja, árvore de passivas) — tem
  spec própria, não incluída neste pacote
- Loja geral de Gemas (pacotes, passe multiverso, ofertas) — não
  incluída neste pacote
