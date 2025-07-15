
'use client';

import { useTheme } from 'next-themes';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Sun, Moon, Sparkles } from 'lucide-react';
import { useSettings } from '@/hooks/use-settings';

export default function SettingsPage() {
  const { resolvedTheme, setTheme } = useTheme();
  const { autoLoadKnowledge, setAutoLoadKnowledge } = useSettings();

  return (
    <div className="space-y-6">
      <h1 className="font-headline text-3xl font-bold">Settings</h1>
      <p className="text-muted-foreground">
        Manage your application and agent preferences.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="ml-1">Appearance</span>
          </CardTitle>
          <CardDescription>
            Customize the look and feel of your workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="theme-mode" className="text-base">
                Theme
              </Label>
              <p className="text-sm text-muted-foreground">
                Select between light and dark themes.
              </p>
            </div>
            <Switch
              id="theme-mode"
              checked={resolvedTheme === 'dark'}
              onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Agent Settings
          </CardTitle>
          <CardDescription>
            Configure default behaviors for your AI agents.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="auto-load-knowledge" className="text-base">
                Auto-load Knowledge Base
              </Label>
              <p className="text-sm text-muted-foreground">
                Automatically select all documents as context when creating a new agent rule.
              </p>
            </div>
            <Switch
              id="auto-load-knowledge"
              checked={autoLoadKnowledge}
              onCheckedChange={setAutoLoadKnowledge}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
