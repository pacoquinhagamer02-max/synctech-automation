// Ciclo da corrida: o único lugar que sabe como um chamado anda de "aberto" até "entregue".
//
// Interface (tudo devolve Promise<{ ok: true, ... } | { ok: false, motivo, ... }>):
//   chamar(dados)            empresa cria o chamado (frete e código calculados aqui)
//   aceitar(id, perfil)      motoboy aceita
//   avancar(id, { codigo })  próxima etapa: chegou na loja → pegou o pedido → entregou (pede o código)
//   noGps(ponto, kmAndado)   cada leitura do GPS: soma km da corrida e registra a chegada na loja sozinho
//   cancelar(id)             empresa cancela (paga deslocamento se o motoboy já aceitou)
//   gorjeta(id, valor)       empresa dá gorjeta, uma vez
//   avaliar(id, nota, tags)  motoboy avalia a empresa (nota 0 = pulou)
//
// Motivos de falha: indisponivel | ocupado | invalido | codigo-errado | bloqueado | recusado | sem-conexao
//
// Quem guarda os dados é o "armazém" (adaptador): no aparelho (modo demonstração) ou no servidor.
// Porta do armazém: lista() → corridas conhecidas; criar(corrida) → id; aplicar(id, mudanca) → grava
// ou lança { motivo }; publicarPosicao(ponto, corrida|null).
import { TABELA, LIMITES, ATIVOS, RAIO_CHEGADA_M, podeIr, frete, taxaEspera, distanciaKm, novoCodigo, r2 } from './regras.js';

const GRAVAR_KM_A_CADA_MS = 60000;

/**
 * @param {{ lista: () => Array, criar: (c: object) => Promise<string>, aplicar: (id: string, m: object) => Promise<void>,
 *           publicarPosicao: (ponto: object, corrida: object|null) => void }} armazem
 * @param {{ agora?: () => number }} [opcoes] relógio injetável (testes)
 */
export function criarCorridas(armazem, { agora = Date.now } = {}) {
  const tentativas = new Map(); // id -> { n, ate }
  const km = new Map();         // id -> km medido pelo GPS nesta sessão
  const kmGravadoEm = new Map();

  const ler = id => armazem.lista().find(c => c.id === id) || null;
  const minhaAtiva = () => armazem.lista().find(c => c.motoboy && ATIVOS.includes(c.status)) || null;
  const kmDe = c => r2(Math.max(km.get(c.id) || 0, c.kmReal || 0));
  const falha = (motivo, extra = {}) => ({ ok: false, motivo, ...extra });

  async function gravar(id, mudanca, extraOk = {}) {
    try { await armazem.aplicar(id, mudanca); return { ok: true, ...extraOk }; }
    catch (e) { return falha(e?.motivo === 'recusado' ? 'recusado' : 'sem-conexao'); }
  }

  const api = {
    async chamar(d) {
      const km = r2(+d.km);
      if (!d.empresa || !d.coleta || !d.entrega || !(km >= LIMITES.kmMin && km <= LIMITES.kmMax)) return falha('invalido');
      const corrida = {
        empresa: d.empresa, coleta: d.coleta, tel: d.tel || '', entrega: d.entrega, cliente: d.cliente || '', telCliente: d.telCliente || '',
        km, obs: d.obs || '', chuva: !!d.chuva, valor: frete(km, !!d.chuva), taxa: d.taxa ?? TABELA.taxaPlataforma,
        codigo: novoCodigo(), status: 'aberto', criadoEm: agora(), lojaGeo: d.lojaGeo || null, clienteGeo: d.clienteGeo || null,
        preferidos: d.preferidos || [], preferidosUid: d.preferidosUid || [],
        prioridadeAte: (d.preferidos?.length || d.preferidosUid?.length) ? agora() + 30000 : null, teste: !!d.teste
      };
      try { return { ok: true, id: await armazem.criar(corrida) }; }
      catch (e) { return falha(e?.motivo === 'recusado' ? 'recusado' : 'sem-conexao'); }
    },

    async aceitar(id, perfil) {
      const c = ler(id);
      if (!c || !podeIr(c.status, 'aceito')) return falha('indisponivel');
      if (minhaAtiva()) return falha('ocupado');
      const r = await gravar(id, { status: 'aceito', motoboy: perfil.nome, moto: perfil.moto || '', placa: perfil.placa || '', aceitoEm: agora() });
      // Servidor recusou: outro motoboy chegou primeiro.
      return r.ok || r.motivo !== 'recusado' ? r : falha('indisponivel');
    },

    async avancar(id, { codigo = '', porGps = false } = {}) {
      const c = ler(id);
      if (!c) return falha('indisponivel');
      const t = agora();
      if (c.status === 'aceito') {
        return gravar(id, { status: 'coleta', chegouEm: t, chegadaGps: !!porGps, kmReal: kmDe(c) }, { etapa: 'coleta' });
      }
      if (c.status === 'coleta') {
        const espera = taxaEspera({ ...c, coletouEm: t });
        return gravar(id, { status: 'coletado', coletouEm: t, espera, kmReal: kmDe(c) }, { etapa: 'coletado', espera });
      }
      if (c.status === 'coletado') {
        const tt = tentativas.get(id) || { n: 0, ate: 0 };
        if (tt.ate > t) return falha('bloqueado');
        if (!/^\d{4}$/.test(String(codigo))) return falha('invalido');
        const r = await gravar(id, { status: 'entregue', entregueEm: t, codigoInformado: String(codigo), kmReal: kmDe(c) }, { etapa: 'entregue' });
        if (r.ok) { tentativas.delete(id); km.delete(id); return r; }
        if (r.motivo !== 'recusado') return r;
        tt.n += 1;
        if (tt.n >= LIMITES.tentativasCodigo) { tentativas.set(id, { n: 0, ate: t + LIMITES.bloqueioCodigoMs }); return falha('bloqueado'); }
        tentativas.set(id, tt);
        return falha('codigo-errado', { restam: LIMITES.tentativasCodigo - tt.n });
      }
      return falha('indisponivel');
    },

    async noGps(ponto, kmAndado = 0) {
      const c = minhaAtiva();
      armazem.publicarPosicao(ponto, c);
      if (!c) return { ok: true };
      const total = r2(kmDe(c) + kmAndado);
      km.set(c.id, total);
      // Chegada automática: dentro do raio da loja, a espera começa a contar (prova pro motoboy).
      if (c.status === 'aceito' && c.lojaGeo && distanciaKm(ponto, c.lojaGeo) * 1000 <= RAIO_CHEGADA_M) {
        const r = await api.avancar(c.id, { porGps: true });
        return r.ok ? { ok: true, chegouNa: c.empresa } : r;
      }
      if (kmAndado && agora() - (kmGravadoEm.get(c.id) || 0) > GRAVAR_KM_A_CADA_MS) {
        kmGravadoEm.set(c.id, agora());
        return gravar(c.id, { kmReal: total });
      }
      return { ok: true };
    },

    async cancelar(id) {
      const c = ler(id);
      if (!c || !podeIr(c.status, 'cancelado')) return falha('indisponivel');
      const compensacao = c.status === 'aberto' ? 0 : TABELA.deslocamentoCancelado;
      const r = await gravar(id, { status: 'cancelado', canceladoEm: agora(), compensacao }, { compensacao });
      return r.ok || r.motivo !== 'recusado' ? r : falha('indisponivel');
    },

    async gorjeta(id, valor) {
      const c = ler(id);
      if (!LIMITES.gorjetas.includes(valor)) return falha('invalido');
      if (!c || c.status !== 'entregue' || c.gorjeta) return falha('indisponivel');
      return gravar(id, { gorjeta: valor });
    },

    async avaliar(id, nota, tags = []) {
      const c = ler(id);
      if (!c || c.status !== 'entregue' || c.avaliado) return falha('indisponivel');
      const n = Math.round(+nota);
      if (!(n >= 0 && n <= 5)) return falha('invalido');
      return gravar(id, { avaliado: true, nota: n, tags: tags.slice(0, 6) });
    }
  };
  return api;
}
