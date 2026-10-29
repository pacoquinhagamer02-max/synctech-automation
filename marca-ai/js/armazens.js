// Adaptadores da porta "armazém de corridas" (ver corridas.js).
import { podeIr, novoId } from './regras.js';
import { podeTurno } from './turnos.js';

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
        // Cada entrega confere o código do cliente daquela parada, na ordem da rota.
        if ('entregues' in m) {
          const paradas = c.paradas?.length ? c.paradas : [c], i = c.entregues || 0;
          if (c.status !== 'coletado' || m.entregues !== i + 1 || m.entregues > paradas.length) return false;
          if (m.status === 'entregue' ? m.entregues !== paradas.length : m.entregues >= paradas.length) return false;
          if (m.codigoInformado !== paradas[i].codigo) return false;
          if (c.paradas?.[i]) c.paradas[i].entregueEm = m.paradaEm || m.entregueEm;
        } else if (m.status === 'entregue') return false;
        const { codigoInformado, paradaEm, ...resto } = m;
        Object.assign(c, resto);
      });
      if (!ok) throw recusado();
    },
    publicarPosicao(ponto) { transacao(s => { s.posicao = ponto; }); },
    listaTurnos: () => S().turnos || [],
    async criarTurno(t) {
      const id = novoId();
      transacao(s => { s.turnos = [...(s.turnos || []), { ...t, id }]; });
      return id;
    },
    async aplicarTurno(id, m) {
      const ok = transacao(s => {
        const t = (s.turnos || []).find(x => x.id === id);
        if (!t || (m.status && !podeTurno(t.status, m.status))) return false;
        Object.assign(t, m);
      });
      if (!ok) throw recusado();
    }
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
    listaTurnos: local.listaTurnos,
    criarTurno: t => (servidorLigado() && !t.teste ? servidor.criarTurno(t) : local.criarTurno(t)),
    aplicarTurno: (id, m) => (local.listaTurnos().find(t => t.id === id)?.nuvem ? servidor : local).aplicarTurno(id, m),
    publicarPosicao(ponto, corrida) {
      local.publicarPosicao(ponto);
      if (corrida?.nuvem) { servidor.publicarPosicao(ponto, corrida); publicouNoServidor = true; }
      else if (publicouNoServidor) { servidor.esquecerPosicao(); publicouNoServidor = false; }
    }
  };
}
