export interface HttpErrorParser {
  fromResponse(status: number, statusText: string, body: unknown, url: string): Error;
  fromTransportError(error: unknown): Error;
}
