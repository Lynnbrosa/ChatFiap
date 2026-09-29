/** Imagem escolhida na câmera/galeria, pronta para ser enviada à API. */
export type PickedImage = {
  /** URI local, usada só para pré-visualização na tela. */
  uri: string;
  /** Conteúdo em Base64 — trafega apenas até a API, nunca é gravado nos bancos. */
  base64: string;
  mimeType: string;
};
