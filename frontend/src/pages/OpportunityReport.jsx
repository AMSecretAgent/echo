export default function OpportunityReport({ agents }) {
  const demand = agents.demand_discovery?.output?.demand;
  const market = agents.market_validation?.output?.market;
  const product = agents.product_creation?.output?.product;
  const revenue = agents.revenue_agent?.output?.revenue;
  const launch = agents.launch_agent?.output?.launch;
  const execution = agents.execution_agent?.output?.execution;

  return (
    <div className="report">
      <h2>Opportunity Report</h2>

      <ReportSection title="Demand Summary">
        {demand ? (
          <ul>
            <li><strong>Demand:</strong> {demand.demand}</li>
            <li><strong>Confidence:</strong> {Math.round((demand.confidence || 0) * 100)}%</li>
            <li><strong>Frequency:</strong> {demand.frequency}</li>
            <li><strong>Urgency:</strong> {demand.urgency_score}/100</li>
          </ul>
        ) : <Empty />}
      </ReportSection>

      <ReportSection title="Market Validation">
        {market ? (
          <ul>
            <li><strong>Score:</strong> {market.market_score}/100</li>
            <li><strong>Competition:</strong> {market.competition_level}</li>
            <li><strong>Growth potential:</strong> {market.growth_potential}</li>
            <li>{market.validation_reasoning}</li>
          </ul>
        ) : <Empty />}
      </ReportSection>

      <ReportSection title="Product Blueprint">
        {product ? (
          <>
            <p><strong>{product.product_name}</strong> — ₹{product.pricing}</p>
            <p>{product.description}</p>
            <ul>{(product.feature_list || []).map((f, i) => <li key={i}>{f}</li>)}</ul>
          </>
        ) : <Empty />}
      </ReportSection>

      <ReportSection title="Revenue Model">
        {revenue ? (
          <ul>
            <li><strong>Model:</strong> {revenue.revenue_model}</li>
            <li><strong>Pricing strategy:</strong> {revenue.pricing_strategy}</li>
            <li><strong>Estimated revenue:</strong> {revenue.estimated_revenue}</li>
          </ul>
        ) : <Empty />}
      </ReportSection>

      <ReportSection title="Launch Plan">
        {launch ? (
          <>
            <p>{launch.launch_plan}</p>
            <details><summary>Social + email copy</summary>
              <p><strong>Instagram:</strong> {launch.instagram_post}</p>
              <p><strong>LinkedIn:</strong> {launch.linkedin_post}</p>
              <p><strong>Twitter/X:</strong> {launch.twitter_post}</p>
              <p><strong>Email:</strong> {launch.email_campaign}</p>
            </details>
          </>
        ) : <Empty />}
      </ReportSection>

      <ReportSection title="Execution Assets">
        {execution ? (
          <>
            <p>{execution.landing_page}</p>
            <p><em>{execution.CTA}</em></p>
            {execution.tracked_link && (
              <p>
                Trackable link: <a href={execution.tracked_link}>{execution.tracked_link}</a>
              </p>
            )}
          </>
        ) : <Empty />}
      </ReportSection>
    </div>
  );
}

function ReportSection({ title, children }) {
  return (
    <div className="report__section">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function Empty() {
  return <p className="report__empty">Not yet available.</p>;
}
