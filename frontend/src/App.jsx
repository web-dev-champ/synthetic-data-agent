import React, { useState, useEffect } from 'react';
// LOCAL DEVELOPMENT INSTRUCTION: 
// Uncomment the line below in your local environment to use the real Google Login.
import { GoogleLogin } from '@react-oauth/google';

import { 
  Database, Plus, Trash2, Download, FileSpreadsheet, 
  History, Settings, Loader2, LogOut, AlertCircle, FileText,
  BookOpen, Sparkles, CheckCircle2, X, UploadCloud
} from 'lucide-react';

const API_BASE_URL = 'http://127.0.0.1:8000';

// MOCK COMPONENT FOR PREVIEW ENVIRONMENT
// Remove this entirely in your local code and use the import above.


export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [activeTab, setActiveTab] = useState('intro'); // Set Guide tab as the landing page
  const [error, setError] = useState('');
  
  // Form State
  const [columns, setColumns] = useState([
    { col_name: 'id', datatype: 'integer', desc: 'A unique sequential ID starting from 1' },
    { col_name: 'customer_name', datatype: 'string', desc: 'A realistic Indian or global full name' }
  ]);
  const [overallContext, setOverallContext] = useState('');
  const [numRows, setNumRows] = useState(100);
  
  // Request States
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Modal & Drag-and-Drop States
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [importFormat, setImportFormat] = useState('json');

  // Predefined Interactive Examples
  const dataTemplates = [
    {
      title: "E-Commerce Transaction Ledger",
      description: "Generates a comprehensive sales log containing customer metadata, product details, and dynamic order tracking numbers.",
      rows: 500,
      context: "An active digital retail transaction history block. Ensure all prices look mathematically appropriate relative to general consumer items.",
      cols: [
        { col_name: 'order_id', datatype: 'integer', desc: 'Sequential order serial number starting from 1001' },
        { col_name: 'customer_email', datatype: 'string', desc: 'Random personal valid emails ending with @gmail.com or @yahoo.com' },
        { col_name: 'product_category', datatype: 'string', desc: 'Randomly pick one from: Electronics, Apparel, Home Decor, Fitness' },
        { col_name: 'purchase_amount', datatype: 'float', desc: 'Random transaction value between 15.50 and 899.99' },
        { col_name: 'payment_status', datatype: 'string', desc: 'Pick dynamically based on logic: 90% Success, 7% Pending, 3% Failed' }
      ]
    },
    {
      title: "FinTech Transaction & Risk Log",
      description: "Perfect for testing financial analytical systems. Includes realistic currency values, transaction classes, and risk validation markers.",
      rows: 1000,
      context: "This dataset is engineered for training a risk assessment module. Ensure 5% of entries represent anomalously large transfers flagged for review.",
      cols: [
        { col_name: 'tx_hash', datatype: 'string', desc: 'A random hex-string code representing a transaction hash profile' },
        { col_name: 'account_type', datatype: 'string', desc: 'Choose between: Savings, Current, Investment, Corporate' },
        { col_name: 'transfer_amount_usd', datatype: 'integer', desc: 'Most amounts should be between 10 and 5000, but occasionally generate a huge spike up to 150000' },
        { col_name: 'is_flagged_fraud', datatype: 'boolean', desc: 'True if transfer_amount_usd is over 100000, else False' },
        { col_name: 'timestamp', datatype: 'date', desc: 'Random timestamp within the last 30 days' }
      ]
    },
    {
      title: "User Management Registry",
      description: "A standard profile database block ideal for filling local database migrations and checking interface styling bounds.",
      rows: 250,
      context: "Standard active client registration hub database.",
      cols: [
        { col_name: 'user_id', datatype: 'integer', desc: 'Unique auto-incrementing ID mapping' },
        { col_name: 'username', datatype: 'string', desc: 'A unique lowcase alphanumeric handle generated from common naming variants' },
        { col_name: 'role', datatype: 'string', desc: 'Randomly assign roles: 85% Admin, 10% Manager, 5% Executive' },
        { col_name: 'account_active', datatype: 'boolean', desc: 'Random True or False status' }
      ]
    }
  ];

  const applyTemplate = (template) => {
    setColumns(template.cols);
    setOverallContext(template.context);
    setNumRows(template.rows);
    setActiveTab('generate');
    // Clear out error traces if a valid template was loaded
    setError('');
  };

// Notice the 'async' keyword right before the parameters!
  const authFetch = async (endpoint, options = {}) => {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (res.status === 401) {
      handleLogout();
      throw new Error("Session expired. Please log in again.");
    }
    
    if (!res.ok) {
      // Safely attempt to extract the error detail, falling back to status text
      let errorMessage = `HTTP Error ${res.status}`;
      try {
        const data = await res.json();
        errorMessage = data.detail || errorMessage;
      } catch (e) {
        // If it's not JSON (e.g. a raw server crash page), get the text
        const textData = await res.text();
        errorMessage = textData || errorMessage;
      }
      throw new Error(errorMessage);
    }
    return res;
  };

  const handleLoginSuccess = async (credentialResponse) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: credentialResponse.credential })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Login failed");
      
      setToken(data.access_token);
      localStorage.setItem('token', data.access_token);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('token');
  };

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await authFetch('/data/history');
      const data = await res.json();
      setHistory(data.history || []);
    } catch (err) {
      setError("Failed to load history: " + err.message);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (token && activeTab === 'history') {
      fetchHistory();
    }
  }, [token, activeTab]);

  const addColumn = () => {
    if (columns.length >= 20) {
      setError("Maximum of 20 columns allowed.");
      return;
    }
    setColumns([...columns, { col_name: '', datatype: 'string', desc: '' }]);
  };

  const updateColumn = (index, field, value) => {
    const newCols = [...columns];
    newCols[index][field] = value;
    setColumns(newCols);
  };

  const removeColumn = (index) => {
    setColumns(columns.filter((_, i) => i !== index));
  };

  const clearSchema = () => {
    // Resets to a single empty row
    setColumns([{ col_name: '', datatype: 'string', desc: '' }]);
    setOverallContext('');
    setError('');
  };

 

// // --- UNIFIED IMPORT PROCESSING ---
//   const processImportText = () => {
//     try {
//       let formattedSchema = [];

//       if (importFormat === 'json') {
//         const uploadedData = JSON.parse(jsonInput);
//         if (!Array.isArray(uploadedData)) throw new Error("JSON must be an array of objects.");
        
//         formattedSchema = uploadedData.map(col => ({
//           col_name: col.col_name || '',
//           datatype: col.datatype || 'string',
//           desc: col.desc || ''
//         }));
//       } 
//       else if (importFormat === 'sql') {
//         // Extract everything between the first ( and the last )
//         const match = jsonInput.match(/\(([\s\S]*)\)/);
//         if (!match) throw new Error("Could not find column definitions. Ensure your SQL contains ( ) parentheses.");

//         // Expanded mapping dictionary
//         const sqlMap = {
//           'int': 'integer', 'integer': 'integer', 'serial': 'integer', 'bigint': 'integer', 'smallint': 'integer', 'tinyint': 'integer',
//           'varchar': 'string', 'text': 'string', 'char': 'string', 'uuid': 'string', 'character': 'string',
//           'decimal': 'float', 'numeric': 'float', 'float': 'float', 'double': 'float', 'real': 'float',
//           'boolean': 'boolean', 'bool': 'boolean',
//           'date': 'date', 'timestamp': 'date', 'datetime': 'date', 'time': 'date'
//         };

//         const lines = match[1].split('\n');
//         for (let line of lines) {
//           // Clean up the line: remove trailing commas and trim whitespace
//           line = line.replace(/,$/, '').trim();
          
//           // Ignore empty lines and table-level constraints
//           if (!line || /^(PRIMARY\s+KEY|FOREIGN\s+KEY|CONSTRAINT|UNIQUE|KEY|INDEX)/i.test(line)) continue;

//           // ADVANCED REGEX: Safely extracts the column name and the alphabetical base data type
//           // This ignores spaces inside things like DECIMAL(10, 2)
//           const colMatch = line.match(/^['"`]?([a-zA-Z0-9_]+)['"`]?\s+([a-zA-Z]+)/);
          
//           if (colMatch) {
//             const rawName = colMatch[1];
//             const rawType = colMatch[2].toLowerCase();
            
//             // Create a smart, AI-friendly default description prompt
//             const cleanName = rawName.replace(/_/g, ' '); 
            
//             formattedSchema.push({
//               col_name: rawName,
//               datatype: sqlMap[rawType] || 'string', // Default to string if unknown
//               desc: `Generate realistic ${cleanName} data`
//             });
//           }
//         }
//         if (formattedSchema.length === 0) throw new Error("No valid SQL columns found.");
//       }

//       // Apply the parsed schema (capped at 20 rows)
//       setColumns(formattedSchema.slice(0, 20));
//       setError('');
//       setShowUploadModal(false);
//       setJsonInput('');
//     } catch (err) {
//       setError(`Import failed: ${err.message}`);
//     }
//   };
  
// --- UPGRADED SQL PARSER ---
  const processImportText = () => {
    try {
      let formattedSchema = [];

      if (importFormat === 'json') {
        const uploadedData = JSON.parse(jsonInput);
        if (!Array.isArray(uploadedData)) throw new Error("JSON must be an array of objects.");
        formattedSchema = uploadedData.map(col => ({
          col_name: col.col_name || '',
          datatype: col.datatype || 'string',
          desc: col.desc || ''
        }));
      } 
      else if (importFormat === 'sql') {
        // 1. Isolate the content inside the table parentheses
        const match = jsonInput.match(/\(([\s\S]*)\)/);
        if (!match) throw new Error("Could not find column definitions inside parentheses.");

        const sqlMap = {
          'int': 'integer', 'integer': 'integer', 'serial': 'integer', 'bigint': 'integer', 'smallint': 'integer', 'uuid': 'string',
          'varchar': 'string', 'text': 'string', 'char': 'string', 'character': 'string',
          'decimal': 'float', 'numeric': 'float', 'float': 'float', 'double': 'float', 'real': 'float',
          'boolean': 'boolean', 'bool': 'boolean',
          'date': 'date', 'timestamp': 'date', 'datetime': 'date'
        };

        const lines = match[1].split(',');
        for (let line of lines) {
          line = line.trim();
          
          // 2. Strict Filter: Ignore constraints, keys, and indexes
          if (!line || /^(CONSTRAINT|PRIMARY|FOREIGN|UNIQUE|CHECK|KEY|INDEX)/i.test(line)) continue;

          // 3. Extract: Matches name, then type (ignoring anything after type like (255) or NOT NULL)
          const colMatch = line.match(/^['"`]?([a-zA-Z0-9_]+)['"`]?\s+([a-zA-Z]+)/);
          
          if (colMatch) {
            const rawName = colMatch[1];
            const rawType = colMatch[2].toLowerCase();
            const cleanName = rawName.replace(/_/g, ' '); 
            
            formattedSchema.push({
              col_name: rawName,
              datatype: sqlMap[rawType] || 'string',
              desc: `Generate realistic ${cleanName} data`
            });
          }
        }
        if (formattedSchema.length === 0) throw new Error("No valid columns found.");
      }

      setColumns(formattedSchema.slice(0, 20));
      setError('');
      setShowUploadModal(false);
      setJsonInput('');
    } catch (err) {
      setError(`Import failed: ${err.message}`);
    }
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  };

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file) readFile(file);
    e.target.value = null; // Reset input
  };

  // (Keep handleFileDrop, handleFileInput, and readFile exactly as they are, 
  // but change the function they call inside readFile from processJSONString to processImportText)
  const readFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setJsonInput(e.target.result); // Load the file content into the text area so they can see it before parsing
    };
    reader.readAsText(file);
  };

  // -------------------------------

  const handleGenerate = async () => {
    setError('');
    
    if (numRows < 1 || numRows > 2000) {
      setError("Number of rows must be between 1 and 2000.");
      return;
    }
    if (columns.some(c => !c.col_name || !c.desc)) {
      setError("All columns must have a valid configuration name and behavioral description.");
      return;
    }

    setIsGenerating(true);
    try {
      await authFetch('/data/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          columns,
          overall_context: overallContext,
          num_rows: parseInt(numRows)
        })
      });
      setActiveTab('history');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async (filename, format) => {
    try {
      const requestFilename = format === 'excel' 
        ? filename.replace('.csv', '.xlsx') 
        : filename;

      const res = await authFetch(`/data/download/${requestFilename}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = requestFilename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      if (err.message.includes("404")) {
         setError("This file has expired or was removed from our servers (24h retention limit).");
      } else {
         setError("Download failed: " + err.message);
      }
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center space-y-6 border border-slate-100">
          <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mx-auto shadow-blue-200 shadow-lg">
            <Database className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Synthetic Data Agent</h1>
          <p className="text-slate-500 pb-4">
            Generate realistic, LLM-powered synthetic datasets for testing and machine learning in seconds.
          </p>
          
          {error && (
            <div className="fixed top-6 right-6 max-w-sm bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl shadow-xl z-50 flex items-start gap-3 animate-slide-in">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-sm font-semibold text-left">{error}</div>
              <button onClick={() => setError('')} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
            </div>
          )}

          <div className="flex justify-center pt-2">
            <GoogleLogin
              onSuccess={handleLoginSuccess}
              onError={() => setError('Google Login Failed')}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 relative">
      
      {/* 1. FLOATING ERROR NOTIFICATION TOAST */}
      {error && (
        <div className="fixed top-6 right-6 max-w-md bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl shadow-xl z-50 flex items-start gap-3 animate-slide-in">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm font-semibold">{error}</div>
          <button 
            onClick={() => setError('')} 
            className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. FULL-SCREEN BLUR BLOCKED LOADING SCREEN */}
      {isGenerating && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex flex-col items-center justify-center text-center p-6 select-none">
          <div className="bg-white/10 p-8 rounded-3xl border border-white/20 max-w-lg w-full space-y-6 shadow-2xl">
            <div className="relative flex items-center justify-center mx-auto w-16 h-16">
              <Loader2 className="w-12 h-12 text-white animate-spin absolute" />
              <Database className="w-5 h-5 text-blue-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white tracking-wide">Assembling Synthetic Architecture</h3>
              <p className="text-slate-200 text-sm leading-relaxed">
                The core engine is prompting Gemini, constructing sandboxed runtime scripts, validating structural code blocks, and calculating column weights.
              </p>
            </div>
            <div className="bg-blue-600/30 text-blue-200 py-2.5 px-4 rounded-xl text-xs font-semibold inline-block border border-blue-500/20">
              ⏱️ This execution layer may take up to 2-5 minutes depending on volume.
            </div>
          </div>
        </div>
      )}

      {/* 3. IMPORT CANVAS (MODAL) */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden animate-slide-in">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Import Schema</h2>
                <p className="text-sm text-slate-500 mt-1">Drag and drop a file, or paste your raw schema.</p>
              </div>
              <button onClick={() => setShowUploadModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Drag and Drop Zone */}
              <label 
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                onDrop={handleFileDrop}
                className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                  isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <UploadCloud className={`w-10 h-10 mb-2 ${isDragging ? 'text-blue-500' : 'text-slate-400'}`} />
                  <p className="text-sm text-slate-500"><span className="font-semibold text-blue-600">Upload a file</span> or drag and drop</p>
                </div>
                <input type="file" accept=".json,.sql,.txt" onChange={handleFileInput} className="hidden" />
              </label>

              {/* Format Toggle */}
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button 
                  onClick={() => setImportFormat('json')}
                  className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${importFormat === 'json' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  JSON Format
                </button>
                <button 
                  onClick={() => setImportFormat('sql')}
                  className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${importFormat === 'sql' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  SQL (DDL)
                </button>
              </div>

              {/* Text Area for Pasting */}
              <div>
                <textarea 
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder={importFormat === 'json' 
                    ? '[\n  { "col_name": "id", "datatype": "integer", "desc": "User ID" }\n]' 
                    : 'CREATE TABLE users (\n  id SERIAL PRIMARY KEY,\n  username VARCHAR(50) NOT NULL,\n  is_active BOOLEAN\n);'}
                  className="w-full h-48 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                />
              </div>

              <button 
                onClick={processImportText}
                disabled={!jsonInput.trim()}
                className={`w-full py-3 rounded-xl font-bold text-base transition-all ${
                  jsonInput.trim() ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-md' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                Import {importFormat === 'json' ? 'JSON' : 'SQL'} Schema
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Navigation */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-md shadow-blue-200">
            <Database className="w-5 h-5 text-white" />
          </div>
          <h1 className="font-bold text-xl tracking-tight text-slate-800">DataAgent</h1>
        </div>
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-4 gap-8">
        
        {/* Sidebar Navigation Links */}
        <div className="space-y-2">
          <button 
            onClick={() => setActiveTab('intro')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
              activeTab === 'intro' ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <BookOpen className="w-5 h-5" /> Platform Guide
          </button>
          <button 
            onClick={() => setActiveTab('generate')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
              activeTab === 'generate' ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Settings className="w-5 h-5" /> Schema Builder
          </button>
          <button 
            onClick={() => setActiveTab('examples')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
              activeTab === 'examples' ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Sparkles className="w-5 h-5" /> Templates & Examples
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
              activeTab === 'history' ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <History className="w-5 h-5" /> My Data History
          </button>
        </div>

        {/* Main Interface Content Router */}
        <div className="md:col-span-3 space-y-6">

          {/* TAB 1: INTRO LANDING PAGE */}
          {activeTab === 'intro' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-8">
              <div className="space-y-3">
                <div className="text-xs font-bold uppercase tracking-widest text-blue-600">Enterprise Asset Pipeline</div>
                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight sm:text-3xl">What We Do</h2>
                <p className="text-slate-600 leading-relaxed text-base">
                  DataAgent bridges the gap between strict schema constraints and complex context parsing. By leveraging LLM generation layers coupled with robust local static analysis code guardrails, our engine spins up specialized sandboxed scripts that materialize realistic datasets—free of production PII violations.
                </p>
              </div>

              <div className="border-t border-slate-100 pt-8 space-y-4">
                <h3 className="font-bold text-lg text-slate-900">How to Use the Platform</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">1</div>
                    <h4 className="font-bold text-sm text-slate-800">Map Schema</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">Add columns, specify explicit SQL types, and declare high-level business rules or distributions.</p>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">2</div>
                    <h4 className="font-bold text-sm text-slate-800">Set Core Boundary</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">Provide semantic context (e.g., fraud metrics, seasonal variance thresholds) and input boundaries.</p>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">3</div>
                    <h4 className="font-bold text-sm text-slate-800">Download Data</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">Export generated sheets as flattened raw CSV files or clean formatted Microsoft Excel workbooks.</p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <h4 className="font-bold text-blue-950 flex items-center gap-2 justify-center sm:justify-start">
                    <CheckCircle2 className="w-5 h-5 text-blue-600" /> Secure Engineering Active
                  </h4>
                  <p className="text-xs text-blue-700 leading-normal max-w-md">
                    All inputs and code structures are audited in real-time by AST and token safety microservices.
                  </p>
                </div>
                <button 
                  onClick={() => setActiveTab('generate')}
                  className="px-6 py-3 bg-blue-600 text-white font-bold text-sm rounded-xl shadow-md shadow-blue-200 hover:bg-blue-700 transition-all flex-shrink-0"
                >
                  Try Now
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: SCHEMA BUILDER */}
          {activeTab === 'generate' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                <h2 className="text-lg font-bold text-slate-800">1. Define Schema</h2>
                <p className="text-sm text-slate-500 mt-1">Configure the exact columns and data types you need.</p>
              </div>
              
              <div className="p-6 space-y-4">
                {columns.map((col, idx) => (
                  <div key={idx} className="flex gap-3 items-start bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="flex-1 space-y-3">
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Column Name</label>
                          <input 
                            type="text" 
                            value={col.col_name}
                            onChange={(e) => updateColumn(idx, 'col_name', e.target.value)}
                            placeholder="e.g. user_id"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                        <div className="w-48">
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Data Type</label>
                          <select 
                            value={col.datatype}
                            onChange={(e) => updateColumn(idx, 'datatype', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          >
                            <option value="string">String / Text</option>
                            <option value="integer">Integer</option>
                            <option value="float">Float / Decimal</option>
                            <option value="boolean">Boolean</option>
                            <option value="date">Date / Time</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">AI Logic / Description</label>
                        <input 
                          type="text" 
                          value={col.desc}
                          onChange={(e) => updateColumn(idx, 'desc', e.target.value)}
                          placeholder="e.g. A random email address ending in @gmail.com"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>
                    {columns.length > 1 && (
                      <button 
                        onClick={() => removeColumn(idx)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg mt-5 transition-colors"
                        title="Remove Column"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}

              {/* Replaced the single Add Column button with this action bar */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <button 
                    onClick={addColumn}
                    className="w-full py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 font-medium hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Add Column
                  </button>
                  
                  <button 
                    onClick={() => setShowUploadModal(true)}
                    className="w-full py-2.5 border border-slate-200 bg-white rounded-xl text-slate-600 font-medium hover:border-slate-300 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    <UploadCloud className="w-4 h-4" /> Import Schema JSON/SQL
                  </button>

                  <button 
                    onClick={clearSchema}
                    className="w-full py-2.5 border border-red-200 bg-red-50 rounded-xl text-red-600 font-medium hover:bg-red-100 transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Trash2 className="w-4 h-4" /> Clear Builder
                  </button>
                </div>  

              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50/50">
                <h2 className="text-lg font-bold text-slate-800 mb-4">2. Generation Context</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Overall Instructions (Optional)</label>
                    <textarea 
                      value={overallContext}
                      onChange={(e) => setOverallContext(e.target.value)}
                      placeholder="e.g. This is for a fraud detection model. 5% of the data should represent fraudulent transactions."
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none h-24 resize-none"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Total Rows (Max 2000)</label>
                    <input 
                      type="number" 
                      min="1" max="2000"
                      value={numRows}
                      onChange={(e) => setNumRows(e.target.value)}
                      className="w-48 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-white">
                <button 
                  onClick={handleGenerate}
                  className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"
                >
                  <Database className="w-5 h-5" /> Generate Dataset
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: EXAMPLES & TEMPLATES */}
          {activeTab === 'examples' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl p-6 border border-slate-200">
                <h2 className="text-xl font-bold text-slate-900">Pre-Engineered Blueprint Blueprints</h2>
                <p className="text-slate-500 text-sm mt-1">Load structured data matrices to test ingestion nodes instantly without manual typing.</p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {dataTemplates.map((tmpl, idx) => (
                  <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center hover:border-slate-300 shadow-sm transition-all">
                    <div className="space-y-2 max-w-xl">
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-base text-slate-900">{tmpl.title}</h3>
                        <span className="bg-blue-50 text-blue-700 font-bold text-xs px-2.5 py-0.5 rounded-full border border-blue-100">{tmpl.cols.length} Columns</span>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{tmpl.description}</p>
                    </div>
                    <button 
                      onClick={() => applyTemplate(tmpl)}
                      className="px-5 py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition-all text-center"
                    >
                      Load Template
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: HISTORY */}
          {activeTab === 'history' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Generated Datasets</h2>
                  <p className="text-sm text-slate-500 mt-1">Access and download your previously generated files.</p>
                </div>
                <button 
                  onClick={fetchHistory}
                  disabled={isLoadingHistory}
                  className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <History className={`w-5 h-5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* ADD THIS WARNING NOTE */}
              <div className="mt-4 flex items-center gap-2 text-xs bg-amber-50 text-amber-700 px-3 py-2 rounded-lg border border-amber-100">
                <AlertCircle className="w-4 h-4" />
                <span>Files are automatically cleared from our servers after 24 hours.</span>
              </div>
            
              <div className="divide-y divide-slate-100">
                {history.length === 0 ? (
                  <div className="p-12 text-center text-slate-500">
                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p>No generated datasets found.</p>
                  </div>
                ) : (
                  history.map((item, idx) => (
                    <div key={idx} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-1 sm:mt-0">
                          <FileSpreadsheet className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">{item.filename}</p>
                          <div className="flex gap-3 text-xs text-slate-500 mt-1 font-medium">
                            <span className="bg-slate-100 px-2 py-1 rounded-md">{item.rows} Rows</span>
                            <span className="bg-slate-100 px-2 py-1 rounded-md">{item.generated_at}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button 
                          onClick={() => handleDownload(item.filename, 'csv')}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all"
                        >
                          <Download className="w-4 h-4" /> CSV
                        </button>
                        <button 
                          onClick={() => handleDownload(item.filename, 'excel')}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-green-50 border border-green-200 text-green-700 text-sm font-semibold rounded-lg hover:bg-green-100 transition-all"
                        >
                          <FileSpreadsheet className="w-4 h-4" /> Excel
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}