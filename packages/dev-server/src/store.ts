import fs from "node:fs";
import path from "node:path";
import { fromJson, toJson } from "@bufbuild/protobuf";
import type { DiscoveryStore, StoredCertification, StoredDescription } from "@surfaces-ui/discovery";
import { type ContextPack, ContextPackSchema } from "@surfaces-ui/proto";

/**
 * Keeps context packs, accepted descriptions and certifications as JSON files in a folder,
 * one file per pack, so they can be reviewed and committed like any other
 * project file.
 */
export function fileDiscoveryStore(dir: string): DiscoveryStore {
  const packsDir = path.join(dir, "context");
  const descriptionsFile = path.join(dir, "descriptions.json");
  // Pack IDs become file names; anything else is refused so an ID cannot escape the folder.
  const fileOf = (id: string) => {
    if (!/^[a-z0-9][a-z0-9-]{0,80}$/.test(id)) throw new Error("Invalid context pack ID.");
    return path.join(packsDir, `${id}.json`);
  };
  const read = (file: string): ContextPack | undefined => {
    try {
      return fromJson(ContextPackSchema, JSON.parse(fs.readFileSync(file, "utf8")));
    } catch {
      return undefined;
    }
  };
  const certificationsFile = path.join(dir, "certifications.json");
  const certifications = (): Record<string, StoredCertification> => {
    try {
      return JSON.parse(fs.readFileSync(certificationsFile, "utf8")) as Record<string, StoredCertification>;
    } catch {
      return {};
    }
  };
  const descriptions = (): Record<string, StoredDescription> => {
    try {
      return JSON.parse(fs.readFileSync(descriptionsFile, "utf8")) as Record<string, StoredDescription>;
    } catch {
      return {};
    }
  };
  return {
    async listPacks() {
      if (!fs.existsSync(packsDir)) return [];
      return fs
        .readdirSync(packsDir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => read(path.join(packsDir, f)))
        .filter((p): p is ContextPack => p !== undefined);
    },
    async getPack(id) {
      return read(fileOf(id));
    },
    async savePack(pack) {
      fs.mkdirSync(packsDir, { recursive: true });
      fs.writeFileSync(fileOf(pack.id), `${JSON.stringify(toJson(ContextPackSchema, pack), null, 2)}\n`);
    },
    async deletePack(id) {
      fs.rmSync(fileOf(id), { force: true });
    },
    async getDescriptions() {
      return descriptions();
    },
    async setDescription(key, value) {
      fs.mkdirSync(dir, { recursive: true });
      // Keys use a NUL separator internally; store them readably.
      const all = descriptions();
      all[key] = value;
      fs.writeFileSync(descriptionsFile, `${JSON.stringify(all, null, 2)}\n`);
    },
    async getCertifications() {
      return certifications();
    },
    async setCertification(key, value) {
      fs.mkdirSync(dir, { recursive: true });
      const all = certifications();
      if (value) all[key] = value;
      else delete all[key];
      fs.writeFileSync(certificationsFile, `${JSON.stringify(all, null, 2)}\n`);
    },
  };
}
