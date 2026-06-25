const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch");
const cors = require("cors")({ origin: true });

admin.initializeApp();

// Esta função faz o papel de proxy para a API pública do TRE
// E inclui verificação de autenticação do Firebase para maior segurança
exports.proxyTRE = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    // Verifica se o usuário está autenticado
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(403).json({ error: "Acesso Negado: Token não fornecido." });
    }

    const idToken = authHeader.split("Bearer ")[1];
    try {
      await admin.auth().verifyIdToken(idToken);
    } catch (error) {
      console.error("Token verification failed:", error);
      return res.status(403).json({ error: "Acesso Negado: Token inválido ou expirado." });
    }

    // A URL original do TRE que queremos acessar
    const endpoint = req.query.endpoint;
    if (!endpoint) {
      return res.status(400).json({ error: "Parâmetro 'endpoint' obrigatório." });
    }

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
