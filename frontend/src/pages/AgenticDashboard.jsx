import { useState } from "react";
import AgentTimeline from "../components/AgentTimeline.jsx";
import OpportunityScoreGauge from "../components/OpportunityScoreGauge.jsx";
import { useAgentStream } from "../hooks/useAgentStream.js";
import OpportunityReport from "./OpportunityReport.jsx";

export default function AgenticDashboard() {
  const [signalsText, setSignalsText] = useState(
    "when is the next batch dropping??\ndo you have a template for this??\nplease make a cheaper version 🙏\nfirst!!\nDM me your rates"
  );
  const [runId, setRunId] = useState(null);
  const [starting, setStarting] = useState(false);

  const { agents, agentOrder, opportunityScore, done, failed } = useAgentStream(runId);

  async function handleListen() {
    setStarting(true);
    setRunId(null);
    const signals = signalsText.split("\n").map((s) => s.trim()).filter(Boolean);

    const res = await fetch("/api/opportunities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signals }),
    });
    const data = await res.json();
    setStarting(false);
    setRunId(data.run_id);
  }

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <h1>Echo</h1>
        <p className="dashboard__tagline">
          Your fans already told you what to build. Watch the agents figure out what to do about it.
        </p>
      </header>

      <section className="dashboard__input">
        <textarea
          value={signalsText}
          onChange={(e) => setSignalsText(e.target.value)}
          rows={6}
          placeholder="Paste comments/DMs, one per line…"
        />
        <button onClick={handleListen} disabled={starting || (runId && !done && !failed)}>
          {starting ? "Starting…" : "Listen to my audience"}
        </button>
      </section>

      {runId && (
        <section className="dashboard__run">
          <AgentTimeline agentOrder={agentOrder} agents={agents} />
          {failed && <p className="dashboard__error">Run failed: {failed}</p>}
          {done && (
            <>
              <OpportunityScoreGauge score={opportunityScore} />
              <OpportunityReport runId={runId} agents={agents} />
            </>
          )}
        </section>
      )}
    </div>
  );
}
