const LABELS = {
  demand_discovery: "Demand Discovery",
  market_validation: "Market Validation",
  product_creation: "Product Creation",
  revenue_agent: "Revenue",
  launch_agent: "Launch",
  execution_agent: "Execution",
};

const ICON = { idle: "○", running: "◐", done: "✓", failed: "✗" };

export default function AgentStatusCard({ agentKey, status, output }) {
  return (
    <div className={`agent-card agent-card--${status}`}>
      <div className="agent-card__header">
        <span className="agent-card__icon">{ICON[status]}</span>
        <span className="agent-card__name">{LABELS[agentKey] || agentKey}</span>
        <span className="agent-card__status">{status}</span>
      </div>
      {output && (
        <pre className="agent-card__output">{JSON.stringify(output, null, 2)}</pre>
      )}
    </div>
  );
}
