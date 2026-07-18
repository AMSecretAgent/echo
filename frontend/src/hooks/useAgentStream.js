import { useEffect, useRef, useState } from "react";

const AGENT_ORDER = [
  "demand_discovery",
  "market_validation",
  "product_creation",
  "revenue_agent",
  "launch_agent",
  "execution_agent",
];

export function useAgentStream(runId) {
  const [agents, setAgents] = useState(() =>
    Object.fromEntries(AGENT_ORDER.map((a) => [a, { status: "idle", output: null }]))
  );
  const [opportunityScore, setOpportunityScore] = useState(null);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(null);
  const sourceRef = useRef(null);

  useEffect(() => {
    if (!runId) return;

    setAgents(Object.fromEntries(AGENT_ORDER.map((a) => [a, { status: "idle", output: null }])));
    setDone(false);
    setFailed(null);
    setOpportunityScore(null);

    const es = new EventSource(`/api/opportunities/${runId}/stream`);
    sourceRef.current = es;

    es.onmessage = (event) => {
      const payload = JSON.parse(event.data);

      if (payload.status === "done") {
        setOpportunityScore(payload.opportunity_score);
        setDone(true);
        es.close();
        return;
      }
      if (payload.status === "failed") {
        setFailed(payload.error || "Run failed");
        es.close();
        return;
      }
      if (payload.agent) {
        setAgents((prev) => ({
          ...prev,
          [payload.agent]: { status: "done", output: payload.output },
        }));
        // Mark the next agent as "running" optimistically for a livelier UI
        const idx = AGENT_ORDER.indexOf(payload.agent);
        const next = AGENT_ORDER[idx + 1];
        if (next) {
          setAgents((prev) => ({
            ...prev,
            [next]: prev[next].status === "idle" ? { status: "running", output: null } : prev[next],
          }));
        }
      }
    };

    es.onerror = () => {
      es.close();
    };

    return () => es.close();
  }, [runId]);

  return { agents, agentOrder: AGENT_ORDER, opportunityScore, done, failed };
}
