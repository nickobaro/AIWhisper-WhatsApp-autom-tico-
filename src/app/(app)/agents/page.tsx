'use client';

import { useState } from 'react';
import AgentDesigner from '@/components/agent-designer';
import AgentList from '@/components/agent-list';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { Agent } from '@/types';

export default function AgentsPage() {
  const [tab, setTab] = useState<'designer' | 'list'>('designer');
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  const handleEdit = async (agent: Agent) => {
    try {
      const res = await fetch(`/api/agents/${agent.id}`);
      const fullAgent = await res.json();
      setEditingAgent(fullAgent);
      setTab('designer');
    } catch (e) {
      console.error('Failed to load agent', e);
    }
  };

  const handleSaved = () => {
    setEditingAgent(null);
    setTab('list');
  };

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="space-y-6">
      <TabsList>
        <TabsTrigger value="designer">Designer</TabsTrigger>
        <TabsTrigger value="list">All Agents</TabsTrigger>
      </TabsList>
      <TabsContent value="designer">
        <h1 className="mb-4 font-headline text-3xl font-bold">Agent Designer</h1>
        <AgentDesigner agent={editingAgent} onSaved={handleSaved} />
      </TabsContent>
      <TabsContent value="list">
        <h1 className="mb-4 font-headline text-3xl font-bold">All Agents</h1>
        <AgentList onEdit={handleEdit} />
      </TabsContent>
    </Tabs>
  );
}
