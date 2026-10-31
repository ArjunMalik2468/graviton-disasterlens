import { useEffect, useState } from 'react';
import Analytics from './Analytics';
import Duplicates from './Duplicates';
import Verification from './Verification';
import IncidentMap from './IncidentMap';
import './App.css';

const API = 'http://127.0.0.1:8000';
const MENU = [
  { name: 'Dashboard', icon: '◈' },
  { name: 'Submit Report', icon: '⊕' },
  { name: 'GIS Map', icon: '◎' },
  { name: 'AI Verification', icon: '✧' },
  { name: 'Duplicates', icon: '▣' },
  { name: 'Analytics', icon: '▥' },
];
const INITIAL_FORM = { type: 'Flood', description: '', lat: '', lng: '' };

function App() {
  const [page, setPage] = useState('Dashboard');
  const [reports, setReports] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [image, setImage] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  const [verification, setVerification] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [locationResult, setLocationResult] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [checking, setChecking] = useState(false);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function loadReports() {
    try {
      const response = await fetch(`${API}/reports`);
      if (!response.ok) throw new Error('Failed to load reports');
      const data = await response.json();
      setReports([...data].reverse());
    } catch (error) {
      console.error('Could not load reports:', error);
    }
  }

  useEffect(() => { loadReports(); }, []);

  function navigate(next) {
    setPage(next);
    setSidebarOpen(false);
  }

  function updateForm(field, value) {
    setForm(previous => ({ ...previous, [field]: value }));
    if (field === 'type' || field === 'description') setAiAnalysis(null);
    if (field === 'lat' || field === 'lng') setLocationResult(null);
  }

  function onImageChange(event) {
    setImage(event.target.files?.[0] || null);
    setVerification(null);
    setMetadata(null);
    setLocationResult(null);
    setAiAnalysis(null);
  }

  async function requestWithImage(path, extraFields = {}) {
    const data = new FormData();
    data.append('file', image);
    Object.entries(extraFields).forEach(([key, value]) => data.append(key, String(value)));
    const response = await fetch(`${API}${path}`, { method: 'POST', body: data });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(typeof result.detail === 'string' ? result.detail : 'Request failed');
    }
    return result;
  }

  async function verifyImage() {
    if (!image) return alert('Please select an image first.');
    setChecking(true);
    setVerification(null);
    try { setVerification(await requestWithImage('/verify')); }
    catch (error) { alert(error.message); }
    finally { setChecking(false); }
  }

  async function checkMetadata() {
    if (!image) return alert('Please select an image first.');
    setMetadataLoading(true);
    setMetadata(null);
    try { setMetadata(await requestWithImage('/metadata')); }
    catch (error) { alert(error.message); }
    finally { setMetadataLoading(false); }
  }

  async function analyzeWithAI() {
    if (!image) return alert('Please upload a disaster image first.');
    if (!form.description.trim()) return alert('Please enter a report description first.');
    setAiLoading(true);
    setAiAnalysis(null);
    try {
      setAiAnalysis(await requestWithImage('/ai-analyze', {
        disaster_type: form.type,
        description: form.description,
      }));
    } catch (error) { alert(`AI analysis unavailable: ${error.message}`); }
    finally { setAiLoading(false); }
  }

  function validCoordinates() {
    const lat = Number(form.lat);
    const lng = Number(form.lng);
    return form.lat.trim() && form.lng.trim() && Number.isFinite(lat) &&
      Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }

  async function checkPhotoLocation() {
    if (!image) return alert('Please upload an image first.');
    if (!validCoordinates()) return alert('Please enter valid latitude and longitude.');
    setLocationLoading(true);
    setLocationResult(null);
    try {
      setLocationResult(await requestWithImage('/location-check', {
        lat: Number(form.lat), lng: Number(form.lng),
      }));
    } catch (error) { alert(error.message); }
    finally { setLocationLoading(false); }
  }

  function getCurrentLocation() {
    if (!navigator.geolocation) return alert('Geolocation is not supported by your browser.');
    navigator.geolocation.getCurrentPosition(
      position => {
        setForm(previous => ({
          ...previous,
          lat: position.coords.latitude.toFixed(6),
          lng: position.coords.longitude.toFixed(6),
        }));
        setLocationResult(null);
      },
      error => alert(error.code === 1
        ? 'Location permission denied. Please allow location access.'
        : 'Could not detect your location. Enter coordinates manually.'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  async function submitReport(event) {
    event.preventDefault();
    if (!image) return alert('Please upload a disaster image.');
    if (!validCoordinates()) return alert('Enter valid latitude and longitude.');
    setSubmitting(true);
    try {
      const result = await requestWithImage('/reports', {
        type: form.type,
        description: form.description,
        lat: Number(form.lat),
        lng: Number(form.lng),
      });
      setReports(previous => [result, ...previous]);
      setForm(INITIAL_FORM);
      setImage(null);
      setFileKey(key => key + 1);
      setVerification(null);
      setMetadata(null);
      setLocationResult(null);
      setAiAnalysis(null);
      navigate('Dashboard');
      alert(`Report submitted! Status: ${result.status || 'Pending'}`);
    } catch (error) { alert(error.message); }
    finally { setSubmitting(false); }
  }

  const total = reports.length;
  const verified = reports.filter(r => r.status === 'Verified').length;
  const duplicates = reports.filter(r => r.status === 'Duplicate').length;
  const pending = reports.filter(r => r.status === 'Pending' || r.review_status === 'Awaiting Review').length;
  const stats = [
    { label: 'Total reports', value: total, icon: '▤', tone: 'blue', detail: 'Submitted incidents' },
    { label: 'Verified', value: verified, icon: '✓', tone: 'green', detail: 'Verified status' },
    { label: 'Duplicates', value: duplicates, icon: '▣', tone: 'amber', detail: 'Flagged matches' },
    { label: 'Awaiting review', value: pending, icon: '◷', tone: 'purple', detail: 'Pending attention' },
  ];

  return (
    <div className="dashboard">
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">◈</div>
          <div><strong>DISASTER<span>LENS</span></strong><small>INTELLIGENCE PLATFORM</small></div>
        </div>
        <div className="workspace-tag"><span className="pulse-dot" /> GRAVITON 2026 <span className="workspace-chevron">⌄</span></div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {MENU.map(item => (
            <button key={item.name} type="button" className={`nav-item ${page === item.name ? 'active' : ''}`} onClick={() => navigate(item.name)}>
              <span className="nav-icon">{item.icon}</span><span>{item.name}</span>
              {page === item.name && <span className="nav-arrow">›</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="system-card"><span className="system-dot" /><div><strong>System operational</strong><small>Local development environment</small></div></div>
          <div className="sidebar-foot">DISASTERLENS AI <span>v1.0</span></div>
        </div>
      </aside>

      {sidebarOpen && <button className="mobile-overlay" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
      <main className="content">
        <header className="topbar">
          <div className="topbar-left"><button className="mobile-menu" type="button" onClick={() => setSidebarOpen(true)}>☰</button><span className="breadcrumb">Workspace</span><span className="breadcrumb-divider">/</span><span className="breadcrumb-current">{page}</span></div>
          <div className="topbar-right"><span className="topbar-badge"><span className="pulse-dot" /> LOCAL SYSTEM</span><div className="avatar">DL</div></div>
        </header>
        <div className="page-content">
          <div className="page-heading">
            <div><div className="eyebrow">DISASTER INTELLIGENCE <span> / {page.toUpperCase()}</span></div><h1>{page === 'Dashboard' ? 'Command Overview' : page}</h1><p>{page === 'Dashboard' ? 'Monitor, validate, and review crowdsourced disaster intelligence.' : 'AI-assisted incident reporting and verification workspace.'}</p></div>
            <button className="heading-action" type="button" onClick={() => navigate('Submit Report')}>＋ New Incident Report</button>
          </div>

          {page === 'Dashboard' && <>
            <div className="hero-banner"><div><span className="hero-kicker"><span className="pulse-dot" /> INTELLIGENCE OPERATIONS</span><h2>Every report matters.<br /><span>Every detail counts.</span></h2><p>Turn crowdsourced evidence into actionable situational awareness.</p><button type="button" onClick={() => navigate('Submit Report')}>Submit an incident <span>↗</span></button></div><div className="hero-art" aria-hidden="true"><div className="radar-ring ring-one"/><div className="radar-ring ring-two"/><div className="radar-ring ring-three"/><div className="radar-center">◎</div><span className="radar-blip blip-one"/><span className="radar-blip blip-two"/></div></div>
            <div className="stats">{stats.map(stat => <div className={`card stat-${stat.tone}`} key={stat.label}><div className="stat-top"><span>{stat.label}</span><span className="stat-icon">{stat.icon}</span></div><h2>{stat.value}</h2><div className="stat-detail">{stat.detail}</div></div>)}</div>
            <div className="section-heading"><div><h2>Geospatial Intelligence</h2><p>Incident locations from submitted reports</p></div><button type="button" className="text-action" onClick={() => navigate('GIS Map')}>Full map ↗</button></div>
            <section className="map map-panel"><div className="panel-heading"><span className="panel-label">◎ INCIDENT DISTRIBUTION</span><span className="panel-tag">GIS VIEW</span></div><IncidentMap reports={reports} /></section>
            <div className="section-heading"><div><h2>Recent Incident Reports</h2><p>Latest reports received by the platform</p></div><button type="button" className="text-action" onClick={loadReports}>↻ Refresh</button></div>
            <section className="reports recent-reports">{reports.length === 0 ? <div className="empty-state"><span>◈</span><h3>No incidents reported yet</h3><p>Submit your first report to see it here.</p></div> : <div className="report-list">{reports.slice(0, 5).map(r => <div className="report-row" key={r.id}><div className="report-symbol">!</div><div className="report-main"><strong>{r.type}</strong><span>{r.description || 'No description provided'}</span></div><span className={`status-pill ${String(r.status || '').toLowerCase().replace(/\s+/g, '-')}`}>{r.status || 'Pending'}</span></div>)}</div>}</section>
          </>}

          {page === 'Submit Report' && <div className="form-layout"><section className="reports form-panel"><div className="form-panel-heading"><span className="panel-label">01 / INCIDENT DETAILS</span><h2>Submit a disaster report</h2><p>Provide a photo, incident details, and location for review.</p></div>
            <form onSubmit={submitReport} className="report-form">
              <div className="field-group"><label htmlFor="report-image">Evidence image <span className="required">*</span></label><div className="upload-box"><div className="upload-symbol">↑</div><strong>{image ? image.name : 'Upload photographic evidence'}</strong><span>PNG or JPEG · Maximum 10 MB</span><input id="report-image" key={fileKey} type="file" accept="image/png,image/jpeg" onChange={onImageChange} /></div></div>
              <div className="field-group"><label htmlFor="disaster-type">Disaster type</label><select id="disaster-type" value={form.type} onChange={e => updateForm('type', e.target.value)}>{['Flood', 'Heavy Rainfall', 'Cyclone', 'Landslide', 'Storm'].map(type => <option key={type}>{type}</option>)}</select></div>
              <div className="field-group"><label htmlFor="description">Incident description <span className="required">*</span></label><textarea id="description" required value={form.description} onChange={e => updateForm('description', e.target.value)} placeholder="Describe what happened, what is visible, and any known details..." /></div>
              <div className="field-group"><div className="field-heading"><label>Reported location <span className="required">*</span></label><button type="button" className="inline-link" onClick={getCurrentLocation}>◎ Use my location</button></div><div className="coordinate-grid"><div><label htmlFor="latitude" className="sub-label">Latitude</label><input id="latitude" required type="number" step="any" value={form.lat} onChange={e => updateForm('lat', e.target.value)} placeholder="19.076" /></div><div><label htmlFor="longitude" className="sub-label">Longitude</label><input id="longitude" required type="number" step="any" value={form.lng} onChange={e => updateForm('lng', e.target.value)} placeholder="72.8777" /></div></div></div>
              <div className="tool-section"><div className="tool-heading"><h3>Evidence analysis tools</h3><p>Run optional checks before submitting the report.</p></div><div className="tool-grid"><button type="button" className="tool-button" onClick={verifyImage} disabled={!image || checking}>{checking ? 'Checking duplicates...' : '▣ Check duplicates'}</button><button type="button" className="tool-button" onClick={checkMetadata} disabled={!image || metadataLoading}>{metadataLoading ? 'Reading metadata...' : '◷ Image metadata'}</button><button type="button" className="tool-button" onClick={checkPhotoLocation} disabled={!image || locationLoading}>{locationLoading ? 'Checking location...' : '◎ Photo location'}</button><button type="button" className="tool-button ai-tool" onClick={analyzeWithAI} disabled={!image || aiLoading}>{aiLoading ? 'Analyzing with Gemini...' : '✧ Analyze with AI'}</button></div></div>
              {verification && <div className="verification-result"><h3>▣ Duplicate comparison</h3><p><strong>Status:</strong> {verification.status}</p><p><strong>Reason:</strong> {verification.reason}</p>{verification.distance !== undefined && <p><strong>Perceptual hash distance:</strong> {verification.distance}</p>}</div>}
              {metadata && <div className="verification-result"><h3>◷ Image metadata</h3><p><strong>Capture time:</strong> {metadata.metadata?.capture_time || 'Not available'}</p><p><strong>Embedded GPS:</strong> {metadata.has_gps ? `${metadata.metadata?.gps_lat}, ${metadata.metadata?.gps_lng}` : 'Not available'}</p><p><strong>Camera:</strong> {[metadata.metadata?.camera_make, metadata.metadata?.camera_model].filter(Boolean).join(' ') || 'Not available'}</p></div>}
              {locationResult && <div className="verification-result"><h3>◎ Photo location analysis</h3><p><strong>Status:</strong> {locationResult.status}</p><p><strong>Reason:</strong> {locationResult.reason}</p><p><strong>Distance:</strong> {locationResult.distance_km == null ? 'Not available' : `${locationResult.distance_km} km`}</p>{locationResult.photo_gps && <p><strong>Photo GPS:</strong> {locationResult.photo_gps.lat}, {locationResult.photo_gps.lng}</p>}</div>}
              {aiAnalysis && <div className="verification-result ai-result"><div className="result-heading"><h3>✧ Gemini AI analysis</h3><span className="panel-tag">AI ASSISTED</span></div><p className="ai-text">{aiAnalysis.analysis}</p><small>AI observations are not proof of authenticity. Human verification is required.</small></div>}
              <button className="submit-button" type="submit" disabled={submitting}>{submitting ? 'Submitting report...' : 'Submit incident report ↗'}</button>
            </form></section><aside className="form-aside"><div className="aside-card"><div className="aside-icon">✧</div><h3>Built for verification</h3><p>Every incident can be checked using multiple independent signals.</p><div className="aside-feature"><span>✓</span> Duplicate image detection</div><div className="aside-feature"><span>✓</span> EXIF metadata inspection</div><div className="aside-feature"><span>✓</span> Photo GPS comparison</div><div className="aside-feature"><span>✓</span> AI visual observations</div></div><div className="aside-note"><strong>Human review comes first.</strong><p>AI analysis cannot confirm whether a disaster actually occurred, or establish the date and location of a photo.</p></div></aside></div>}

          {page === 'GIS Map' && <section className="map full-map-panel"><div className="panel-heading"><span className="panel-label">◎ INCIDENT MAP</span><span className="panel-tag">{reports.length} REPORTS</span></div><IncidentMap reports={reports} /></section>}
          {page === 'AI Verification' && <div className="module-panel"><Verification reports={reports} onRefresh={loadReports} /></div>}
          {page === 'Duplicates' && <div className="module-panel"><Duplicates reports={reports} /></div>}
          {page === 'Analytics' && <div className="module-panel"><Analytics reports={reports} /></div>}
          <footer className="footer"><span>© 2026 DisasterLens AI · GRAVITON</span><span>Built for informed disaster response</span></footer>
        </div>
      </main>
    </div>
  );
}

export default App;
