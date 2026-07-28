'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Play, Pause, StepForward, ShieldAlert, CheckCircle, RefreshCw, Cpu, Layers, Tag, Image as ImageIcon, ArrowLeft } from 'lucide-react';

interface NodeState {
  id: string;
  label: string;
  type: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  hasBreakpoint: boolean;
}

interface ClassificationLog {
  id: string;
  cluster_id: string;
  image_url: string;
  image_filename: string;
  predicted_category: string;
  predicted_tags: string[];
  confidence: number;
  model_name: string;
  timestamp: string;
  status: 'pending_review' | 'approved' | 'corrected' | 'rejected';
  admin_feedback?: {
    corrected_category?: string;
    corrected_tags?: string[];
    reviewer_notes?: string;
    reviewed_at: string;
  };
}

export default function OrcaDebugPage() {
  const [debugState, setDebugState] = useState<{
    status: string;
    current_node_id: string | null;
    step_index: number;
    breakpoints: string[];
    logs: { timestamp: string; level: string; message: string }[];
  }>({
    status: 'idle',
    current_node_id: null,
    step_index: 0,
    breakpoints: ['node-classification-02', 'node-human-approval-04'],
    logs: [],
  });

  const [classificationLogs, setClassificationLogs] = useState<ClassificationLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedLog, setSelectedLog] = useState<ClassificationLog | null>(null);
  const [editCategory, setEditCategory] = useState<string>('');
  const [editTags, setEditTags] = useState<string>('');

  const nodesList: NodeState[] = [
    { id: 'node-drive-fetch-01', label: '1. Drive Photo Ingestion', type: 'orca.worker', status: getStepStatus('node-drive-fetch-01', 0), hasBreakpoint: debugState.breakpoints.includes('node-drive-fetch-01') },
    { id: 'node-classification-02', label: '2. Vision AI & Cluster Classification', type: 'orca.decision', status: getStepStatus('node-classification-02', 1), hasBreakpoint: debugState.breakpoints.includes('node-classification-02') },
    { id: 'node-human-approval-04', label: '3. Human Admin Review & Overrides', type: 'orca.approval', status: getStepStatus('node-human-approval-04', 2), hasBreakpoint: debugState.breakpoints.includes('node-human-approval-04') },
    { id: 'node-odoo-sync-05', label: '4. Odoo Consumable Sync', type: 'orca.validation', status: getStepStatus('node-odoo-sync-05', 3), hasBreakpoint: debugState.breakpoints.includes('node-odoo-sync-05') },
    { id: 'node-qa-evidence-06', label: '5. Selenium Profile 9 QA', type: 'orca.test', status: getStepStatus('node-qa-evidence-06', 4), hasBreakpoint: debugState.breakpoints.includes('node-qa-evidence-06') },
  ];

  function getStepStatus(nodeId: string, nodeIndex: number): 'pending' | 'running' | 'paused' | 'completed' | 'failed' {
    if (debugState.current_node_id === nodeId) {
      return debugState.status === 'paused_at_breakpoint' ? 'paused' : 'running';
    }
    if (nodeIndex < debugState.step_index) return 'completed';
    return 'pending';
  }

  const fetchDebugState = async () => {
    try {
      const res = await fetch('/api/orca/execution');
      if (res.ok) {
        const data = await res.json();
        setDebugState(data);
      }
    } catch (e) {
      console.error('Failed to fetch debug state', e);
    }
  };

  const fetchClassificationLogs = async () => {
    try {
      const res = await fetch('/api/orca/classification-logs');
      if (res.ok) {
        const data = await res.json();
        setClassificationLogs(data.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch classification logs', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDebugState();
    fetchClassificationLogs();
    const interval = setInterval(fetchDebugState, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleControl = async (action: string, extraData: any = {}) => {
    try {
      const res = await fetch('/api/orca/execution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extraData }),
      });
      if (res.ok) {
        fetchDebugState();
      }
    } catch (e) {
      console.error(`Failed to trigger control action: ${action}`, e);
    }
  };

  const handleReviewLog = async (id: string, status: 'approved' | 'corrected' | 'rejected') => {
    try {
      const res = await fetch('/api/orca/classification-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'review',
          id,
          status,
          corrected_category: editCategory || undefined,
          corrected_tags: editTags ? editTags.split(',').map((t) => t.trim()) : undefined,
          reviewer_notes: 'Reviewed in Admin Orca Debugger',
        }),
      });
      if (res.ok) {
        fetchClassificationLogs();
        setSelectedLog(null);
        setEditCategory('');
        setEditTags('');
      }
    } catch (e) {
      console.error('Failed to submit classification review', e);
    }
  };

  const approvedCount = classificationLogs.filter((l) => l.status === 'approved' || l.status === 'corrected').length;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 md:p-10 font-sans">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-6 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/admin/dashboard" className="text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl md:text-3xl font-serif text-amber-400 flex items-center gap-3">
              <Cpu className="w-8 h-8 text-amber-400" /> Orca Workflow Debugger & AI Feedback
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Client Tenant: <strong className="text-amber-400 font-semibold">Galantes Jewelry (galantesjewelry)</strong> | Role: <span className="text-slate-300 font-medium">Tenant Admin</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            Tenant: galantesjewelry
          </div>
          <div className="px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            Engine: {debugState.status}
          </div>
          <button
            onClick={() => { fetchDebugState(); fetchClassificationLogs(); }}
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
            title="Refresh state"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Debugger Controls & Visual Nodes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
        {/* Node Pipeline Control */}
        <div className="lg:col-span-2 bg-slate-800/80 border border-slate-700 rounded-xl p-6 shadow-xl">
          <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-amber-400" /> Node Execution Graph & Breakpoints
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleControl('start')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-lg shadow-emerald-900/30"
              >
                <Play className="w-4 h-4" /> Start Debug
              </button>
              <button
                onClick={() => handleControl('step')}
                disabled={debugState.status === 'completed'}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 shadow-lg shadow-amber-900/30"
              >
                <StepForward className="w-4 h-4" /> Step Next Node
              </button>
              <button
                onClick={() => handleControl('resume')}
                disabled={debugState.status !== 'paused_at_breakpoint'}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <Play className="w-4 h-4" /> Resume Execution
              </button>
            </div>
          </div>

          {/* Node Cards List */}
          <div className="space-y-4">
            {nodesList.map((node) => (
              <div
                key={node.id}
                className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                  node.status === 'running'
                    ? 'bg-amber-500/10 border-amber-500/50 text-white shadow-lg shadow-amber-950/40 ring-1 ring-amber-500/30'
                    : node.status === 'paused'
                    ? 'bg-red-500/10 border-red-500/50 text-white animate-pulse'
                    : node.status === 'completed'
                    ? 'bg-slate-800 border-emerald-500/40 text-slate-200'
                    : 'bg-slate-900/50 border-slate-800 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    onClick={() => handleControl('toggle_breakpoint', { node_id: node.id })}
                    className={`cursor-pointer px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                      node.hasBreakpoint
                        ? 'bg-red-600 text-white shadow-md shadow-red-900/50'
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }`}
                    title="Click to toggle Breakpoint"
                  >
                    {node.hasBreakpoint ? '● STOP BREAKPOINT' : '○ NO STOP'}
                  </div>

                  <div>
                    <h3 className="font-semibold text-sm text-white">{node.label}</h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">Type: {node.type} | ID: {node.id}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {node.status === 'completed' && (
                    <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" /> Done
                    </span>
                  )}
                  {node.status === 'paused' && (
                    <span className="text-red-400 text-xs font-semibold flex items-center gap-1">
                      <Pause className="w-4 h-4" /> Paused at Breakpoint
                    </span>
                  )}
                  {node.status === 'running' && (
                    <span className="text-amber-400 text-xs font-semibold flex items-center gap-1">
                      <RefreshCw className="w-4 h-4 animate-spin" /> Executing...
                    </span>
                  )}
                  {node.status === 'pending' && (
                    <span className="text-slate-500 text-xs">Pending</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Real-time execution logs */}
          <div className="mt-8 border-t border-slate-700 pt-6">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" /> Execution Terminal Log Output
            </h3>
            <div className="bg-black/80 rounded-lg p-4 font-mono text-xs text-slate-300 max-h-48 overflow-y-auto space-y-1.5 border border-slate-800">
              {debugState.logs.length === 0 ? (
                <p className="text-slate-600 italic">No execution logs recorded yet. Press "Start Debug" to begin.</p>
              ) : (
                debugState.logs.map((log, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-slate-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                    <span className={log.level === 'warn' ? 'text-amber-400 font-bold' : log.level === 'error' ? 'text-red-400 font-bold' : 'text-emerald-400'}>
                      {log.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* LM Training Feedback Counter & Quick Info */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-amber-500/10 via-slate-800 to-slate-900 border border-amber-500/30 rounded-xl p-6 shadow-xl">
            <h3 className="text-base font-semibold text-amber-400 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-amber-400" /> LM Vision Feedback Dataset
            </h3>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Every classification approved or corrected by the admin is automatically added to the Few-Shot LM context to optimize future Vision AI decisions.
            </p>
            <div className="mt-6 flex items-baseline justify-between border-t border-amber-500/20 pt-4">
              <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">LM Feedback Dataset:</span>
              <span className="text-2xl font-bold font-serif text-white">{approvedCount} Examples</span>
            </div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-semibold text-slate-200">How to Assist Bot Decisions:</h3>
            <ul className="text-xs text-slate-400 space-y-2.5 list-disc list-inside leading-relaxed">
              <li>Set a <strong className="text-red-400">Stop Breakpoint</strong> on the Classification node.</li>
              <li>When execution pauses, review AI predicted categories and tags.</li>
              <li>Click <strong className="text-amber-400">Edit / Correct</strong> to override errors.</li>
              <li>The updated labels train the LLM system prompt context automatically for higher precision.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Image Classification Log & Feedback Review Table */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-6 shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-amber-400" /> Vision AI Image Classification & Feedback Log
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Review and correct AI node predictions to feed back into the model prompt context
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400">Loading classification logs...</div>
        ) : classificationLogs.length === 0 ? (
          <div className="py-12 text-center text-slate-500 italic">No image classification logs found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Cluster / File</th>
                  <th className="py-3 px-4">AI Prediction</th>
                  <th className="py-3 px-4">Tags</th>
                  <th className="py-3 px-4">Confidence</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {classificationLogs.map((log) => {
                  const isEditing = selectedLog?.id === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-slate-700/30 transition-colors">
                        <td className="py-4 px-4">
                          <div className="font-semibold text-white font-mono">{log.cluster_id}</div>
                          <div className="text-xs text-slate-400">{log.image_filename}</div>
                        </td>
                        <td className="py-4 px-4 font-semibold text-amber-300">
                          {log.admin_feedback?.corrected_category || log.predicted_category}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex flex-wrap gap-1">
                            {(log.admin_feedback?.corrected_tags || log.predicted_tags).map((t, idx) => (
                              <span key={idx} className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-xs">
                                {t}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500"
                                style={{ width: `${Math.round(log.confidence * 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono font-bold text-emerald-400">
                              {Math.round(log.confidence * 100)}%
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                              log.status === 'approved'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : log.status === 'corrected'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : log.status === 'rejected'
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleReviewLog(log.id, 'approved')}
                              className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded text-xs font-semibold transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                setSelectedLog(isEditing ? null : log);
                                setEditCategory(log.admin_feedback?.corrected_category || log.predicted_category);
                                setEditTags((log.admin_feedback?.corrected_tags || log.predicted_tags).join(', '));
                              }}
                              className="px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600 text-amber-400 hover:text-white rounded text-xs font-semibold transition-colors"
                            >
                              {isEditing ? 'Cancel' : 'Edit / Correct'}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Edit Inline Row */}
                      {isEditing && (
                        <tr className="bg-amber-500/5 border-l-4 border-amber-500">
                          <td colSpan={6} className="p-4">
                            <div className="space-y-4">
                              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                                Admin Label Correction (Train LM Prompt)
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Corrected Category</label>
                                  <input
                                    type="text"
                                    value={editCategory}
                                    onChange={(e) => setEditCategory(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                                    placeholder="e.g. Rings, Necklaces"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Corrected Tags (comma separated)</label>
                                  <input
                                    type="text"
                                    value={editTags}
                                    onChange={(e) => setEditTags(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                                    placeholder="e.g. 18K Gold, Layered"
                                  />
                                </div>
                              </div>
                              <div className="flex justify-end gap-3 pt-2">
                                <button
                                  onClick={() => setSelectedLog(null)}
                                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-xs font-semibold"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleReviewLog(log.id, 'corrected')}
                                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold shadow-lg shadow-amber-900/40"
                                >
                                  Save Correction & Train LM
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
