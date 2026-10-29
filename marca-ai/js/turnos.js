// Motoboy por turno: a loja reserva um motoboy por algumas horas, no horário de pico.
//
// Interface (tudo devolve Promise<{ ok: true, ... } | { ok: false, motivo, texto? }>):
//   reservar(dados)       empresa abre o turno (dia, início, fim, valor por hora)
//   aceitar(id, perfil)   motoboy pega o turno (só um; não pode pegar dois que se cruzam)
//   cancelar(id)          empresa desmarca: antes do aceite sai de graça; depois, paga 1 hora ao motoboy
//   concluir(id)          qualquer um dos dois fecha o turno depois do horário: o motoboy recebe o valor inteiro
//
// Porta do armazém: listaTurnos() → turnos conhecidos; criarTurno(t) → id; aplicarTurno(id, mudanca) → grava ou lança { motivo }.
import { conferirTurno, r2 } from './regras.js';

const PODE = { aberto: ['aceito', 'cancelado'], aceito: ['concluido', 'cancelado'], concluido: [], cancelado: [] };
export const podeTurno = (de, para) => Object.hasOwn(PODE, de) && PODE[de].includes(para);

export function criarTurnos(armazem, { agora = Date.now } = {}) {
  const ler = id => armazem.listaTurnos().find(t => t.id === id) || null;
  const falha = (motivo, extra = {}) => ({ ok: false, motivo, ...extra });
  async function gravar(id, m, extra = {}) {
    try { await armazem.aplicarTurno(id, m); return { ok: true, ...extra }; }
    catch (e) { return falha(e?.motivo === 'recusado' ? 'recusado' : 'sem-conexao'); }
  }
  return {
    async reservar(d) {
      const t = { empresa: d.empresa, coleta: d.coleta, tel: d.tel || '', lojaGeo: d.lojaGeo || null, obs: d.obs || '',
        inicio: d.inicio, fim: d.fim, valorHora: r2(+d.valorHora), status: 'aberto', criadoEm: agora(), teste: !!d.teste };
      if (!t.empresa || !t.coleta) return falha('invalido', { texto: 'Preencha os dados da empresa antes.' });
      const problema = conferirTurno(t, agora());
      if (problema) return falha('invalido', { texto: problema });
      try { return { ok: true, id: await armazem.criarTurno(t) }; }
      catch (e) { return falha(e?.motivo === 'recusado' ? 'recusado' : 'sem-conexao'); }
    },
    async aceitar(id, perfil) {
      const t = ler(id);
      if (!t || t.status !== 'aberto' || t.fim <= agora()) return falha('indisponivel');
      // Não dá pra estar em dois turnos ao mesmo tempo.
      const cruza = armazem.listaTurnos().some(o => o.id !== id && o.motoboy && o.status === 'aceito' && o.inicio < t.fim && t.inicio < o.fim);
      if (cruza) return falha('ocupado');
      const r = await gravar(id, { status: 'aceito', motoboy: perfil.nome, moto: perfil.moto || '', placa: perfil.placa || '', aceitoEm: agora() });
      return r.ok || r.motivo !== 'recusado' ? r : falha('indisponivel');
    },
    async cancelar(id) {
      const t = ler(id);
      if (!t || !podeTurno(t.status, 'cancelado') || (t.status === 'aceito' && t.fim <= agora())) return falha('indisponivel');
      const compensacao = t.status === 'aceito' ? t.valorHora : 0;
      return gravar(id, { status: 'cancelado', compensacao, canceladoEm: agora() }, { compensacao });
    },
    async concluir(id) {
      const t = ler(id);
      if (!t || t.status !== 'aceito' || t.fim > agora()) return falha('indisponivel');
      return gravar(id, { status: 'concluido', concluidoEm: agora() });
    }
  };
}
