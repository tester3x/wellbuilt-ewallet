// Simple module-level state for passing captured image URI from camera back to add-document
let _capturedUri: string | null = null;

export function setCapturedImageUri(uri: string | null) {
  _capturedUri = uri;
}

export function getCapturedImageUri(): string | null {
  const u = _capturedUri;
  _capturedUri = null; // consume once
  return u;
}
