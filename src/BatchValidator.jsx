import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';
import zonesData from './zones.json';
import { fetchTRE } from './api';

// Mapeamento zona -> array de codMunic
const zoneMap = {};
zonesData.forEach(z => {
  if (!zoneMap[z.zona]) {
    zoneMap[z.zona] = [];
  }
  zoneMap[z.zona].push(z.codMunic);
});

export default function BatchValidator() {
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [status, setStatus] = useState("");

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) {
      setFile(uploadedFile);
    }
  };

  const processFile = async () => {
    if (!file) return;
    
    setProcessing(true);
    setStatus("Lendo o arquivo...");
    
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
      
      if (rows.length === 0) {
        throw new Error("A planilha está vazia.");
      }

      setStatus("Identificando colunas...");
      // Achar os nomes das colunas de Zona e Seção
      const firstRow = rows[0];
      const keys = Object.keys(firstRow);
      
      const getColumnKey = (possibleNames) => {
        return keys.find(k => possibleNames.some(pn => k.toLowerCase().includes(pn)));
      };

      const zonaKey = getColumnKey(['zona']);
      const secaoKey = getColumnKey(['seção', 'secao', 'seçao']);
      
      if (!zonaKey || !secaoKey) {
        throw new Error("Não foi possível identificar as colunas 'Zona' e 'Seção'. Certifique-se que elas existem na primeira linha.");
      }

      setProgress({ current: 0, total: rows.length });
      
      // CACHES
      const locaisCache = {}; // chave: "zona-codMunic", valor: locais array
      const secoesCache = {}; // chave: codObjeto (local), valor: seções array
      
      setStatus("Validando dados...");
      
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        let rowZona = parseInt(row[zonaKey], 10);
        let rowSecao = parseInt(row[secaoKey], 10);
        
        let statusMsg = "";
        
        if (isNaN(rowZona) || isNaN(rowSecao)) {
          statusMsg = "Erro: Zona ou Seção inválida na planilha";
        } else if (!zoneMap[rowZona]) {
          statusMsg = "Erro: Zona inválida ou não pertence ao AM";
        } else {
          // Busca em todos os municípios desta zona
          let found = false;
          let localEncontrado = null;
          
          for (const codMunic of zoneMap[rowZona]) {
            if (found) break;
            
            const cacheKeyLocais = `${rowZona}-${codMunic}`;
            let locais = locaisCache[cacheKeyLocais];
            
            if (!locais) {
              try {
                locais = await fetchTRE(`locaisVotacao/${rowZona}/${codMunic}`);
                locaisCache[cacheKeyLocais] = locais;
              } catch (e) {
                locais = [];
              }
            }
            
            // Procura a seção nestes locais
            for (const local of locais) {
              let secoes = secoesCache[local.codObjeto];
              if (!secoes) {
                try {
                  secoes = await fetchTRE(`secaoVotacao/porLocalVotacao/${local.codObjeto}`);
                  secoesCache[local.codObjeto] = secoes;
                } catch(e) {
                  secoes = [];
                }
              }
              
              if (secoes.find(s => parseInt(s.numSecao, 10) === rowSecao)) {
                found = true;
                localEncontrado = local;
                break;
              }
            }
          }
          
          if (found) {
            statusMsg = `Correto - Local: ${localEncontrado.nomLocal}, ${localEncontrado.bairro}`;
          } else {
            statusMsg = "Erro: Seção não encontrada nesta Zona";
          }
        }
        
        // Adiciona a nova coluna na linha original
        row["Status Validação"] = statusMsg;
        setProgress(p => ({ ...p, current: i + 1 }));
      }
      
      setStatus("Gerando arquivo para download...");
      
      const newWorksheet = XLSX.utils.json_to_sheet(rows);
      const newWorkbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, "Validação");
      
      XLSX.writeFile(newWorkbook, "resultado_tre.xlsx");
      
      setStatus("Processamento concluído com sucesso!");
    } catch (error) {
      console.error(error);
      setStatus("Erro: " + error.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="batch-container">
      <h2>Validação em Lote (Excel)</h2>
      <p className="subtitle">
        Envie uma planilha com as colunas <strong>Nome</strong>, <strong>Zona</strong> e <strong>Seção</strong>.
        O sistema validará cada linha informando se a seção realmente existe na zona informada.
      </p>

      <div className="upload-box">
        <label className="upload-label">
          <input 
            type="file" 
            accept=".xls,.xlsx" 
            onChange={handleFileUpload}
            disabled={processing}
          />
          <FileSpreadsheet size={48} className="upload-icon" />
          <span className="upload-text">
            {file ? file.name : "Clique aqui ou arraste sua planilha (.xlsx)"}
          </span>
        </label>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
        <button 
          className="btn-search btn-process" 
          onClick={processFile} 
          disabled={!file || processing}
          style={{ flex: 1 }}
        >
          {processing ? (
            <>
              <div className="spinner-small"></div>
              Processando...
            </>
          ) : (
            <>
              <Download size={20} />
              Validar e Baixar
            </>
          )}
        </button>

        <button 
          onClick={() => { setFile(null); setStatus(''); }} 
          disabled={!file || processing}
          style={{ 
            flex: 1, 
            background: 'rgba(255, 255, 255, 0.1)', 
            border: '1px solid var(--glass-border)',
            color: 'var(--text-primary)',
            borderRadius: '12px',
            fontWeight: '600',
            cursor: !file || processing ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
            opacity: !file || processing ? 0.5 : 1
          }}
        >
          Remover Anexo
        </button>
      </div>

      {status && (
        <div className={`status-message ${status.includes('Erro') ? 'error' : 'info'}`}>
          {status.includes('Erro') ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
          <span>{status}</span>
        </div>
      )}

      {processing && progress.total > 0 && (
        <div className="progress-container">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            ></div>
          </div>
          <p className="progress-text">
            Validando linha {progress.current} de {progress.total}
          </p>
        </div>
      )}
    </div>
  );
}
