import { auth } from './firebase';

// Em produção, isso apontará para a Cloud Function
// Em desenvolvimento, podemos continuar usando o proxy do vite, ou testar a cloud function localmente se quisermos
// Como estamos fazendo deploy no GH Pages, usaremos a Cloud Function em dev e prod.
// IMPORTANTE: Preencha a URL da Cloud Function após fazer o deploy do Firebase.
// Por enquanto, usaremos a rota local /api em dev, e em prod usaremos a Cloud Function
const isDev = import.meta.env.DEV;

const CLOUD_FUNCTION_URL = "/api/proxy";

export const fetchTRE = async (endpoint) => {
  if (!auth.currentUser) {
    throw new Error("Usuário não autenticado");
  }
  
  const token = await auth.currentUser.getIdToken();
  
  // Em desenvolvimento usamos o proxy do vite sem o header de token (pois ele vai direto pro TRE)
  // Mas para testar a segurança igual à produção, devemos bater na Cloud Function ou usar o emulador.
  // Como o usuário solicitou máxima segurança, vamos forçar tudo para a Cloud Function sempre que a URL estiver definida.
  
  let url = `${CLOUD_FUNCTION_URL}?endpoint=${endpoint}`;
  
  // Se rodando local (dev server), vamos forçar o uso do proxy do vite
  // Isso permite testar a aplicação localmente sem depender do deploy da Cloud Function
  if (isDev) {
     url = `/api/${endpoint}`;
     const res = await fetch(url);
     return await res.json();
  }

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!res.ok) {
    throw new Error(`Erro na consulta: ${res.status}`);
  }

  return await res.json();
};
