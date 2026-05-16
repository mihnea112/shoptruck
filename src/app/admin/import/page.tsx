import ProductImportUpload from '@/components/admin/ProductImportUpload';

export default function ImportPage() {
  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Product Management</h1>
        <p className="text-slate-600 mb-8">Import products from XML export file</p>

        <ProductImportUpload />

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Import Guide */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">How to Import</h3>
            <ol className="space-y-3 text-slate-700">
              <li className="flex">
                <span className="font-semibold text-amber-600 mr-3">1.</span>
                <span>Export your products as XML from your source system</span>
              </li>
              <li className="flex">
                <span className="font-semibold text-amber-600 mr-3">2.</span>
                <span>Upload the XML file using the form above</span>
              </li>
              <li className="flex">
                <span className="font-semibold text-amber-600 mr-3">3.</span>
                <span>Monitor the import progress in real-time</span>
              </li>
              <li className="flex">
                <span className="font-semibold text-amber-600 mr-3">4.</span>
                <span>Review any errors and retry if needed</span>
              </li>
            </ol>
          </div>

          {/* Supported Fields */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Imported Fields</h3>
            <ul className="space-y-2 text-slate-700 text-sm">
              <li>✓ Product Code (SKU)</li>
              <li>✓ Product Name</li>
              <li>✓ Description & Details</li>
              <li>✓ Category (with hierarchy)</li>
              <li>✓ Brand</li>
              <li>✓ Pricing (Price11763)</li>
              <li>✓ EAN Codes</li>
              <li>✓ Product Images</li>
              <li>✓ VAT / Tax Rate</li>
              <li>✓ Stock Level</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
