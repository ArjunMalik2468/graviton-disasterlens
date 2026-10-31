
export default function Analytics({ reports }) {
  const total = reports.length;

  const verified = reports.filter(
    r => r.review_status === 'Verified'
  ).length;

  const rejected = reports.filter(
    r => r.review_status === 'Rejected'
  ).length;

  const awaiting = reports.filter(
    r => r.review_status === 'Awaiting Review'
  ).length;

  const duplicates = reports.filter(
    r => r.image_status === 'Duplicate'
  ).length;

  const possibleDuplicates = reports.filter(
    r => r.image_status === 'Possible Duplicate'
  ).length;

  const disasterTypes = [
    'Flood',
    'Heavy Rainfall',
    'Cyclone',
    'Landslide',
    'Storm'
  ];

  const percentage = value =>
    total === 0 ? 0 : Math.round((value / total) * 100);

  return (
    <div className="analytics-page">
      <h2>Disaster Intelligence Analytics</h2>
      <p>Live statistics from submitted disaster reports.</p>

      <div className="stats">
        {[
          ['Total Reports', total],
          ['Verified', verified],
          ['Rejected', rejected],
          ['Awaiting Review', awaiting],
          ['Duplicate Images', duplicates],
          ['Possible Duplicates', possibleDuplicates]
        ].map(([label, value]) => (
          <div className="card" key={label}>
            <h2>{value}</h2>
            <p>{label}</p>
          </div>
        ))}
      </div>

      <section className="reports">
        <h2>Human Review Results</h2>

        {[
          ['Verified', verified, '#22c55e'],
          ['Rejected', rejected, '#ef4444'],
          ['Awaiting Review', awaiting, '#f59e0b']
        ].map(([label, count, color]) => (
          <div className="analytics-row" key={label}>
            <p>{label}: {count} ({percentage(count)}%)</p>

            <div className="analytics-track">
              <div
                className="analytics-fill"
                style={{
                  width: `${percentage(count)}%`,
                  backgroundColor: color
                }}
              />
            </div>
          </div>
        ))}
      </section>

      <section className="reports">
        <h2>Reports by Disaster Type</h2>

        {disasterTypes.map(type => {
          const count = reports.filter(
            r => r.type === type
          ).length;

          return (
            <div className="analytics-row" key={type}>
              <p>{type}: {count}</p>

              <div className="analytics-track">
                <div
                  className="analytics-fill"
                  style={{
                    width: `${percentage(count)}%`,
                    backgroundColor: '#4dabff'
                  }}
                />
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
