import type { DataSource } from "@surfaces-ui/data";
import { DATA_SOURCE_TRACE } from "@surfaces-ui/trace";
import { useProvided, useTraced } from "@surfaces-ui/trace/react";
import { type ReactNode, createContext, useContext } from "react";

const DataSourceContext = createContext<DataSource | undefined>(undefined);

export interface DataSourceProviderProps {
  /** Any implementation: a Connect client, `memoryDataSource`, or your own. */
  dataSource: DataSource;
  children: ReactNode;
}

/** Makes a DataSource available to every data component below it. */
export function DataSourceProvider({ dataSource, children }: DataSourceProviderProps) {
  // With a recorder above (dev tools), it is told which backend the page uses. Nothing happens without one.
  useProvided("dataSource", dataSource);
  return <DataSourceContext.Provider value={dataSource}>{children}</DataSourceContext.Provider>;
}

/** The DataSource from the nearest provider, or the one passed as a prop. */
export function useDataSource(override?: DataSource): DataSource {
  const fromContext = useContext(DataSourceContext);
  // Traced, as a child of the component asking, when a recorder is above; the backend itself otherwise.
  const dataSource = useTraced("DataSource", override ?? fromContext, DATA_SOURCE_TRACE);
  if (!dataSource) throw new Error("No DataSource: wrap the component in <DataSourceProvider> or pass dataSource.");
  return dataSource;
}
