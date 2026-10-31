
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const icon = L.divIcon({
  className: '',
  html: '<div style="background:#ff5555;width:16px;height:16px;border:3px solid white;border-radius:50%"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

function IncidentMap({ reports = [] }) {
  return (
    <MapContainer
      center={[22.5, 78.9]}
      zoom={5}
      style={{ height: '400px', width: '100%', borderRadius: '10px' }}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {reports.map(report => (
        <Marker
          key={report.id}
          position={[Number(report.lat), Number(report.lng)]}
          icon={icon}
        >
          <Popup>
            <strong>{report.type}</strong>
            <p>{report.description}</p>
            <p>Status: {report.status}</p>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

export default IncidentMap;
