'use client';

import React, { useState, useRef } from 'react';

interface ImportProgress {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

export default function ProductImportUpload() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xml')) {
      setError('Please select an XML file');
      return;
    }

    await uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    try {
      setLoading(true);
      setError(null);
      setProgress(null);

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/admin/import/products', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setError(data.error || 'Import failed');
        return;
      }

      setProgress(data.progress);
    } catch (err) {
      setError(`Upload error: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const getProgressPercentage = () => {
    if (!progress || progress.total === 0) return 0;
    return (progress.processed / progress.total) * 100;
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-bold mb-2 text-slate-800">
          Import Products from XML
        </h2>
        <p className="text-slate-600 mb-6">
          Upload your product export file (exportProduct_*.xml)
        </p>

        {/* File Upload Area */}
        <div
          onClick={handleClick}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            loading
              ? 'border-slate-300 bg-slate-50 cursor-not-allowed'
              : 'border-slate-300 hover:border-amber-500 hover:bg-amber-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xml"
            onChange={handleFileSelect}
            disabled={loading}
            className="hidden"
          />

          <svg
            className="w-12 h-12 mx-auto mb-3 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>

          <p className="text-slate-700 font-semibold mb-1">
            {loading ? 'Importing...' : 'Click to select XML file'}
          </p>
          <p className="text-slate-500 text-sm">
            or drag and drop your file here
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 font-semibold">Error</p>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* Progress */}
        {progress && (
          <div className="mt-6 space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-slate-700 font-semibold">Import Progress</span>
                <span className="text-slate-600 text-sm">
                  {progress.processed} / {progress.total}
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-amber-500 h-full transition-all duration-300"
                  style={{ width: `${getProgressPercentage()}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <p className="text-green-700 font-semibold text-lg">
                  {progress.successful}
                </p>
                <p className="text-green-600 text-sm">Successful</p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <p className="text-red-700 font-semibold text-lg">
                  {progress.failed}
                </p>
                <p className="text-red-600 text-sm">Failed</p>
              </div>
              <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                <p className="text-amber-700 font-semibold text-lg">
                  {progress.total}
                </p>
                <p className="text-amber-600 text-sm">Total</p>
              </div>
            </div>

            {/* Errors */}
            {progress.errors.length > 0 && (
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <p className="text-yellow-700 font-semibold mb-2">
                  Errors ({progress.errors.length})
                </p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {progress.errors.slice(0, 5).map((err, i) => (
                    <p key={i} className="text-yellow-600 text-xs">
                      Row {err.row}: {err.error}
                    </p>
                  ))}
                  {progress.errors.length > 5 && (
                    <p className="text-yellow-600 text-xs">
                      ... and {progress.errors.length - 5} more errors
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Info */}
        <div className="mt-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
          <p className="text-slate-700 font-semibold mb-2">Import Settings</p>
          <ul className="text-slate-600 text-sm space-y-1">
            <li>✓ Price Column: <code className="bg-slate-100 px-2 py-1 rounded">Price11763</code></li>
            <li>✓ Buy Price: Calculated as Price ÷ 1.20</li>
            <li>✓ Profit Margin: 20%</li>
            <li>✓ Stock: Default 1 unit per warehouse</li>
            <li>✓ Categories: Auto-created if not exists (case-sensitive)</li>
            <li>✓ Images: Stored as URLs</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
