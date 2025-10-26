import React from 'react';
import ReactFlow, { Background, Controls } from 'reactflow';
import 'reactflow/dist/style.css';

export type FlowNode = { id: string; data: { label: string }; position: { x: number; y: number } };
export type FlowEdge = { id: string; source: string; target: string };

type ArchitectureFlowProps = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  height?: string | number;
};

export default function ArchitectureFlow({ nodes, edges, height = '40vh' }: ArchitectureFlowProps) {
  return (
    <div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden" style={{ height }}>
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <Background variant="dots" gap={12} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
