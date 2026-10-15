export function avatarUploadMessage(status: number, code: string | null): string {
  if (status === 409 || code === "avatar_changed_retry") {
    return "A foto foi alterada em outro lugar. Atualize a página antes de tentar de novo.";
  }
  if (status === 413 || code === "image_size_invalid") {
    return "Essa foto é grande demais. Escolha uma de até 4 MB.";
  }
  if (status === 422 || code === "image_invalid") {
    return "Não foi possível usar essa imagem. Escolha uma foto JPG, PNG ou WebP.";
  }
  if (status === 401 || code === "auth_required") {
    return "Entre de novo para alterar a foto.";
  }
  return "Não foi possível salvar a foto agora. Tente de novo.";
}

export function avatarCacheVersion(path: string | null | undefined): string | null {
  if (!path) return null;
  let hash = 0;
  for (let index = 0; index < path.length; index += 1) {
    hash = (hash * 33 + path.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

export function coverScale(imageWidth: number, imageHeight: number, frame: number, zoom: number): number {
  if (imageWidth <= 0 || imageHeight <= 0 || frame <= 0) return 1;
  const safeZoom = Number.isFinite(zoom) ? Math.min(3, Math.max(1, zoom)) : 1;
  return Math.max(frame / imageWidth, frame / imageHeight) * safeZoom;
}

export function clampOffset(offset: number, imageSize: number, scale: number, frame: number): number {
  const displayed = imageSize * scale;
  const limit = Math.max(0, (displayed - frame) / 2);
  if (!Number.isFinite(offset)) return 0;
  return Math.min(limit, Math.max(-limit, offset));
}
