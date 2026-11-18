import { readFileSync, writeFileSync } from "node:fs";

const read = (name) => readFileSync(new URL(name, import.meta.url));
const output = new URL("../../play/index.html", import.meta.url);
const atlas = read("asterra-atlas.png");
const frames = JSON.parse(read("asterra-atlas.json").toString("utf8"));
const width = atlas.readUInt32BE(16);
const height = atlas.readUInt32BE(20);

for (const [name, frame] of Object.entries(frames)) {
  const [x, y, w, h] = frame;
  if (
    frame.length !== 4 ||
    !frame.every(Number.isInteger) ||
    x < 0 ||
    y < 0 ||
    w < 1 ||
    h < 1 ||
    x + w > width ||
    y + h > height
  ) {
    throw new Error("Atlas frame is outside the sheet: " + name);
  }
}

const start = "      // Embedded atlas. Rebuilt from assets/art.";
const end = "      // End of embedded atlas.";
const game = readFileSync(output, "utf8");
const first = game.indexOf(start);
const last = game.indexOf(end);
if (first < 0 || last <= first)
  throw new Error("Missing inline atlas markers.");

const manifest = Object.entries(frames)
  .map(([name, frame]) => {
    const key = /^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name);
    return `        ${key}: [${frame.join(", ")}],`;
  })
  .join("\n");
const data = "data:image/png;base64," + atlas.toString("base64");
const embedded = `${start}
      const atlasFrames = {
${manifest}
      };
      const atlasData =
        "${data}";
`;
writeFileSync(output, game.slice(0, first) + embedded + game.slice(last));
