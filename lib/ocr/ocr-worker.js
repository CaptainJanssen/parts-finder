/* Parts Finder: reads the text in a picture of a data plate, in the background so the app stays smooth.
   Tesseract OCR (tesseract.js-core 7.0.0, Apache License 2.0) with the English model eng.traineddata from
   tessdata_fast (Apache License 2.0). Everything runs on this device; no picture leaves it. */
let M = null, api = null, ready = null;
const simd = (() => {
  try { return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])); }
  catch (_) { return false; }
})();
function start() {
  if (!ready) {
    ready = (async () => {
      const name = simd ? "tesseract-core-simd-lstm" : "tesseract-core-lstm";
      importScripts(name + ".js");
      M = await self.TesseractCore({ locateFile: (p) => (p.endsWith(".wasm") ? name + ".wasm" : p) });
      const r = await fetch("eng.traineddata");
      if (!r.ok) throw new Error("model " + r.status);
      M.FS.writeFile("./eng.traineddata", new Uint8Array(await r.arrayBuffer()));
      api = new M.TessBaseAPI();
      if (api.Init(null, "eng", 1) !== 0) throw new Error("init failed");
    })();
    ready.catch(() => { ready = null; });
  }
  return ready;
}
self.onmessage = async (ev) => {
  const { id, cmd, image, psm } = ev.data || {};
  try {
    await start();
    if (cmd === "init") { self.postMessage({ id, ok: true }); return; }
    M.FS.writeFile("/input", new Uint8Array(image));
    api.SetVariable("tessedit_pageseg_mode", String(psm || 11));
    api.SetImageFile(1, 0);
    api.Recognize(null);
    self.postMessage({ id, ok: true, text: api.GetUTF8Text() || "" });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
  }
};
