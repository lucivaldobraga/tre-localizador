import React, { useState, useEffect } from 'react';
import { Search, MapPin, Users, Hash, Map, FileSpreadsheet, User, LogOut } from 'lucide-react';
import './index.css';
import BatchValidator from './BatchValidator';
import Login from './Login';
import { auth } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { fetchTRE } from './api';
import zonesData from './zones.json';

const sortedZones = zonesData
  .map(z => ({ value: z.value, label: z.label }))
  .sort((a, b) => a.label.localeCompare(b.label));

const ZONAS = [
  { value: "", label: "Selecione a Zona Eleitoral" },
  ...sortedZones
];

export default function App() {
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  const [activeTab, setActiveTab] = useState('individual');
  const [zona, setZona] = useState("");
  const [secao, setSecao] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = () => {
    signOut(auth);
  };

  if (authChecking) {
    return (
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const searchLocations = async () => {
    if (!zona) {
      setError("Por favor, selecione uma Zona Eleitoral.");
      return;
    }
    setError(null);
    setLoading(true);
    setResults([]);
    
    try {
      const [codZona, codMunic] = zona.split(";");
      setStatusText("Buscando locais de votação...");
      
      const locais = await fetchTRE(`locaisVotacao/${codZona}/${codMunic}`);
      
      const locaisComASeção = [];
      const locaisComTodasSecoes = [];
      const batchSize = 5;
      
      for (let i = 0; i < locais.length; i += batchSize) {
        const batch = locais.slice(i, i + batchSize);
        const promises = batch.map(async (local) => {
          try {
            const secoes = await fetchTRE(`secaoVotacao/porLocalVotacao/${local.codObjeto}`);
            
            if (secao) {
              // Se o usuário procurou por uma seção específica
              const secaoEncontrada = secoes.find(s => String(s.numSecao) === String(secao));
              if (secaoEncontrada) {
                locaisComASeção.push({
                  ...local,
                  aptosSecao: secaoEncontrada.qtdAptos
                });
              }
            } else {
              // Se não procurou por seção específica, guarda todas as seções para mostrar no local
              locaisComTodasSecoes.push({
                ...local,
                secoesDisponiveis: secoes
              });
            }
          } catch (err) {
            console.error("Erro ao buscar seções do local", local.nomLocal);
          }
        });
        await Promise.all(promises);
      }
      
      if (secao) {
        if (locaisComASeção.length === 0) {
          setError(`A seção ${secao} não foi encontrada na zona selecionada.`);
        } else {
          setResults(locaisComASeção);
        }
      } else {
        setResults(locaisComTodasSecoes);
      }
      
    } catch (err) {
      setError("Ocorreu um erro na consulta. Tente novamente mais tarde.");
    } finally {
      setLoading(false);
    }
  };

  const clearScreen = () => {
    setZona("");
    setSecao("");
    setResults([]);
    setError(null);
  };

  return (
    <div className="app-container">
      <header className="header" style={{ position: 'relative' }}>
        <h1>Valida Seção</h1>
        <p>Encontre rapidamente locais e valide seções eleitorais</p>
        <button 
          onClick={handleLogout} 
          style={{ position: 'absolute', top: 0, right: 0, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <LogOut size={18} /> Sair
        </button>
      </header>

      <div className="tabs">
        <button 
          className={`tab-btn ${activeTab === 'individual' ? 'active' : ''}`}
          onClick={() => setActiveTab('individual')}
        >
          <User size={18} /> Consulta Individual
        </button>
        <button 
          className={`tab-btn ${activeTab === 'lote' ? 'active' : ''}`}
          onClick={() => setActiveTab('lote')}
        >
          <FileSpreadsheet size={18} /> Validação em Lote (Excel)
        </button>
      </div>

      {activeTab === 'individual' && (
        <>
          <div className="search-box">
            <div className="input-group">
              <label>Zona Eleitoral</label>
              <select value={zona} onChange={(e) => setZona(e.target.value)}>
                {ZONAS.map(z => (
                  <option key={z.value} value={z.value}>{z.label}</option>
                ))}
              </select>
            </div>
            
            <div className="input-group">
              <label>Seção (Opcional)</label>
              <input 
                type="number" 
                placeholder="Ex: 123" 
                value={secao} 
                onChange={(e) => setSecao(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchLocations()}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-search" onClick={searchLocations} disabled={loading} style={{ flex: 1 }}>
                <Search size={20} />
                {loading ? 'Buscando...' : 'Consultar'}
              </button>
              
              <button 
                onClick={clearScreen} 
                disabled={loading}
                style={{ 
                  flex: 1, 
                  background: 'rgba(255, 255, 255, 0.1)', 
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-primary)',
                  borderRadius: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
              >
                Limpar Tela
              </button>
            </div>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {loading && (
            <div className="loader-container">
              <div className="spinner"></div>
              <p>{statusText}</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="results-container">
              <h2 style={{fontSize: '1.2rem', marginBottom: '0.5rem'}}>
                {results.length} Local(is) Encontrado(s)
              </h2>
              {results.map((local) => (
                <div key={local.codObjeto} className="result-card">
                  <div className="result-header">
                    <h3>{local.nomLocal}</h3>
                    <span className="badge">Zona {local.zona}</span>
                  </div>
                  <div className="result-body">
                    <div className="info-item">
                      <span className="info-label"><MapPin size={16} /> Endereço</span>
                      <span className="info-value">{local.endereco}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label"><Map size={16} /> Bairro / Município</span>
                      <span className="info-value">{local.bairro} - {local.municipio}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label"><Users size={16} /> Eleitores (Local)</span>
                      <span className="info-value">{local.qtdAptos?.toLocaleString('pt-BR')}</span>
                    </div>
                    {local.aptosSecao && (
                      <div className="info-item">
                        <span className="info-label" style={{color: 'var(--accent-color)'}}>
                          <Hash size={16} /> Eleitores (Seção {secao})
                        </span>
                        <span className="info-value" style={{color: 'var(--accent-color)'}}>
                          {local.aptosSecao}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {local.secoesDisponiveis && local.secoesDisponiveis.length > 0 && (
                    <div className="secoes-list" style={{ marginTop: '1rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
                      <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Seções e Aptos a Votar:</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '0.5rem' }}>
                        {local.secoesDisponiveis.map(sec => (
                          <div key={sec.numSecao} style={{ background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '8px', textAlign: 'center', fontSize: '0.85rem' }}>
                            <strong>S. {sec.numSecao}</strong><br/>
                            <span style={{ color: 'var(--accent-color)' }}>{sec.qtdAptos} aptos</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {!loading && results.length === 0 && !error && zona && (
            <div className="empty-state">
              Nenhum resultado para exibir. Tente buscar por uma zona e seção válida.
            </div>
          )}
        </>
      )}

      {activeTab === 'lote' && <BatchValidator />}
    </div>
  );
}
