import { readFileSync, writeFileSync } from "node:fs";

const read = (name) => readFileSync(new URL(name, import.meta.url));
const output = new URL("../../play/index.html", import.meta.url);
function dimensions(image) {
  if (image.toString("ascii", 0, 4) !== "RIFF")
    throw new Error("Expected a WebP atlas.");
  const chunk = image.toString("ascii", 8, 16);
  if (chunk === "WEBPVP8L" && image.length >= 25 && image[20] === 0x2f) {
    const size = image.readUInt32LE(21);
    return [(size & 0x3fff) + 1, ((size >>> 14) & 0x3fff) + 1];
  }
  if (chunk === "WEBPVP8X" && image.length >= 30)
    return [image.readUIntLE(24, 3) + 1, image.readUIntLE(27, 3) + 1];
  throw new Error("Unsupported WebP atlas header.");
}

function readAtlas(filename, baseFrames) {
  const image = read(filename + ".webp");
  const frames = JSON.parse(read(filename + ".json").toString("utf8"));
  const [width, height] = dimensions(image);
  for (const [name, frame] of Object.entries(frames)) {
    const [x, y, w, h, dx, dy] = frame;
    const base = baseFrames?.[name];
    if (
      frame.length !== (baseFrames ? 6 : 4) ||
      !frame.every(Number.isInteger) ||
      x < 0 ||
      y < 0 ||
      w < 1 ||
      h < 1 ||
      x + w > width ||
      y + h > height ||
      (baseFrames &&
        (!base ||
          dx < 0 ||
          dy < 0 ||
          dx + w > base[2] * 2 ||
          dy + h > base[3] * 2))
    )
      throw new Error("Invalid atlas frame: " + filename + "/" + name);
  }
  if (
    baseFrames &&
    Object.keys(frames).length !== Object.keys(baseFrames).length
  )
    throw new Error("Detail artwork must cover every standard atlas frame.");
  return { frames, image };
}

function declarations(name, { frames, image }) {
  const manifest = Object.entries(frames)
    .map(([key, frame]) => {
      const label = /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
      return `        ${label}: [${frame.join(", ")}],`;
    })
    .join("\n");
  const data = "data:image/webp;base64," + image.toString("base64");
  return `      const ${name}Frames = {
${manifest}
      };
      const ${name}Data =
        "${data}";
`;
}

const start = "      // Embedded atlas. Rebuilt from assets/art.";
const end = "      // End of embedded atlas.";
const game = readFileSync(output, "utf8");
const first = game.indexOf(start);
const last = game.indexOf(end);
if (first < 0 || last <= first)
  throw new Error("Missing inline atlas markers.");

const atlas = readAtlas("asterra-atlas");
const detail = readAtlas("asterra-detail", atlas.frames);
const embedded =
  start +
  "\n" +
  declarations("atlas", atlas) +
  declarations("detailAtlas", detail);
writeFileSync(output, game.slice(0, first) + embedded + game.slice(last));
