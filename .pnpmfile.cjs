// Allow all install scripts (needed for esbuild native binaries)
function readPackage(pkg) {
  return pkg;
}

module.exports = { hooks: { readPackage } };
