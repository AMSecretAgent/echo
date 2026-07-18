import AgentStatusCard from "./AgentStatusCard.jsx";

export default function AgentTimeline({ agentOrder, agents }) {
  return (
    <div className="agent-timeline">
      {agentOrder.map((key) => (
        <AgentStatusCard
          key={key}
          agentKey={key}
          status={agents[key]?.status || "idle"}
          output={agents[key]?.output}
        />
      ))}
    </div>
  );
}
