
export default function Duplicates({ reports }) {
  const flagged = reports.filter(
    report =>
      report.image_status === 'Duplicate' ||
      report.image_status === 'Possible Duplicate'
  );

  return (
    <section className="reports">
      <h2>Duplicate Detection History</h2>
      <p>
        Image comparison results are preserved even after human review.
      </p>

      <div className="stats">
        <div className="card">
          <h2>{reports.length}</h2>
          <p>Total Reports</p>
        </div>

        <div className="card">
          <h2>{flagged.length}</h2>
          <p>Flagged Images</p>
        </div>

        <div className="card">
          <h2>
            {flagged.filter(
              report => report.image_status === 'Duplicate'
            ).length}
          </h2>
          <p>Exact / Hash Duplicates</p>
        </div>
      </div>

      {flagged.length === 0 ? (
        <p>No duplicate images detected yet.</p>
      ) : (
        flagged.map(report => (
          <div className="verification-card" key={report.id}>
            <h3>{report.type}</h3>

            <p>
              <strong>Description:</strong> {report.description}
            </p>

            <p>
              <strong>Image Status:</strong> {report.image_status}
            </p>

            <p>
              <strong>Detection Reason:</strong> {report.reason}
            </p>

            <p>
              <strong>Human Review:</strong> {report.review_status}
            </p>

            <p>
              <strong>Location:</strong> {report.lat}, {report.lng}
            </p>

            <p>
              <strong>Submitted:</strong> {report.created_at}
            </p>
          </div>
        ))
      )}
    </section>
  );
}
