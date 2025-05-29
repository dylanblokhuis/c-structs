// 1) primitive descriptors, with size + how to read/write them:
const p = {
  float32: { size: 4, arrayType: Float32Array, getter: 'getFloat32', setter: 'setFloat32' },
  float64: { size: 4, arrayType: Float64Array, getter: 'getFloat64', setter: 'setFloat64' },
  uint16: { size: 2, arrayType: Uint16Array, getter: 'getUint16', setter: 'setUint16' },
  uint32: { size: 4, arrayType: Uint32Array, getter: 'getUint32', setter: 'setUint32' },
  uint64: { size: 8, arrayType: BigUint64Array, getter: 'getBigUint64', setter: 'setBigUint64' },
  int16: { size: 2, arrayType: Int16Array, getter: 'getInt16', setter: 'setInt16' },
  int32: { size: 4, arrayType: Int32Array, getter: 'getInt32', setter: 'setInt32' },
  int64: { size: 8, arrayType: BigInt64Array, getter: 'getBigInt64', setter: 'setBigInt64' },
}

// 2) constructor helpers:
const c = {
  float() { return p.float32 },
  float2() { return [p.float32, p.float32] },
  float3() { return [p.float32, p.float32, p.float32] },
  float4() { return [p.float32, p.float32, p.float32, p.float32] },

  uint() { return p.uint32 },
  uint2() { return [p.uint32, p.uint32] },
  uint3() { return [p.uint32, p.uint32, p.uint32] },
  uint4() { return [p.uint32, p.uint32, p.uint32, p.uint32] },

  array(structDesc, length) {
    if (typeof structDesc.size !== 'number' || typeof structDesc.create !== 'function') {
      throw new Error('c.array: first arg must be a struct descriptor');
    }
    if (!Number.isInteger(length) || length <= 0) {
      throw new Error('c.array: length must be a positive integer');
    }
    return {
      kind:     'array',
      elemDesc: structDesc,
      length,
      size:     structDesc.size * length
    };
  },

  struct(schema) {
    let offset = 0;
    const fields = {};

    // Walk each field, record its offset + metadata
    for (const [name, type] of Object.entries(schema)) {
      const fieldOffset = offset;
      let entry;

      if (Array.isArray(type)) {
        // vector of N primitives
        const elem = type[0];
        entry = { kind: 'vector', name, elem, length: type.length, offset: fieldOffset };
        console.log(entry)
        offset += elem.size * type.length;
      }
      else if (type.kind === 'array') {
        // array of nested structs
        entry = {
          kind:     'array',
          name,
          elemDesc: type.elemDesc,
          length:   type.length,
          offset:   fieldOffset
        };
        offset += type.size;
      }
      else if (type.arrayType) {
        // single primitive
        entry = { kind: 'scalar', name, desc: type, offset: fieldOffset };
        offset += type.size;
      }
      else if (type.size && typeof type.create === 'function') {
        // nested struct
        entry = { kind: 'struct', name, desc: type, offset: fieldOffset };
        offset += type.size;
      }
      else {
        throw new Error(`Unknown field type for "${name}"`);
      }

      fields[name] = entry;
    }

    const totalSize = offset;

    return {
      size: totalSize,

      /**
       * Create a new instance of this struct:
       * @param {ArrayBuffer} [buffer]  – if omitted, one is allocated for you
       * @param {number}      [baseOffset] – byte-offset inside that buffer
       */
      create(buffer = new ArrayBuffer(totalSize), baseOffset = 0) {
        const view = new DataView(buffer);
        const inst = {};

        for (const { kind, name, offset: fo, desc, elem, elemDesc, length } of Object.values(fields)) {
          const abs = baseOffset + fo;

          if (kind === 'scalar') {
            Object.defineProperty(inst, name, {
              get: () => view[desc.getter](abs, true),
              set: v => view[desc.setter](abs, v, true),
            });
          }
          else if (kind === 'vector') {
            // build a TypedArray slice once
            const Typed = elem.arrayType;
            const ta = new Typed(buffer, abs, length);
            Object.defineProperty(inst, name, {
              get: () => ta,
              set: arr => { for (let i = 0; i < length; i++) ta[i] = arr[i] },
            });
          }
          else if (kind === 'struct') {
            // recursively create nested struct
            inst[name] = desc.create(buffer, abs);
          }
          else if (kind === 'array') {
            // build an Array of nested struct instances
            const arr = new Array(length);
            for (let i = 0; i < length; i++) {
              arr[i] = elemDesc.create(buffer, abs + i * elemDesc.size);
            }
            inst[name] = arr;
          }
        }
        Object.defineProperty(inst, 'buffer', {
          get: () => buffer,
          enumerable: false,
        });
        return inst;
      }
    };
  }
};

// -----------------------------------------------------
// Example usage:

const Item = c.struct({
  position: c.float3(),
  normal: c.float3(),
  uv: c.float2(),
  materialIndex: c.uint(),
});

const Material = c.struct({
  // color: c.float4(),
  items: c.array(Item, 2), // array of 10 Items
});

const mat = Material.create();
// mat.color[0] = 0.8;
// mat.color[3] = 1.0;           // alpha
mat.items[0].position = [1.0, 2.0, 3.0];
mat.items[1].position = [1.0, 2.0, 3.0];
const item = Item.create()

console.log('Item', item.buffer);
console.log('Material', mat.buffer);
