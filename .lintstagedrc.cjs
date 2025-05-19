// ref1: https://github.com/okonet/lint-staged#Configuration
// ref2: https://biomejs.dev/recipes/git-hooks/#lint-staged

module.exports = {
  // Run Biome on staged files that have the following extensions: js, ts, jsx, tsx, json and jsonc
  "*.{js,ts,cjs,mjs,d.cts,d.mts,jsx,tsx,json,jsonc}": [
    // Format, sort imports, lints, apply safe/unsafe fixes
    "biome check --write --unsafe --no-errors-on-unmatched --files-ignore-unknown=true",
  ],
}
