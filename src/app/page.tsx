'use client';

import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Plus, 
  Trash2, 
  HelpCircle, 
  RefreshCw, 
  Layers, 
  Sliders, 
  Info, 
  ChevronRight, 
  AlertCircle,
  FileCode,
  Globe
} from 'lucide-react';
import KaTeX from '../components/KaTeX';

// Helper to get API URL
const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8080';
  }
  return 'http://127.0.0.1:8080';
};

interface CustomVector {
  name: string;
  type: 'vector' | 'tensor';
  indices: boolean[]; // true = contravariant (upper), false = covariant (lower)
  data: string[];
  slices?: number[]; // [sliceDim1, sliceDim2] for Rank-3/Rank-4 visual selection
}

export default function TensorLab() {
  // Metric configuration
  const [metric, setMetric] = useState<string>('schwarzschild');
  const [params, setParams] = useState<Record<string, string>>({
    M: '1.0',
    H: '1.0',
    a: '0.5',
    tt: '-(1 - 2*M/r)',
    rr: '1/(1 - 2*M/r)',
    θθ: 'r^2',
    ϕϕ: 'r^2 * sin(θ)^2'
  });

  // Coordinates
  const [coords, setCoords] = useState<string[]>(['0.0', '6.0', '1.570796', '0.0']);
  const [coordNames, setCoordNames] = useState<string[]>(['t', 'r', '\\theta', '\\phi']);

  // Custom vectors
  const [customVectors, setCustomVectors] = useState<CustomVector[]>([
    { name: 'v', type: 'vector', indices: [true], data: ['1.0', '2.0', '1.0', '3.0'], slices: [0, 0] }
  ]);

  // Contraction expression
  const [expression, setExpression] = useState<string>('v_ν = g{_μ _ν} v{^μ}');
  
  // States for API call
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [result, setResult] = useState<any>(null);

  // Active workspace tensor to inspect
  const [activeInspector, setActiveInspector] = useState<string | null>(null);

  // Set default coordinates based on metric selection
  useEffect(() => {
    if (metric === 'minkowski' || metric === 'flrw') {
      setCoordNames(['t', 'x', 'y', 'z']);
      setCoords(['0.0', '1.0', '0.0', '0.0']);
    } else {
      setCoordNames(['t', 'r', '\\theta', '\\phi']);
      setCoords(['0.0', '6.0', '1.570796', '0.0']); // r = 6M, theta = pi/2
    }
  }, [metric]);

  // Handle calculation submit
  const handleCalculate = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Parse coordinates as numbers
      const numericalCoords = coords.map(c => {
        const val = parseFloat(c);
        return isNaN(val) ? 0.0 : val;
      });

      // Parse custom vectors and tensors
      const parsedVectors: Record<string, any> = {};
      customVectors.forEach(v => {
        const numericalData = v.data.map(d => {
          const val = parseFloat(d);
          return isNaN(val) ? 0.0 : val;
        });
        parsedVectors[v.name] = {
          type: v.type,
          indices: v.indices,
          data: numericalData
        };
      });

      // Format parameters object
      const formattedParams: Record<string, any> = {};
      Object.keys(params).forEach(k => {
        if (['M', 'H', 'a'].includes(k)) {
          formattedParams[k] = parseFloat(params[k]) || 1.0;
        } else {
          formattedParams[k] = params[k];
        }
      });

      const requestBody = {
        metric,
        params: formattedParams,
        coords: numericalCoords,
        coord_names: coordNames,
        expression: expression,
        vectors: parsedVectors
      };

      const response = await fetch(`${getApiUrl()}/api/compute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Server calculation failed');
      }

      setResult(data);
      if (activeInspector === null) {
        setActiveInspector('g'); // default inspect metric
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to connect to Julia backend server.');
    } finally {
      setLoading(false);
    }
  };

  // Run initial calculation on load
  useEffect(() => {
    handleCalculate();
  }, []);

  // Toolbar greek index insert helper
  const insertIndex = (token: string) => {
    const textarea = document.getElementById('expr-editor') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const before = text.substring(0, start);
      const after = text.substring(end, text.length);
      const val = before + token + after;
      setExpression(val);
      textarea.focus();
      // Wait for React update and set selection
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + token.length;
      }, 0);
    } else {
      setExpression(prev => prev + token);
    }
  };

  const addCustomVector = () => {
    const names = ['w', 'u', 'A', 'B', 'k', 'p'];
    const taken = customVectors.map(v => v.name);
    const available = names.find(n => !taken.includes(n)) || 'u';
    setCustomVectors(prev => [
      ...prev,
      { name: available, type: 'vector', indices: [true], data: ['0.0', '0.0', '0.0', '0.0'], slices: [0, 0] }
    ]);
  };

  const removeCustomVector = (index: number) => {
    setCustomVectors(prev => prev.filter((_, i) => i !== index));
  };

  const renameVector = (index: number, newName: string) => {
    const cleanName = newName.replace(/[^a-zA-Z0-9']/g, '');
    setCustomVectors(prev => prev.map((v, i) => {
      if (i === index) {
        return { ...v, name: cleanName };
      }
      return v;
    }));
  };

  const updateVectorComponent = (vIndex: number, cIndex: number, value: string) => {
    setCustomVectors(prev => prev.map((v, i) => {
      if (i === vIndex) {
        const newData = [...v.data];
        newData[cIndex] = value;
        return { ...v, data: newData };
      }
      return v;
    }));
  };

  const updateVectorRank = (index: number, selectedValue: string) => {
    setCustomVectors(prev => prev.map((v, i) => {
      if (i === index) {
        let rank = 1;
        let type: 'vector' | 'tensor' = 'vector';
        if (selectedValue === 'rank-2') { rank = 2; type = 'tensor'; }
        else if (selectedValue === 'rank-3') { rank = 3; type = 'tensor'; }
        else if (selectedValue === 'rank-4') { rank = 4; type = 'tensor'; }
        
        const newIndices = Array(rank).fill(true).map((def, idx) => v.indices[idx] ?? def);
        const expectedSize = Math.pow(4, rank);
        const newData = v.data.slice(0, expectedSize);
        if (newData.length < expectedSize) {
          const padding = Array(expectedSize - newData.length).fill('0.0');
          return {
            ...v,
            type,
            indices: newIndices,
            data: newData.concat(padding),
            slices: v.slices ?? [0, 0]
          };
        } else {
          return {
            ...v,
            type,
            indices: newIndices,
            data: newData,
            slices: v.slices ?? [0, 0]
          };
        }
      }
      return v;
    }));
  };

  const updateVectorIndexToggle = (vectorIndex: number, indexPos: number) => {
    setCustomVectors(prev => prev.map((v, i) => {
      if (i === vectorIndex) {
        const newIndices = [...v.indices];
        newIndices[indexPos] = !newIndices[indexPos];
        return { ...v, indices: newIndices };
      }
      return v;
    }));
  };

  const updateVectorSlice = (vectorIndex: number, slicePos: number, value: number) => {
    setCustomVectors(prev => prev.map((v, i) => {
      if (i === vectorIndex) {
        const newSlices = [...(v.slices ?? [0, 0])];
        newSlices[slicePos] = value;
        return { ...v, slices: newSlices };
      }
      return v;
    }));
  };

  const getTensorIndicesLatex = (v: CustomVector) => {
    const symbols = ['\\mu', '\\nu', '\\rho', '\\sigma', '\\lambda', '\\kappa'];
    let latexStr = v.name;
    v.indices.forEach((isContra, idx) => {
      const sym = symbols[idx] ?? `i_{${idx}}`;
      const prefix = idx > 0 ? '{}' : '';
      if (isContra) {
        latexStr += `${prefix}^{${sym}}`;
      } else {
        latexStr += `${prefix}_{${sym}}`;
      }
    });
    return latexStr;
  };

  const getTensorFlatIndex = (v: CustomVector, rIdx: number, cIdx: number) => {
    const rank = v.indices.length;
    const s1 = v.slices?.[0] ?? 0;
    const s2 = v.slices?.[1] ?? 0;
    if (rank === 2) {
      return rIdx * 4 + cIdx;
    } else if (rank === 3) {
      return s1 * 16 + rIdx * 4 + cIdx;
    } else if (rank === 4) {
      return s1 * 64 + s2 * 16 + rIdx * 4 + cIdx;
    }
    return 0;
  };

  const updateParam = (key: string, value: string) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const getMetricDescription = () => {
    switch (metric) {
      case 'minkowski': return 'Flat 4D spacetime of Special Relativity using η = diag(-1, 1, 1, 1).';
      case 'schwarzschild': return 'Exterior spacetime of a static, spherically symmetric mass M.';
      case 'flrw': return 'Friedmann-Lemaître-Robertson-Walker expanding universe with Hubble parameter H.';
      case 'kerr': return 'Spacetime around a rotating black hole of mass M and spin a.';
      case 'custom': return 'User-defined diagonal metric components. Use coordinates (t, r, θ, ϕ) or parameters (M, H, a).';
      default: return '';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-violet-500 selection:text-white">
      {/* Background Neon Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-cyan-600/10 rounded-full blur-3xl -z-10 pointer-events-none" />

      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-cyan-500 shadow-lg shadow-violet-500/20">
            <span className="font-extrabold text-xl tracking-tighter text-white">G</span>
            <div className="absolute inset-0 rounded-xl border border-white/20 animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-400">
              Tensor Contractor
            </h1>
            <p className="text-xs text-slate-500 font-medium tracking-wide">GENERAL RELATIVITY</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-400">
            <Globe className="w-3.5 h-3.5 text-violet-400" />
            <span className="font-mono">API: {getApiUrl()}</span>
          </div>
          
          <button 
            onClick={handleCalculate}
            disabled={loading}
            className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 disabled:opacity-50 text-white font-medium text-sm px-4 py-2 rounded-lg transition shadow-lg shadow-violet-500/10 hover:shadow-violet-500/25 active:scale-[0.98]"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
            {loading ? 'Computing...' : 'Run Engine'}
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-[1600px] w-full mx-auto">
        
        {/* Left Column - Configuration (5 Cols) */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Card 1: Spacetime Configuration */}
          <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-5 backdrop-blur-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-5">
              <Sliders className="w-24 h-24 text-slate-400" />
            </div>

            <div className="flex items-center gap-2 mb-4">
              <Sliders className="w-4 h-4 text-violet-400" />
              <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-300">1. Spacetime Geometry</h2>
            </div>

            {/* Metric Select */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Select Spacetime Metric</label>
                <select 
                  value={metric}
                  onChange={(e) => setMetric(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none transition"
                >
                  <option value="minkowski">Minkowski Metric (Flat Space)</option>
                  <option value="schwarzschild">Schwarzschild Metric (Static Black Hole)</option>
                  <option value="kerr">Kerr Metric (Rotating Black Hole)</option>
                  <option value="flrw">FLRW Metric (Expanding Universe)</option>
                  <option value="custom">Custom Metric (Diagonal Formula)</option>
                </select>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{getMetricDescription()}</p>
              </div>

              {/* Dynamic Parameter Fields */}
              {metric !== 'minkowski' && (
                <div className="grid grid-cols-2 gap-4 bg-slate-950/50 p-4 border border-slate-900/60 rounded-lg">
                  {metric === 'schwarzschild' && (
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Mass Parameter (M)</label>
                      <input 
                        type="number"
                        value={params.M}
                        onChange={(e) => updateParam('M', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 focus:border-violet-500 rounded-lg px-3 py-1.5 text-sm text-slate-200 outline-none"
                      />
                    </div>
                  )}

                  {metric === 'flrw' && (
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Hubble Parameter (H)</label>
                      <input 
                        type="number"
                        step="0.01"
                        value={params.H}
                        onChange={(e) => updateParam('H', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 focus:border-violet-500 rounded-lg px-3 py-1.5 text-sm text-slate-200 outline-none"
                      />
                    </div>
                  )}

                  {metric === 'kerr' && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Mass (M)</label>
                        <input 
                          type="number"
                          value={params.M}
                          onChange={(e) => updateParam('M', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 focus:border-violet-500 rounded-lg px-3 py-1.5 text-sm text-slate-200 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Spin Parameter (a)</label>
                        <input 
                          type="number"
                          step="0.01"
                          value={params.a}
                          onChange={(e) => updateParam('a', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 focus:border-violet-500 rounded-lg px-3 py-1.5 text-sm text-slate-200 outline-none"
                        />
                      </div>
                    </>
                  )}

                  {metric === 'custom' && (
                    <div className="col-span-2 space-y-3">
                      <div className="flex items-center gap-2 border-b border-slate-900 pb-1.5 mb-1.5">
                        <Sliders className="w-3.5 h-3.5 text-violet-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Diagonal Metric Components</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 mb-1">g_tt</label>
                          <input 
                            type="text"
                            value={params.tt}
                            onChange={(e) => updateParam('tt', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-850 focus:border-violet-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 mb-1">g_rr</label>
                          <input 
                            type="text"
                            value={params.rr}
                            onChange={(e) => updateParam('rr', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-850 focus:border-violet-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 mb-1">g_θθ</label>
                          <input 
                            type="text"
                            value={params.θθ}
                            onChange={(e) => updateParam('θθ', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-850 focus:border-violet-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 mb-1">g_ϕϕ</label>
                          <input 
                            type="text"
                            value={params.ϕϕ}
                            onChange={(e) => updateParam('ϕϕ', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-850 focus:border-violet-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none font-mono"
                          />
                        </div>
                      </div>
                      <div className="flex gap-3 pt-1 border-t border-slate-900/60 mt-1">
                        <div>
                          <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Mass (M)</label>
                          <input type="text" value={params.M} onChange={(e) => updateParam('M', e.target.value)} className="w-16 bg-slate-950/80 border border-slate-850 focus:border-violet-500 rounded px-1.5 py-0.5 text-xs text-slate-400 outline-none" />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Hubble (H)</label>
                          <input type="text" value={params.H} onChange={(e) => updateParam('H', e.target.value)} className="w-16 bg-slate-950/80 border border-slate-850 focus:border-violet-500 rounded px-1.5 py-0.5 text-xs text-slate-400 outline-none" />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">Spin (a)</label>
                          <input type="text" value={params.a} onChange={(e) => updateParam('a', e.target.value)} className="w-16 bg-slate-950/80 border border-slate-850 focus:border-violet-500 rounded px-1.5 py-0.5 text-xs text-slate-400 outline-none" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Coordinates Point Input */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Evaluation Coordinate Point (x^μ)</label>
                <div className="grid grid-cols-4 gap-2 bg-slate-950/30 p-2.5 border border-slate-900 rounded-lg">
                  {coords.map((c, i) => (
                    <div key={i} className="text-center">
                      <div className="flex justify-between px-1 mb-0.5">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">x^{i}</span>
                        <KaTeX math={coordNames[i]} className="text-[10px] text-violet-400" />
                      </div>
                      <input 
                        type="text"
                        value={c}
                        onChange={(e) => {
                          const newCoords = [...coords];
                          newCoords[i] = e.target.value;
                          setCoords(newCoords);
                        }}
                        className="w-full bg-slate-950 border border-slate-850 focus:border-violet-500 rounded px-2 py-1 text-xs text-slate-200 outline-none text-center font-mono"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Auxiliary Tensors & Vectors */}
          <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-5 backdrop-blur-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-violet-400" />
                <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-300">2. Custom Workspace Tensors</h2>
              </div>
              <button 
                onClick={addCustomVector}
                className="flex items-center gap-1 text-[11px] font-bold text-cyan-400 bg-cyan-950/30 border border-cyan-900/60 rounded px-2 py-1 hover:bg-cyan-950/60 hover:text-cyan-300 transition"
              >
                <Plus className="w-3 h-3" /> Add Tensor
              </button>
            </div>

            {/* Custom Tensors List */}
            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
              {customVectors.map((v, vIdx) => (
                <div key={vIdx} className="bg-slate-950/60 border border-slate-900 rounded-lg p-3 relative space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-900 pb-1.5 gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 text-sm font-bold text-slate-300">
                      <span className="text-[10px] text-slate-500 font-medium uppercase">{v.indices.length === 1 ? 'Vector' : `Rank-${v.indices.length}`}</span>
                      <KaTeX math={getTensorIndicesLatex(v)} className="text-violet-400 ml-1 font-mono font-bold" />
                      
                      {/* Inline Renaming Input */}
                      <input
                        type="text"
                        value={v.name}
                        onChange={(e) => renameVector(vIdx, e.target.value)}
                        className="w-8 ml-2 bg-slate-900/50 border border-slate-805 text-xs font-bold text-violet-400 font-mono focus:bg-slate-950 focus:border-violet-500 rounded px-1 outline-none text-center"
                        maxLength={3}
                        title="Rename this tensor (alphanumeric and ' characters only)"
                      />
                    </div>
                    
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Rank Selection */}
                      <select
                        value={v.indices.length === 1 ? 'vector' : `rank-${v.indices.length}`}
                        onChange={(e) => updateVectorRank(vIdx, e.target.value)}
                        className="bg-slate-900 border border-slate-800 text-[10px] font-semibold text-slate-400 rounded px-1.5 py-0.5 outline-none focus:border-violet-500 transition cursor-pointer"
                      >
                        <option value="vector">Rank-1 Vector</option>
                        <option value="rank-2">Rank-2 Matrix</option>
                        <option value="rank-3">Rank-3 Tensor (3D)</option>
                        <option value="rank-4">Rank-4 Tensor (4D)</option>
                      </select>

                      {/* Index Configuration */}
                      <div className="flex items-center gap-1 bg-slate-900 border border-slate-850 rounded p-0.5">
                        {v.indices.map((isContra, indexPos) => {
                          const symbols = ['μ', 'ν', 'ρ', 'σ', 'λ', 'κ'];
                          const idxSymbol = symbols[indexPos] ?? `i_${indexPos}`;
                          return (
                            <button
                              key={indexPos}
                              onClick={() => updateVectorIndexToggle(vIdx, indexPos)}
                              className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded transition ${
                                isContra 
                                  ? 'bg-violet-950/40 text-violet-400 border border-violet-900/30' 
                                  : 'bg-cyan-950/40 text-cyan-400 border border-cyan-900/20'
                              }`}
                              title={`Toggle index ${idxSymbol} between contravariant (upper) and covariant (lower)`}
                            >
                              {idxSymbol}:{isContra ? '^' : '_'}
                            </button>
                          );
                        })}
                      </div>

                      <button 
                        onClick={() => removeCustomVector(vIdx)}
                        className="text-slate-650 hover:text-red-400 transition pl-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Slice Index Selectors for Rank-3 and Rank-4 */}
                  {v.indices.length === 3 && (
                    <div className="flex items-center justify-between bg-slate-950/60 p-2 border border-slate-900/80 rounded text-xs gap-2">
                      <span className="text-slate-500 font-bold uppercase text-[9px] tracking-wider flex items-center gap-1">
                        Slice 1st Index (<KaTeX math="\mu" />):
                      </span>
                      <div className="flex gap-1">
                        {[0, 1, 2, 3].map((idxVal) => (
                          <button
                            key={idxVal}
                            onClick={() => updateVectorSlice(vIdx, 0, idxVal)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                              (v.slices?.[0] ?? 0) === idxVal
                                ? 'bg-violet-950/45 text-violet-400 border-violet-900/85'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                            }`}
                          >
                            <KaTeX math={coordNames[idxVal] || String(idxVal)} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {v.indices.length === 4 && (
                    <div className="space-y-1.5 bg-slate-950/60 p-2 border border-slate-900/80 rounded text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-bold uppercase text-[9px] tracking-wider flex items-center gap-1">
                          Slice 1st Index (<KaTeX math="\mu" />):
                        </span>
                        <div className="flex gap-1">
                          {[0, 1, 2, 3].map((idxVal) => (
                            <button
                              key={idxVal}
                              onClick={() => updateVectorSlice(vIdx, 0, idxVal)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                                (v.slices?.[0] ?? 0) === idxVal
                                  ? 'bg-violet-950/45 text-violet-400 border-violet-900/85'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                              }`}
                            >
                              <KaTeX math={coordNames[idxVal] || String(idxVal)} />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-bold uppercase text-[9px] tracking-wider flex items-center gap-1">
                          Slice 2nd Index (<KaTeX math="\nu" />):
                        </span>
                        <div className="flex gap-1">
                          {[0, 1, 2, 3].map((idxVal) => (
                            <button
                              key={idxVal}
                              onClick={() => updateVectorSlice(vIdx, 1, idxVal)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                                (v.slices?.[1] ?? 0) === idxVal
                                  ? 'bg-violet-950/45 text-violet-400 border-violet-900/85'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                              }`}
                            >
                              <KaTeX math={coordNames[idxVal] || String(idxVal)} />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Component Inputs Grid */}
                  {v.indices.length === 1 ? (
                    <div className="grid grid-cols-4 gap-2">
                      {v.data.slice(0, 4).map((cVal, cIdx) => (
                        <div key={cIdx}>
                          <div className="text-[9px] text-slate-600 font-bold uppercase mb-0.5 text-center">
                            {coordNames[cIdx] ? <KaTeX math={coordNames[cIdx]} /> : cIdx}
                          </div>
                          <input 
                            type="text"
                            value={cVal}
                            onChange={(e) => updateVectorComponent(vIdx, cIdx, e.target.value)}
                            className="w-full bg-slate-950 border border-slate-900 focus:border-violet-500 rounded px-1.5 py-1 text-xs text-slate-200 text-center font-mono outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-1.5 bg-slate-950/40 p-2 rounded border border-slate-900/60">
                      <div className="grid grid-cols-5 gap-1.5 text-center border-b border-slate-900/40 pb-1 mb-1">
                        <div className="text-[9px] text-slate-600 font-bold uppercase">
                          <KaTeX math={v.indices.length === 2 ? '\\mu \\backslash \\nu' : v.indices.length === 3 ? '\\nu \\backslash \\rho' : '\\rho \\backslash \\sigma'} />
                        </div>
                        {coordNames.map((cName, cIdx) => (
                          <div key={cIdx} className="text-[9px] text-slate-500 font-bold uppercase">
                            <KaTeX math={cName} />
                          </div>
                        ))}
                      </div>
                      {[0, 1, 2, 3].map((rIdx) => (
                        <div key={rIdx} className="grid grid-cols-5 gap-1.5 items-center">
                          <div className="text-[10px] text-slate-500 font-bold text-center">
                            <KaTeX math={coordNames[rIdx]} />
                          </div>
                          {[0, 1, 2, 3].map((cIdx) => {
                            const flatIdx = getTensorFlatIndex(v, rIdx, cIdx);
                            return (
                              <input 
                                key={cIdx}
                                type="text"
                                value={v.data[flatIdx] || '0.0'}
                                onChange={(e) => updateVectorComponent(vIdx, flatIdx, e.target.value)}
                                className="w-full bg-slate-950 border border-slate-900 focus:border-violet-500 rounded px-1 py-1 text-[11px] text-slate-200 text-center font-mono outline-none"
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {customVectors.length === 0 && (
                <div className="text-center py-6 text-xs text-slate-600 font-medium">
                  No custom tensors defined. Use the button to add.
                </div>
              )}
            </div>
          </div>

          {/* Card 3: Expression Editor */}
          <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-5 backdrop-blur-sm relative overflow-hidden flex-1 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <FileCode className="w-4 h-4 text-violet-400" />
              <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-300">3. Tensor Calculation Equation</h2>
            </div>

            {/* Inserter Toolbar */}
            <div className="flex flex-wrap gap-1 bg-slate-950/80 p-2 border border-slate-900 rounded-t-lg">
              <span className="text-[10px] text-slate-500 font-bold uppercase self-center px-1.5">Insert:</span>
              {['μ', 'ν', 'α', 'β', 'γ', 'δ', 'ρ', 'σ', 'λ', 'Γ', 'Λ'].map((char) => (
                <button 
                  key={char}
                  onClick={() => insertIndex(char)}
                  className="bg-slate-900 hover:bg-slate-800 text-slate-300 font-mono text-xs px-2 py-1 rounded transition border border-slate-850 hover:border-slate-700 hover:text-white"
                >
                  {char}
                </button>
              ))}
              <div className="w-[1px] bg-slate-900 mx-1" />
              <button 
                onClick={() => insertIndex('{^}')}
                className="bg-slate-900 hover:bg-slate-800 text-violet-400 font-mono text-xs px-2 py-1 rounded transition border border-slate-850 hover:border-violet-600/30"
              >
                ^upper
              </button>
              <button 
                onClick={() => insertIndex('{_}')}
                className="bg-slate-900 hover:bg-slate-800 text-violet-400 font-mono text-xs px-2 py-1 rounded transition border border-slate-850 hover:border-violet-600/30"
              >
                _lower
              </button>
            </div>

            {/* Code Input */}
            <div className="relative flex-1 flex flex-col">
              <textarea 
                id="expr-editor"
                value={expression}
                onChange={(e) => setExpression(e.target.value)}
                placeholder="e.g., v_ν = g{_μ _ν} v{^μ}"
                className="w-full flex-1 min-h-24 bg-slate-950 border-x border-b border-slate-900 focus:border-violet-500 rounded-b-lg p-3 font-mono text-sm text-slate-200 outline-none resize-none transition"
              />
            </div>

            <div className="mt-3 flex justify-between text-[11px] text-slate-500 font-medium leading-relaxed">
              <div className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-slate-500" />
                <span>Base tensors in scope: <code className="text-violet-400 font-mono">g, ig, Γ, R, Ric, G</code></span>
              </div>
            </div>
          </div>
        </section>

        {/* Right Column - Results & Inspectors (7 Cols) */}
        <section className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Card 4: Contraction Output */}
          <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-6 backdrop-blur-sm relative min-h-64 flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-300">Contraction Result</h2>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex-1 flex items-center justify-center p-4">
                <div className="bg-red-950/30 border border-red-900/50 rounded-xl p-4 text-red-200 text-sm max-w-md w-full flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Computation Error</span>
                    <p className="text-xs text-red-300 mt-1 leading-relaxed font-mono whitespace-pre-wrap">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Loading Indicator */}
            {loading && !error && (
              <div className="flex-1 flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-violet-500/20 border-t-violet-500 animate-spin" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Evaluating Tensors in Julia...</span>
              </div>
            )}

            {/* Result Displays */}
            {!loading && !error && result && (
              <div className="flex-1 flex flex-col justify-between gap-6">
                
                {/* Result Equation in large Math format */}
                <div className="bg-slate-950/60 border border-slate-900 rounded-xl p-6 flex flex-col items-center justify-center min-h-[140px] text-center overflow-x-auto relative">
                  <div className="absolute top-2 left-3 bg-violet-950/30 border border-violet-900/40 rounded px-2 py-0.5 text-[10px] text-violet-400 font-bold uppercase tracking-wider">
                    LaTeX Matrix Equation
                  </div>
                  <div className="py-4 text-xl">
                    <KaTeX math={`${result.latex_lhs} = ${result.latex_rhs}`} block />
                  </div>
                </div>

                {/* Non-Zero Component Breakdowns */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-cyan-400" />
                    Non-Zero Coordinates Components
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {result.components_latex && result.components_latex.length > 0 ? (
                      result.components_latex.map((comp: string, i: number) => (
                        <div key={i} className="bg-slate-950/80 border border-slate-900/60 rounded-lg p-2.5 text-center flex items-center justify-center">
                          <KaTeX math={comp} className="text-xs font-mono" />
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full py-4 text-center text-xs text-slate-500">
                        All coordinate components are zero.
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}

            {!loading && !error && !result && (
              <div className="flex-1 flex items-center justify-center py-12 text-slate-500 text-xs font-medium">
                Click "Run Engine" to calculate the contraction.
              </div>
            )}
          </div>

          {/* Card 5: Active Workspace Inspector */}
          <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-5 backdrop-blur-sm flex-1 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="w-4 h-4 text-violet-400" />
              <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-300">Base Workspace Tensors</h2>
            </div>

            {/* Grid of Selector buttons */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-5">
              {[
                { key: 'g', label: 'g_{μν}', desc: 'Metric' },
                { key: 'ig', label: 'g^{μν}', desc: 'Inverse' },
                { key: 'Γ', label: 'Γ^λ_{μν}', desc: 'Christoffel' },
                { key: 'R', label: 'R^ρ_{σμν}', desc: 'Riemann' },
                { key: 'Ric', label: 'R_{μν}', desc: 'Ricci' },
                { key: 'G', label: 'G_{μν}', desc: 'Einstein' }
              ].map((item) => (
                <button 
                  key={item.key}
                  onClick={() => setActiveInspector(item.key)}
                  className={`border px-2 py-3 rounded-lg flex flex-col items-center justify-center text-center transition ${
                    activeInspector === item.key 
                      ? 'bg-violet-950/20 border-violet-500 shadow-md shadow-violet-500/5' 
                      : 'bg-slate-950/40 border-slate-900 hover:border-slate-800 hover:bg-slate-950/80'
                  }`}
                >
                  <span className="font-bold text-xs text-slate-200">
                    <KaTeX math={item.label} />
                  </span>
                  <span className="text-[9px] text-slate-500 font-medium uppercase mt-0.5 tracking-wider">{item.desc}</span>
                </button>
              ))}
            </div>

            {/* Inspector display */}
            <div className="flex-1 flex flex-col bg-slate-950/80 border border-slate-900 rounded-lg p-5">
              {!loading && result && result.workspace_tensors && activeInspector && result.workspace_tensors[activeInspector] ? (
                <div className="flex-1 flex flex-col justify-between gap-5">
                  <div>
                    {/* Header */}
                    <div className="flex justify-between items-start border-b border-slate-900 pb-3 mb-4">
                      <div>
                        <h3 className="font-bold text-sm tracking-wide text-slate-200 uppercase flex items-center gap-1.5">
                          <Layers className="w-4 h-4 text-violet-400" />
                          Tensor {activeInspector} at evaluation point
                        </h3>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                          Indices: [
                          {result.workspace_tensors[activeInspector].indices.map((idx: any, idxI: number) => (
                            <span key={idxI} className="font-mono text-violet-400">
                              {idx.is_contravariant ? '^' : '_'}{idx.name}
                              {idxI < result.workspace_tensors[activeInspector].indices.length - 1 && ', '}
                            </span>
                          ))}
                          ]
                        </p>
                      </div>
                      
                      <div className="bg-violet-950/30 border border-violet-900/40 rounded px-2.5 py-1 text-[10px] text-violet-400 font-bold uppercase tracking-wider font-mono">
                        <KaTeX math={result.workspace_tensors[activeInspector].lhs} />
                      </div>
                    </div>

                    {/* Matrix display */}
                    <div className="bg-slate-900/30 border border-slate-900 rounded-lg p-4 flex items-center justify-center overflow-x-auto min-h-24 max-h-36">
                      <KaTeX math={result.workspace_tensors[activeInspector].rhs} block />
                    </div>
                  </div>

                  {/* Components List */}
                  <div>
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                      <ChevronRight className="w-3.5 h-3.5 text-violet-400" /> Non-Zero Components
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-40 overflow-y-auto pr-1">
                      {result.workspace_tensors[activeInspector].components && result.workspace_tensors[activeInspector].components.length > 0 ? (
                        result.workspace_tensors[activeInspector].components.map((c: string, cI: number) => (
                          <div key={cI} className="bg-slate-950 border border-slate-900 rounded px-2 py-1.5 text-center">
                            <KaTeX math={c} className="text-xs font-mono" />
                          </div>
                        ))
                      ) : (
                        <div className="col-span-full py-4 text-center text-xs text-slate-600 font-medium">
                          All components are zero.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-600 py-12">
                  {loading ? (
                    <>
                      <div className="w-6 h-6 rounded-full border-2 border-violet-500/10 border-t-violet-500 animate-spin mb-2" />
                      <span className="text-xs">Loading workspace details...</span>
                    </>
                  ) : (
                    <>
                      <Info className="w-8 h-8 text-slate-800 mb-2" />
                      <span className="text-xs font-medium">Run a calculation to inspect GR tensors.</span>
                    </>
                  )}
                </div>
              )}
            </div>

          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/60 py-4 px-6 text-center text-[10px] text-slate-600 font-medium tracking-wide uppercase">
        Powered by Julia & Next.js
      </footer>
    </div>
  );
}
