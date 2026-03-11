import { createMcpApp, Button, Card, CardHeader, CardTitle, CardContent } from '@surfacesui/app-framework';
import '@surfacesui/app-framework/tokens.css';

function App() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Hello MCP App</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            This is a minimal MCP App built with @surfacesui/app-framework.
          </p>
          <Button>Click me</Button>
        </CardContent>
      </Card>
    </div>
  );
}

createMcpApp(App, { name: 'Hello World' });
