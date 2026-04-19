import { useState } from 'react';
import { Plus, Trash2, Copy } from 'lucide-react';

export default function GeoJsonEditor() {
  const [geoJson, setGeoJson] = useState({
    type: 'FeatureCollection',
    features: [],
  });
  const [jsonText, setJsonText] = useState(JSON.stringify(geoJson, null, 2));

  const handleJsonChange = (e) => {
    setJsonText(e.target.value);
  };

  const validateAndParse = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setGeoJson(parsed);
      return true;
    } catch (err) {
      alert('Invalid JSON: ' + err.message);
      return false;
    }
  };

  const addFeature = () => {
    const newFeature = {
      type: 'Feature',
      properties: { name: 'New Ward' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[77.0, 28.0], [77.1, 28.0], [77.1, 28.1], [77.0, 28.1], [77.0, 28.0]]],
      },
    };
    const updated = { ...geoJson, features: [...geoJson.features, newFeature] };
    setGeoJson(updated);
    setJsonText(JSON.stringify(updated, null, 2));
  };

  return (
    <div className="space-y-6 page-enter">
      <div>
        <h2 className="text-2xl font-public-sans font-bold text-avenue-on-surface">Ward GeoJSON Editor</h2>
        <p className="text-avenue-on-surface-variant text-sm mt-1">Define and manage geographic wards and areas</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Editor Panel */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-title-medium font-public-sans font-bold">GeoJSON</h3>
            <button
              onClick={addFeature}
              className="btn-secondary text-sm flex items-center gap-2 py-2 px-3"
            >
              <Plus size={16} />
              Add Feature
            </button>
          </div>
          <textarea
            value={jsonText}
            onChange={handleJsonChange}
            className="w-full h-96 p-4 rounded-lg border border-avenue-outline/30 font-mono text-sm bg-avenue-surface focus:outline-none focus:border-avenue-primary"
          />
          <button
            onClick={validateAndParse}
            className="btn-primary mt-4 w-full"
          >
            Update
          </button>
        </div>

        {/* Preview Panel */}
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-title-medium font-public-sans font-bold mb-4">Features</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {geoJson.features?.length === 0 ? (
                <p className="text-avenue-on-surface-variant text-sm py-8 text-center">No features defined</p>
              ) : (
                geoJson.features?.map((feature, idx) => (
                  <div key={idx} className="p-3 bg-avenue-surface rounded-lg flex items-start justify-between group">
                    <div>
                      <p className="font-medium text-sm text-avenue-on-surface">
                        {feature.properties?.name || `Feature ${idx + 1}`}
                      </p>
                      <p className="text-xs text-avenue-on-surface-variant">
                        {feature.geometry?.type}
                      </p>
                    </div>
                    <button className="p-1 hover:bg-avenue-primary/10 rounded opacity-0 group-hover:opacity-100 transition-all">
                      <Trash2 size={16} className="text-avenue-error" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Info Card */}
          <div className="card bg-gradient-to-br from-avenue-primary/5 to-avenue-primary/2">
            <h4 className="font-semibold text-avenue-on-surface mb-2 flex items-center gap-2">
              <Copy size={16} />
              Quick Info
            </h4>
            <div className="text-sm text-avenue-on-surface-variant space-y-1">
              <p>Features: <span className="font-semibold text-avenue-primary">{geoJson.features?.length || 0}</span></p>
              <p>Type: <span className="font-semibold text-avenue-primary">{geoJson.type}</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
