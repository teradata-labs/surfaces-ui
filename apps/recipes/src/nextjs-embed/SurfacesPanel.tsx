"use client";

import { connectDataSource } from "@surfaces-ui/client-connect";
import { DataSourceProvider, QueryResult, ThemeProvider } from "@surfaces-ui/components";
import type { DataSource } from "@surfaces-ui/data";
import { useMemo } from "react";

export interface SurfacesPanelProps {
  /** Your data server, e.g. "https://data.example.com". Read in the browser, so it must not hold a secret. */
  baseUrl?: string;
  sourceId: string;
  sql: string;
  /** Any other DataSource, such as your own adapter or one for tests. Used instead of `baseUrl`. */
  dataSource?: DataSource;
}

/**
 * A query result in its own themed region. Everything here runs in the
 * browser: the theme reads the system's light or dark setting and the grid
 * measures itself, so the page loads it with `ssr: false`.
 */
export function SurfacesPanel({ baseUrl = "", sourceId, sql, dataSource }: SurfacesPanelProps) {
  const data = useMemo(() => dataSource ?? connectDataSource({ baseUrl }), [dataSource, baseUrl]);
  return (
    // "scoped" themes only this region, so the rest of your app keeps its own styles.
    <ThemeProvider scope="scoped" storage={null}>
      <DataSourceProvider dataSource={data}>
        <QueryResult sourceId={sourceId} sql={sql} height={420} exportName="orders" />
      </DataSourceProvider>
    </ThemeProvider>
  );
}
