"use client";

import React, { useState, useEffect } from 'react';

const DatabaseTest = () => {
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [error, setError] = useState(null);
  const [assets, setAssets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function testConnection() {
      try {
        // Test database connection
        const pingResponse = await fetch('/api/ping');
        const pingData = await pingResponse.json();
        setConnectionStatus(pingData.status);
        
        if (pingData.assets) {
          setAssets(pingData.assets);
        }
        
        if (pingData.status !== 'OK') {
          setError(pingData.message || 'Erro desconhecido na conexão');
        }
      } catch (err) {
        setConnectionStatus('ERROR');
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }

    testConnection();
  }, []);

  const runSyncScript = async () => {
    setIsLoading(true);
    try {
      // Simulação - Na prática seria necessário criar um endpoint para isso
      alert('Esta função exigiria um endpoint específico para executar o script de sincronização. Por favor, execute manualmente com "npm run sync-db".');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-6xl p-4">
        <div className="rounded-lg shadow-lg p-6 bg-white">
          <div className="flex items-center justify-center h-64">
            <p className="text-lg">Testando conexão com o banco de dados...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl p-4">
      <div className="rounded-lg shadow-lg p-6 bg-white">
        <h2 className="text-2xl font-bold mb-4">Teste de Conexão com o Banco de Dados</h2>
        
        <div className="mb-4 p-4 border rounded-lg">
          <h3 className="text-lg font-medium mb-2">Status da Conexão:</h3>
          <div className={`text-lg font-bold ${connectionStatus === 'OK' ? 'text-green-600' : 'text-red-600'}`}>
            {connectionStatus === 'OK' ? 'Conexão estabelecida com sucesso' : 'Erro na conexão'}
          </div>
          
          {error && (
            <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded text-red-700">
              <p className="font-medium">Mensagem de erro:</p>
              <p className="font-mono text-sm mt-1">{error}</p>
            </div>
          )}
          
          {connectionStatus === 'OK' && (
            <div className="mt-4">
              <p className="font-medium">Número de ativos no banco: {assets}</p>
            </div>
          )}
        </div>
        
        <div className="flex flex-col space-y-4">
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
            <h3 className="text-lg font-medium mb-2">Próximos passos:</h3>
            <ol className="list-decimal list-inside space-y-2">
              <li>Verifique se o banco de dados PostgreSQL está em execução</li>
              <li>Confirme se a variável de ambiente DATABASE_URL está configurada corretamente</li>
              <li>Execute o script de sincronização para popular o banco com dados de teste</li>
              <li>Verifique os logs do console do servidor para mensagens de erro detalhadas</li>
            </ol>
          </div>
          
          <button
            onClick={runSyncScript}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
          >
            Executar script de sincronização (simulação)
          </button>
          
          <a 
            href="/"
            className="px-4 py-2 bg-gray-200 text-center rounded hover:bg-gray-300 transition"
          >
            Voltar para o Dashboard
          </a>
        </div>
      </div>
    </div>
  );
};

export default DatabaseTest;