export default function OpportunityScoreGauge({ score }) {
  if (score == null) return null;
  const color = score >= 75 ? "#1a8a3a" : score >= 50 ? "#c98a12" : "#b3382c";
  return (
    <div className="score-gauge">
      <svg viewBox="0 0 120 70" width="180">
        <path d="M10,60 A50,50 0 0,1 110,60" fill="none" stroke="#e4e0d6" strokeWidth="10" />
        <path
          d="M10,60 A50,50 0 0,1 110,60"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={`${(score / 100) * 157} 157`}
        />
      </svg>
      <div className="score-gauge__value" style={{ color }}>
        {score}
        <span className="score-gauge__max">/100</span>
      </div>
      <div className="score-gauge__label">Opportunity Score</div>
    </div>
  );
}
