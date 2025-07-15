
import KnowledgeBaseManager from '@/components/knowledge-base-manager';

export default function KnowledgeBasePage() {
  return (
    <div className="space-y-6">
      <h1 className="font-headline text-3xl font-bold">Knowledge Base</h1>
      <p className="text-muted-foreground">
        Upload documents to provide context for your AI agents. All data is
        processed and stored locally to ensure offline capabilities.
      </p>
      <KnowledgeBaseManager />
    </div>
  );
}
