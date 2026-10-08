// Adaptadores da porta "armazém de corridas" (ver corridas.js).
import { podeIr, novoId } from './regras.js';

const recusado = () => Object.assign(new Error('recusado'), { motivo: 'recusado' });

/**
 * Armazém no próprio aparelho (modo demonstração e chamados de teste).
 * Imita as regras do servidor, pra demonstração se comportar igual ao app real:
 * só aceita mudança de etapa válida e confere o código de entrega.
 * @param {{ S: () => object, transacao: (fn: (s: object) => (void|false)) => boolean }} loja
 */
export function armazemLocal({ S, transacao }) {
  return {
    lista: () => S().calls,
    async criar(c) {
      const id = novoId();
      transacao(s => { s.calls.push({ ...c, id }); });
      return id;
    },
    async aplicar(id, m) {
      const ok = transacao(s => {
        const c = s.calls.find(x => x.id === id);
        if (!c) return false;
        if (m.status && !podeIr(c.status, m.status)) return false;
        if (m.status === 'entregue' && m.codigoInformado !== c.codigo) return false;
        const { codigoInformado, ...resto } = m;
        Object.assign(c, resto);
      });
      if (!ok) throw recusado();
    },
    publicarPosicao(ponto) { transacao(s => { s.posicao = ponto; }); }
  };
}

/**
 * Junta os dois armazéns: chamado do servidor vai pro servidor; chamado de teste fica no aparelho.
 * Chamados novos vão pro servidor quando ele está ligado.
 */
export function armazemMisto(local, servidor, servidorLigado) {
  let publicouNoServidor = false;
  const destino = id => (local.lista().find(c => c.id === id)?.nuvem ? servidor : local);
  return {
    lista: local.lista,
    criar: c => (servidorLigado() && !c.teste ? servidor.criar(c) : local.criar(c)),
    aplicar: (id, m) => destino(id).aplicar(id, m),
    publicarPosicao(ponto, corrida) {
      local.publicarPosicao(ponto);
      if (corrida?.nuvem) { servidor.publicarPosicao(ponto, corrida); publicouNoServidor = true; }
      else if (publicouNoServidor) { servidor.esquecerPosicao(); publicouNoServidor = false; }
    }
  };
}
