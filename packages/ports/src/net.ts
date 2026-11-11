/**
 * Whether the device thinks it has a network. Only ever a hint — a request can
 * still fail while {@link online} is true — so it is used to name a failure
 * ("offline" rather than "server") and to retry when connectivity returns,
 * never to skip an attempt.
 */
export interface Net {
  online(): boolean

  /** Fires on every transition; returns an unsubscribe. */
  subscribe(listener: () => void): () => void
}
