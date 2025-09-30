// minify-js.js
const { minify } = require("terser");
const fs = require("fs");
const path = require("path");
const glob = require("glob");

// Find all JS files in public/js
glob("public/js/*.js", (err, files) => {
  if (err) throw err;

  files.forEach(async (file) => {
    if (file.endsWith(".min.js")) return; // skip already minified
    const code = fs.readFileSync(file, "utf8");
    const result = await minify(code, { compress: true, mangle: true });
    const outFile = file.replace(/\.js$/, ".min.js");
    fs.writeFileSync(outFile, result.code, "utf8");
    console.log(`Minified: ${outFile}`);
  });
});
