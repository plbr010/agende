import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const scenes = [
  ["Cena01Acesso", 70],
  ["Cena02Servico", 40],
  ["Cena02Servico", 110],
  ["Cena03Horario", 30],
  ["Cena03Horario", 100],
  ["Cena04Reserva", 20],
  ["Cena04Reserva", 100],
  ["Cena05Painel", 30],
  ["Cena05Painel", 110],
  ["Cena06Agenda", 30],
  ["Cena06Agenda", 90],
  ["Cena07Equipe", 40],
  ["Cena08Estoque", 40],
  ["Cena09Financeiro", 40],
  ["Cena10Marca", 50],
  ["AgendeComercial", 200],
];

mkdirSync("out/stills", { recursive: true });

for (const [id, frame] of scenes) {
  const output = `out/stills/${id}-${frame}.png`;
  const result = spawnSync(
    "npx",
    ["remotion", "still", "src/index.ts", id, output, `--frame=${frame}`],
    { stdio: "inherit" },
  );
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
