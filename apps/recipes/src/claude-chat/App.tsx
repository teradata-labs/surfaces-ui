import { Chat } from "@surfaces-ui/chat";
import { connectAgent, connectDataSource } from "@surfaces-ui/client-connect";
import { DataSourceProvider } from "@surfaces-ui/components";
import { browserStorage } from "@surfaces-ui/state";
// Import "@surfaces-ui/components/styles.css" once in your app's entry file.

// The browser talks to your server only. The model key never leaves it.
const baseUrl = "http://localhost:5220";
const data = connectDataSource({ baseUrl });
const agent = connectAgent({ baseUrl });
const storage = browserStorage();

export function App({ user }: { user: { id: string; name: string } }) {
  return (
    // Components Claude draws (charts, tables, metrics) run their SQL through this DataSource.
    <DataSourceProvider dataSource={data}>
      <Chat
        agent={agent}
        user={user}
        storage={storage}
        starters={["What tables are there?", "Revenue by month in retail", "Which stores sell the most?"]}
      />
    </DataSourceProvider>
  );
}
