declare module "busboy" {
  import type { IncomingHttpHeaders } from "node:http";
  import type { Readable, Writable } from "node:stream";

  interface BusboyConfig {
    headers: IncomingHttpHeaders;
    limits?: {
      fileSize?: number;
      files?: number;
      fields?: number;
    };
  }

  interface FileInfo {
    filename: string;
    encoding: string;
    mimeType: string;
  }

  interface FileStream extends Readable {
    truncated: boolean;
  }

  interface BusboyParser extends Writable {
    on(event: "field", listener: (name: string, value: string) => void): this;
    on(event: "file", listener: (name: string, stream: FileStream, info: FileInfo) => void): this;
    on(event: "error", listener: (error: Error) => void): this;
    on(event: "finish", listener: () => void): this;
  }

  function Busboy(config: BusboyConfig): BusboyParser;
  export default Busboy;
}
