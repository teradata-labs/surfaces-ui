import type { DescMessage, MessageInitShape } from "@bufbuild/protobuf";
import type {
  AskRequestSchema,
  AskResponse,
  DeleteContextPackRequestSchema,
  DeleteContextPackResponse,
  DescribeRequestSchema,
  DescribeResponse,
  GetContextPackRequestSchema,
  GetContextPackResponse,
  GetObjectRequestSchema,
  GetObjectResponse,
  GetRelatedRequestSchema,
  GetRelatedResponse,
  ListContextPacksRequestSchema,
  ListContextPacksResponse,
  RenderContextPackRequestSchema,
  RenderContextPackResponse,
  SaveContextPackRequestSchema,
  SaveContextPackResponse,
  SaveDescriptionRequestSchema,
  SaveDescriptionResponse,
  SearchRequestSchema,
  SearchResponse,
  SetCertificationRequestSchema,
  SetCertificationResponse,
} from "@surfaces-ui/proto";
import type { CallOptions } from "./datasource.js";

type Unary<Req extends DescMessage, Res> = (request: MessageInitShape<Req>, options?: CallOptions) => Promise<Res>;

/**
 * Everything the discovery and context components need from a backend.
 *
 * Search indexes, embedding models and language models all sit behind this
 * interface. Components never call a model themselves, so a backend decides
 * what may be indexed, embedded or sent to a model.
 */
export interface Discovery {
  search: Unary<typeof SearchRequestSchema, SearchResponse>;
  getObject: Unary<typeof GetObjectRequestSchema, GetObjectResponse>;
  getRelated: Unary<typeof GetRelatedRequestSchema, GetRelatedResponse>;
  /** Proposes a description; nothing is stored until `saveDescription`. */
  describe: Unary<typeof DescribeRequestSchema, DescribeResponse>;
  saveDescription: Unary<typeof SaveDescriptionRequestSchema, SaveDescriptionResponse>;
  /** Marks an object certified or deprecated, or clears the mark. Records a person's decision. */
  setCertification: Unary<typeof SetCertificationRequestSchema, SetCertificationResponse>;
  /** Streams an answer: text deltas and citations, then one `done`. */
  ask(request: MessageInitShape<typeof AskRequestSchema>, options?: CallOptions): AsyncIterable<AskResponse>;
  listContextPacks: Unary<typeof ListContextPacksRequestSchema, ListContextPacksResponse>;
  getContextPack: Unary<typeof GetContextPackRequestSchema, GetContextPackResponse>;
  saveContextPack: Unary<typeof SaveContextPackRequestSchema, SaveContextPackResponse>;
  deleteContextPack: Unary<typeof DeleteContextPackRequestSchema, DeleteContextPackResponse>;
  /** Renders a saved or unsaved pack into exactly what an agent will receive. */
  renderContextPack: Unary<typeof RenderContextPackRequestSchema, RenderContextPackResponse>;
}
