// Configuração pública do Firebase (projeto marcaai-mariana).
// Esta chave NÃO é senha: ela só identifica o projeto. Quem protege os dados são
// as regras do servidor em firebase/firestore.rules.
// Liga o servidor pra todo mundo. Fica false até o login anônimo ser ativado no
// console do Firebase e o fluxo empresa ↔ motoboy ser testado entre dois aparelhos.
// Enquanto isso, dá pra testar o servidor abrindo o app com ?nuvem no endereço.
export const NUVEM_ATIVA = false;

export const FIREBASE = Object.freeze({
  apiKey: 'AIzaSyCIRVUqw0nxCrfuScwUXrvmCdkvkEeCnQU',
  authDomain: 'marcaai-mariana.firebaseapp.com',
  projectId: 'marcaai-mariana',
  storageBucket: 'marcaai-mariana.firebasestorage.app',
  messagingSenderId: '818495691986',
  appId: '1:818495691986:web:255dc1710d8406aed2610b'
});
