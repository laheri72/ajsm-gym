// minify-js.js
const { glob } = require("glob"); // destructure glob
const { exec } = require("child_process");

glob("public/js/*.js", async (err, files) => {
  if (err) throw err;

  for (const file of files) {
    const minFile = file.replace(/\.js$/, ".min.js");
    await new Promise((resolve, reject) => {
      exec(`npx terser "${file}" -o "${minFile}" --compress --mangle`, (error, stdout, stderr) => {
        if (error) reject(error);
        else resolve(stdout);
      });
    });
    console.log(`Minified: ${file} → ${minFile}`);
  }
});
