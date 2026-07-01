// import jwt from 'jsonwebtoken';
// import jwksClient from 'jwks-rsa';

/*
const client = jwksClient({
  jwksUri: 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
});

const getKey = (header, callback) => {
  client.getSigningKey(header.kid, function(err, key) {
    if (err) {
      callback(err, null);
    } else {
      const signingKey = key.publicKey || key.rsaPublicKey;
      callback(null, signingKey);
    }
  });
};

const verifyToken = (token) => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, getKey, {
      audience: 'treelocalizador',
      issuer: 'https://securetoken.google.com/treelocalizador',
      algorithms: ['RS256']
    }, (err, decoded) => {
      if (err) reject(err);
      else resolve(decoded);
    });
  });
};
*/

const rateLimitMap = new Map();
const RATE_LIMIT_MAX = 600;
const RATE_LIMIT_WINDOW_MS = 60000;

export default async function handler(req, res) {
  // CORS Headers are managed by Vercel implicitly since it's the SAME DOMAIN (tre-localizador.vercel.app -> /api/proxy)
  // Mas para testes locais:
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  /*
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(403).json({ error: "Acesso Negado: Token não fornecido." });
  }

  const idToken = authHeader.split("Bearer ")[1];
  let decodedToken;
  try {
    decodedToken = await verifyToken(idToken);
  } catch (error) {
    console.error("Token verification failed:", error);
    return res.status(403).json({ error: "Acesso Negado: Token inválido ou expirado." });
  }

  const uid = decodedToken.user_id || decodedToken.sub;
  */
  const uid = 'anonymous'; // Bypass temporário

  const now = Date.now();
  const userRateData = rateLimitMap.get(uid);

  if (!userRateData) {
    rateLimitMap.set(uid, { count: 1, startTime: now });
  } else {
    if (now - userRateData.startTime > RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.set(uid, { count: 1, startTime: now });
    } else {
      userRateData.count++;
      if (userRateData.count > RATE_LIMIT_MAX) {
        return res.status(429).json({ error: "Muitas requisições. Aguarde um minuto." });
      }
    }
  }

  const endpoint = req.query.endpoint;
  if (!endpoint || endpoint.includes("..") || !/^[a-zA-Z0-9\/\-]+$/.test(endpoint)) {
    return res.status(400).json({ error: "Endpoint inválido." });
  }

  const targetUrl = `https://servicos.tre-am.jus.br/consger-consumer/v1/elo/${endpoint}`;

  try {
    const response = await fetch(targetUrl);
    if (!response.ok) {
      throw new Error(`Erro da API TRE: ${response.status}`);
    }
    const data = await response.json();
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
    return res.status(200).json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro interno no proxy.", details: err.message });
  }
}
