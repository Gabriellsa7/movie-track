export interface ISecureToken {
  token: string;
  hash: string;
}

// One-time tokens sent by e-mail: only the hash is stored, so a database leak cannot use them.
export interface ISecureTokenProvider {
  generate(): ISecureToken;
  hash(token: string): string;
}
