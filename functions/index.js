const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch");
admin.initializeApp();

const allowedOrigins = [
  'https://tre-localizador.vercel.app', 
  'http://localhost:5173'
];

const corsHandler = require("cors")({ 
  origin: (origin, callback) => {
    // Permite as origens definidas ou requisições sem origin (como cURL, mas o token ainda bloqueará)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Acesso bloqueado pelo CORS. Origem não autorizada.'));
    }
  }
});

// Cache simples em memória para Rate Limiting (por instância da Cloud Function)
const rateLimitMap = new Map();
const RATE_LIMIT_MAX = 600; // Máximo de requisições por minuto por usuário (suficiente para o batch)
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minuto

exports.proxyTRE = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    // 1. Verifica se o usuário está autenticado
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(403).json({ error: "Acesso Negado: Token não fornecido." });
    }

    const idToken = authHeader.split("Bearer ")[1];
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (error) {
      console.error("Token verification failed:", error);
      return res.status(403).json({ error: "Acesso Negado: Token inválido ou expirado." });
    }

    // 2. Aplica Rate Limiting usando o UID do usuário
    const uid = decodedToken.uid;
    const now = Date.now();
    const userRateData = rateLimitMap.get(uid);

    if (!userRateData) {
      rateLimitMap.set(uid, { count: 1, startTime: now });
    } else {
      if (now - userRateData.startTime > RATE_LIMIT_WINDOW_MS) {
        // Reseta a janela de tempo
        rateLimitMap.set(uid, { count: 1, startTime: now });
      } else {
        userRateData.count++;
        if (userRateData.count > RATE_LIMIT_MAX) {
          console.warn(`Rate limit excedido para o usuário: ${uid}`);
          return res.status(429).json({ error: "Muitas requisições. Aguarde um minuto e tente novamente." });
        }
      }
    }

    // 3. Pega e Valida o Endpoint (Proteção contra Path Traversal)
    const endpoint = req.query.endpoint;
    
    // Regra: Não pode ser vazio, não pode conter '..', e só pode conter letras, números, barras e hífens.
    if (!endpoint || endpoint.includes("..") || !/^[a-zA-Z0-9\/\-]+$/.test(endpoint)) {
      return res.status(400).json({ error: "Endpoint inválido ou requisição malformada." });
    }

    // 4. Faz a requisição segura para o TRE
    const targetUrl = `https://servicos.tre-am.jus.br/consger-consumer/v1/elo/${endpoint}`;

    try {
      const response = await fetch(targetUrl);
      
      if (!response.ok) {
        throw new Error(`Erro da API TRE: ${response.status}`);
      }
      
      const data = await response.json();
      res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
      res.status(200).json(data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro ao comunicar com o servidor do TRE" });
    }
  });
});
