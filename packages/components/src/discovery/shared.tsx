import type { MessageInitShape } from "@bufbuild/protobuf";
import type { Discovery } from "@surfaces-ui/data";
import { type Certification, CertificationStatus, type DataObject, DescriptionOrigin, ObjectKind, type ObjectRefSchema, TableFormat } from "@surfaces-ui/proto";
import { useProvided, useTraced } from "@surfaces-ui/trace/react";
import { type ReactNode, createContext, useContext } from "react";
import { numberFormat } from "../locale/locale.js";

const DiscoveryContext = createContext<Discovery | undefined>(undefined);

export interface DiscoveryProviderProps {
  /** Any implementation: a Connect client, the reference `createDiscovery`, or your own. */
  discovery: Discovery;
  children: ReactNode;
}

/** Makes a Discovery backend available to the discovery and context components below it. */
export function DiscoveryProvider({ discovery, children }: DiscoveryProviderProps) {
  useProvided("discovery", discovery);
  return <DiscoveryContext.Provider value={discovery}>{children}</DiscoveryContext.Provider>;
}

export function useDiscovery(override?: Discovery): Discovery {
  const fromContext = useContext(DiscoveryContext);
  const discovery = useTraced("Discovery", override ?? fromContext);
  if (!discovery) throw new Error("No Discovery backend: wrap the component in <DiscoveryProvider> or pass discovery.");
  return discovery;
}

/** The Discovery backend if one is available, for components that work without it. */
export function useOptionalDiscovery(override?: Discovery): Discovery | undefined {
  const fromContext = useContext(DiscoveryContext);
  return useTraced("Discovery", override ?? fromContext);
}

/** What a certification says in words, e.g. for a tooltip. */
export function certificationText(certification: Certification): string {
  const verb = certification.status === CertificationStatus.DEPRECATED ? "Deprecated" : "Certified";
  const when = certification.setAt ? ` on ${certification.setAt.slice(0, 10)}` : "";
  return `${verb} by ${certification.setBy || "an unnamed person"}${when}${certification.note ? `. ${certification.note}` : ""}`;
}

/**
 * Marks an object a steward has certified or deprecated. Renders nothing when
 * there is no verdict. The mark and the text both carry the meaning, so it
 * does not rely on colour.
 */
export function CertificationBadge({ certification }: { certification: Certification | undefined }) {
  if (!certification || certification.status === CertificationStatus.UNSPECIFIED) return null;
  const deprecated = certification.status === CertificationStatus.DEPRECATED;
  return (
    <span className="sf-cert" data-status={deprecated ? "deprecated" : "certified"} title={certificationText(certification)}>
      <span aria-hidden="true">{deprecated ? "!" : "✓"}</span>
      {deprecated ? "Deprecated" : "Certified"}
    </span>
  );
}

export type ObjectRefInit = MessageInitShape<typeof ObjectRefSchema>;

/** A table reference in the shape the Discovery interface expects. */
export function tableRef(sourceId: string, table: string): ObjectRefInit {
  return { sourceId, kind: ObjectKind.TABLE, table };
}

export const FORMAT_LABEL: Partial<Record<TableFormat, string>> = {
  [TableFormat.PARQUET]: "Parquet",
  [TableFormat.CSV]: "CSV",
  [TableFormat.JSON]: "JSON",
  [TableFormat.ICEBERG]: "Iceberg",
  [TableFormat.DELTA]: "Delta",
};

export const ORIGIN_LABEL: Partial<Record<DescriptionOrigin, string>> = {
  [DescriptionOrigin.SOURCE]: "From the source",
  [DescriptionOrigin.HUMAN]: "Written by a person",
  [DescriptionOrigin.GENERATED]: "Generated",
};

export function kindLabel(object: DataObject | undefined): string {
  return object?.ref?.kind === ObjectKind.COLUMN ? "Column" : "Table";
}

/** Writes 1.2K, in the page's locale. */
export const compactCount = { format: (n: number | bigint) => numberFormat({ notation: "compact", maximumFractionDigits: 1 }).format(n) };
/** Writes 1,234, in the page's locale. */
export const fullCount = { format: (n: number | bigint) => numberFormat().format(n) };
