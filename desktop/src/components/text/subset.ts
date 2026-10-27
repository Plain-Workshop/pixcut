// Browser font subsetting through the HarfBuzz hb-subset WASM build.
// The low-level glue follows the MIT-licensed `subset-font` package, adapted to
// fetch the WASM asset instead of reading it from Node's filesystem.
import subsetWasmUrl from 'harfbuzzjs/dist/harfbuzz-subset.wasm?url';

type HarfBuzzSubset = {
  memory: WebAssembly.Memory;
  malloc(size: number): number;
  free(pointer: number): void;
  _initialize(): void;
  hb_subset_input_create_or_fail(): number;
  hb_subset_input_destroy(input: number): void;
  hb_subset_input_set(input: number, set: number): number;
  hb_subset_input_unicode_set(input: number): number;
  hb_subset_input_get_flags(input: number): number;
  hb_subset_input_set_flags(input: number, flags: number): void;
  hb_set_clear(set: number): void;
  hb_set_invert(set: number): void;
  hb_set_add(set: number, codepoint: number): void;
  hb_blob_create(data: number, length: number, mode: number, userData: number, destroy: number): number;
  hb_blob_destroy(blob: number): void;
  hb_face_create(blob: number, index: number): number;
  hb_face_destroy(face: number): void;
  hb_face_reference_blob(face: number): number;
  hb_blob_get_data(blob: number, lengthPointer: number): number;
  hb_blob_get_length(blob: number): number;
  hb_subset_or_fail(face: number, input: number): number;
};

const HB_MEMORY_MODE_WRITABLE = 2;
const HB_SUBSET_SETS_LAYOUT_FEATURE_TAG = 6;
const HB_SUBSET_FLAGS_NO_HINTING = 0x00000001;

let wasmPromise: Promise<HarfBuzzSubset> | null = null;
let queue: Promise<unknown> = Promise.resolve();

function loadHarfBuzz(): Promise<HarfBuzzSubset> {
  wasmPromise ??= (async () => {
    const response = await fetch(subsetWasmUrl);
    if (!response.ok) throw new Error('The font subsetter could not be loaded.');
    const { instance } = await WebAssembly.instantiate(await response.arrayBuffer(), {});
    const exports = instance.exports as unknown as HarfBuzzSubset;
    exports._initialize();
    return exports;
  })().catch(error => {
    wasmPromise = null;
    throw error;
  });
  return wasmPromise;
}

function serialised<T>(run: () => Promise<T>): Promise<T> {
  const next = queue.then(run, run);
  queue = next.catch(() => {});
  return next;
}

/** Subsets an SFNT (TTF or OTF) font to the given characters. */
export function subsetFontBytes(bytes: Uint8Array, text: string): Promise<Uint8Array> {
  return serialised(async () => {
    if (!bytes.length) throw new Error('That font file is empty.');
    const wasm = await loadHarfBuzz();
    const heap = () => new Uint8Array(wasm.memory.buffer);
    const input = wasm.hb_subset_input_create_or_fail();
    if (!input) throw new Error('The font subsetter could not start.');
    const pointer = wasm.malloc(bytes.byteLength);
    if (!pointer) {
      wasm.hb_subset_input_destroy(input);
      throw new Error('Not enough memory to subset this font.');
    }
    heap().set(bytes, pointer);
    const blob = wasm.hb_blob_create(pointer, bytes.byteLength, HB_MEMORY_MODE_WRITABLE, 0, 0);
    const face = wasm.hb_face_create(blob, 0);
    wasm.hb_blob_destroy(blob);
    try {
      const layoutFeatures = wasm.hb_subset_input_set(input, HB_SUBSET_SETS_LAYOUT_FEATURE_TAG);
      wasm.hb_set_clear(layoutFeatures);
      wasm.hb_set_invert(layoutFeatures);
      wasm.hb_subset_input_set_flags(input, wasm.hb_subset_input_get_flags(input) | HB_SUBSET_FLAGS_NO_HINTING);
      const unicodes = wasm.hb_subset_input_unicode_set(input);
      for (const character of new Set(text)) {
        const codePoint = character.codePointAt(0);
        if (codePoint !== undefined) wasm.hb_set_add(unicodes, codePoint);
      }
      const subset = wasm.hb_subset_or_fail(face, input);
      if (!subset) throw new Error('This font could not be subset. Try another TTF or OTF file.');
      const result = wasm.hb_face_reference_blob(subset);
      const offset = wasm.hb_blob_get_data(result, 0);
      const length = wasm.hb_blob_get_length(result);
      const output = heap().slice(offset, offset + length);
      wasm.hb_blob_destroy(result);
      wasm.hb_face_destroy(subset);
      if (!output.length) throw new Error('The subset font came back empty. Try another font.');
      return output;
    } finally {
      wasm.hb_face_destroy(face);
      wasm.hb_subset_input_destroy(input);
      wasm.free(pointer);
    }
  });
}
