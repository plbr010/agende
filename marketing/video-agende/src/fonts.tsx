import { continueRender, delayRender, staticFile } from "remotion";
import { useEffect, useState } from "react";

export function BrandFonts() {
  const [handle] = useState(() => delayRender("Fontes do Agendê"));

  useEffect(() => {
    const faces = [
      new FontFace("Inter", `url(${staticFile("fonts/Inter.ttf")})`),
      new FontFace("Playfair Display", `url(${staticFile("fonts/PlayfairDisplay.ttf")})`),
      new FontFace("Playfair Display", `url(${staticFile("fonts/PlayfairDisplay-Italic.ttf")})`, {
        style: "italic",
      }),
    ];

    let cancelled = false;
    Promise.all(
      faces.map((face) =>
        face.load().then((loaded) => {
          (document.fonts as FontFaceSet & { add(font: FontFace): void }).add(loaded);
        }),
      ),
    ).finally(() => {
      if (!cancelled) continueRender(handle);
    });

    return () => {
      cancelled = true;
    };
  }, [handle]);

  return null;
}
