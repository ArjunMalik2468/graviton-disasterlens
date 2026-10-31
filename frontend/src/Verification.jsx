
import { useState } from 'react';

const API = 'https://graviton-disasterlens.onrender.com';

export default function Verification({ reports, onRefresh }) {
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const pending = reports.filter(
    r => !['Verified', 'Rejected'].includes(r.review_status)
  );

  async function review(id, decision) {
    const reviewerKey = window.prompt('Enter reviewer access key:');

    if (!reviewerKey) {
      return;
    }

    setBusyId(id);
    setError('');

    try {
      const response = await fetch(
        `${API}/reports/${id}/review`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-reviewer-key': reviewerKey
          },
          body: JSON.stringify({ decision })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof result.detail === 'string'
            ? result.detail
            : 'Review failed'
        );
      }

      await onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="reports">
      <h2>Report Verification Queue</h2>
      <p>
        Review image similarity findings before approving reports.
      </p>

      <div className="stats">
        <div className="card">
          <h2>{reports.length}</h2>
          <p>Total Reports</p>
        </div>

        <div className="card">
          <h2>{pending.length}</h2>
          <p>Awaiting Review</p>
        </div>

        <div className="card">
          <h2>
            {reports.filter(
              r => ['Duplicate', 'Possible Duplicate'].includes(r.image_status)
            ).length}
          </h2>
          <p>Flagged Images</p>
        </div>
      </div>

      {error && (
        <p style={{ color: '#ff7777' }}>
          {error}
        </p>
      )}

      {pending.length === 0 ? (
        <p>No reports awaiting review.</p>
      ) : (
        pending.map(report => (
          <div className="verification-card" key={report.id}>
            <h3>{report.type}</h3>

            <p>
              <strong>Description:</strong> {report.description}
            </p>

            <p>
              <strong>Status:</strong> {report.status}
            </p>

            <p>
              <strong>Review status:</strong> {report.review_status}
            </p>

            <p>
              <strong>Image analysis:</strong> {report.reason}
            </p>

            <p>
              <strong>Coordinates:</strong> {report.lat}, {report.lng}
            </p>

            <div className="review-actions">
              <button
                disabled={busyId !== null}
                onClick={() => review(report.id, 'Verified')}
              >
                {busyId === report.id ? 'Saving...' : 'Approve'}
              </button>

              <button
                disabled={busyId !== null}
                onClick={() => review(report.id, 'Rejected')}
                className="reject-button"
              >
                Reject
              </button>
            </div>
          </div>
        ))
      )}
    </section>
  );
}
