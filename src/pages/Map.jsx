import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function Map() {
  const mapContainer = useRef(null);
  const map = useRef(null);

  useEffect(() => {
    if (map.current) return;

    map.current = L.map(mapContainer.current).setView([28.7041, 77.1025], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map.current);

    // Add sample markers
    const markers = [
      { lat: 28.7041, lng: 77.1025, title: 'Issue #1: Pothole', color: '#BA1A1A' },
      { lat: 28.6139, lng: 77.2090, title: 'Issue #2: Street Light', color: '#F59E0B' },
      { lat: 28.5244, lng: 77.1855, title: 'Resolved: #3', color: '#22C55E' },
    ];

    markers.forEach(marker => {
      L.circleMarker([marker.lat, marker.lng], {
        radius: 10,
        fillColor: marker.color,
        color: marker.color,
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8,
      })
        .bindPopup(marker.title)
        .addTo(map.current);
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  return (
    <div className="page-enter">
      <div className="space-y-4 mb-6">
        <div>
          <h2 className="text-2xl font-public-sans font-bold text-avenue-on-surface">Map View</h2>
          <p className="text-avenue-on-surface-variant text-sm mt-1">Geographic distribution of issues</p>
        </div>
      </div>
      <div
        ref={mapContainer}
        className="w-full h-96 rounded-2xl shadow-card overflow-hidden border border-avenue-outline/10"
      />
    </div>
  );
}
