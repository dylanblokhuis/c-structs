// deno-lint-ignore-file no-explicit-any
type InferField<F> =
  // a primitive ⇒ number
  F extends PrimitiveDescriptor
  ? number
  : // a vector of primitives ⇒ the TypedArray instance
  F extends PrimitiveDescriptor[]
  ?
  | number[]
  | Float32Array
  | Int16Array
  | Int32Array
  | BigInt64Array
  | Uint16Array
  | Uint32Array
  | BigUint64Array
  | Float64Array
  : // any StructDescriptor<U> ⇒ U
  F extends StructDescriptor<infer U>
  ? U
  : never;

/** Given a whole schema object, produce a “shaped” type */
type InferSchema<S extends Record<string, any>> = {
  [K in keyof S]: InferField<S[K]>;
};

/**
 * Primitive descriptor defines size, TypedArray constructor, and DataView accessors.
 */
interface PrimitiveDescriptor {
  size: number;
  arrayType:
  | Float32ArrayConstructor
  | Int16ArrayConstructor
  | Int32ArrayConstructor
  | BigInt64ArrayConstructor
  | Uint16ArrayConstructor
  | Uint32ArrayConstructor
  | BigUint64ArrayConstructor
  | Float64ArrayConstructor;

  getter: keyof DataView;
  setter: keyof DataView;
}

/**
 * Union for possible field kinds in a struct.
 */
type FieldDescriptor =
  | { kind: "scalar"; name: string; desc: PrimitiveDescriptor; offset: number }
  | {
    kind: "vector";
    name: string;
    elem: PrimitiveDescriptor;
    length: number;
    offset: number;
  }
  | {
    kind: "struct";
    name: string;
    desc: StructDescriptor<any>;
    offset: number;
  }
  | {
    kind: "array";
    name: string;
    elemDesc: StructDescriptor<any>;
    length: number;
    offset: number;
  };

/**
 * Descriptor for a generated struct: knows its byte-size and has a create method.
 */
export interface StructDescriptor<T> {
  size: number;
  create(
    buffer?: ArrayBuffer,
    baseOffset?: number
  ): T & {
    buffer: ArrayBuffer;
  };
}

/**
 * Primitive descriptors map
 */
const p: Record<string, PrimitiveDescriptor> = {
  float32: {
    size: 4,
    arrayType: Float32Array,
    getter: "getFloat32",
    setter: "setFloat32",
  },
  float64: {
    size: 8,
    arrayType: Float64Array,
    getter: "getFloat64",
    setter: "setFloat64",
  },
  uint16: {
    size: 2,
    arrayType: Uint16Array,
    getter: "getUint16",
    setter: "setUint16",
  },
  uint32: {
    size: 4,
    arrayType: Uint32Array,
    getter: "getUint32",
    setter: "setUint32",
  },
  uint64: {
    size: 8,
    arrayType: BigUint64Array,
    getter: "getBigUint64",
    setter: "setBigUint64",
  },
  int16: {
    size: 2,
    arrayType: Int16Array,
    getter: "getInt16",
    setter: "setInt16",
  },
  int32: {
    size: 4,
    arrayType: Int32Array,
    getter: "getInt32",
    setter: "setInt32",
  },
  int64: {
    size: 8,
    arrayType: BigInt64Array,
    getter: "getBigInt64",
    setter: "setBigInt64",
  },
};

/**
 * Constructor helpers for vectors, arrays, and structs.
 */
export const c = {
  float(): PrimitiveDescriptor {
    return p.float32;
  },
  float2(): PrimitiveDescriptor[] {
    return [p.float32, p.float32];
  },
  float3(): PrimitiveDescriptor[] {
    return [p.float32, p.float32, p.float32];
  },
  float4(): PrimitiveDescriptor[] {
    return [p.float32, p.float32, p.float32, p.float32];
  },

  uint(): PrimitiveDescriptor {
    return p.uint32;
  },
  uint2(): PrimitiveDescriptor[] {
    return [p.uint32, p.uint32];
  },
  uint3(): PrimitiveDescriptor[] {
    return [p.uint32, p.uint32, p.uint32];
  },
  uint4(): PrimitiveDescriptor[] {
    return [p.uint32, p.uint32, p.uint32, p.uint32];
  },

  int(): PrimitiveDescriptor {
    return p.int32;
  },
  int2(): PrimitiveDescriptor[] {
    return [p.int32, p.int32];
  },
  int3(): PrimitiveDescriptor[] {
    return [p.int32, p.int32, p.int32];
  },
  int4(): PrimitiveDescriptor[] {
    return [p.int32, p.int32, p.int32, p.int32];
  },

  uint16(): PrimitiveDescriptor {
    return p.uint16;
  },

  uint64(): PrimitiveDescriptor {
    return p.uint64;
  },

  int16(): PrimitiveDescriptor {
    return p.int16;
  },

  int64(): PrimitiveDescriptor {
    return p.int64;
  },

  float64(): PrimitiveDescriptor {
    return p.float64;
  },

  matrix3(): PrimitiveDescriptor[] {
    return [
      p.float32,
      p.float32,
      p.float32,
      p.float32,
      p.float32,
      p.float32,
      p.float32,
      p.float32,
      p.float32,
    ];
  },

  matrix4(): PrimitiveDescriptor[] {
    return [
      p.float32,
      p.float32,
      p.float32,
      p.float32,
      p.float32,
      p.float32,
      p.float32,
      p.float32,
      p.float32,
      p.float32,
      p.float32,
      p.float32,
      p.float32,
      p.float32,
      p.float32,
      p.float32,
    ];
  },

  /**
   * Create an array descriptor for nested structs.
   */
  array<T>(
    structDesc: StructDescriptor<T>,
    length: number
  ): StructDescriptor<T[]> {
    if (
      typeof structDesc.size !== "number" ||
      typeof structDesc.create !== "function"
    ) {
      throw new Error("c.array: first arg must be a StructDescriptor");
    }
    if (!Number.isInteger(length) || length <= 0) {
      throw new Error("c.array: length must be a positive integer");
    }

    return {
      size: structDesc.size * length,
      create(
        buffer: ArrayBuffer = new ArrayBuffer(structDesc.size * length),
        baseOffset = 0
      ): T[] & {
        buffer: ArrayBuffer;
      } {
        const arr: T[] = new Array(length);
        for (let i = 0; i < length; i++) {
          arr[i] = structDesc.create(buffer, baseOffset + i * structDesc.size);
        }
        Object.defineProperty(arr, "buffer", {
          get: () => buffer,
          enumerable: false,
        });
        return arr as T[] & {
          buffer: ArrayBuffer;
        };
      },
    };
  },

  /**
   * Create a struct descriptor from a schema map.
   */
  struct<S extends Record<string, any>>(schema: S): StructDescriptor<InferSchema<S>> {
    // 1) Compute fields & totalSize exactly as you do today...
    let offset = 0;
    const fields: FieldDescriptor[] = [];
    for (const [name, type] of Object.entries<
      PrimitiveDescriptor | PrimitiveDescriptor[] | StructDescriptor<any>
    >(schema)) {
      const fieldOffset = offset;
      let entry: FieldDescriptor;

      if (Array.isArray(type)) {
        const elem = type[0];
        entry = {
          kind: "vector",
          name,
          elem,
          length: type.length,
          offset: fieldOffset,
        };
        offset += elem.size * type.length;
      } else if (
        (type as StructDescriptor<any>).size &&
        typeof (type as StructDescriptor<any>).create === "function" &&
        Array.isArray((type as StructDescriptor<any>).create())
      ) {
        // array of nested structs
        entry = {
          kind: "array",
          name,
          elemDesc: type as StructDescriptor<any>,
          length: (type as any).length,
          offset: fieldOffset,
        };
        offset += (type as StructDescriptor<any>).size * (type as any).length;
      } else if ((type as PrimitiveDescriptor).arrayType) {
        const elem = type as PrimitiveDescriptor;
        entry = {
          kind: "scalar",
          name,
          desc: elem,
          offset: fieldOffset,
        };
        offset += elem.size;
      } else if (
        (type as StructDescriptor<any>).size &&
        typeof (type as StructDescriptor<any>).create === "function"
      ) {
        // nested struct
        entry = {
          kind: "struct",
          name,
          desc: type as StructDescriptor<any>,
          offset: fieldOffset,
        };
        offset += (type as StructDescriptor<any>).size;
      } else {
        throw new Error(`Unknown field type for "${name}"`);
      }

      fields.push(entry);
    }
    const totalSize = offset;

    // 2) Build a constructor whose prototype we’ll decorate
    class Ctor {
      public buffer: ArrayBuffer;
      public baseOffset: number;
      private __view: DataView;
      constructor(
        buffer: ArrayBuffer = new ArrayBuffer(totalSize),
        baseOffset: number = 0,
      ) {
        this.buffer = buffer;
        this.baseOffset = baseOffset;
        this.__view = new DataView(buffer);

        // For nested structs & arrays, set up instances once per object:
        for (const f of fields) {
          if (f.kind === "struct") {
            (this as any)[f.name] = f.desc.create(buffer, baseOffset + f.offset);
          } else if (f.kind === "array") {
            (this as any)[f.name] = c.array(f.elemDesc, f.length).create(buffer, baseOffset + f.offset);
          }
        }

        // // 3) Apply any initial data
        // for (const k of Object.keys(initial)) {
        //   (this as any)[k] = (initial as any)[k];
        // }
      }
    }

    // 4) Define getters/setters *once* on the prototype
    for (const f of fields) {
      const abs = f.offset;
      switch (f.kind) {
        case "scalar":
          Object.defineProperty(Ctor.prototype, f.name, {
            enumerable: true,
            get(this: any) {
              return (this.__view[f.desc.getter] as any)(
                this.baseOffset + abs,
                true
              );
            },
            set(this: any, v: any) {
              return (this.__view[f.desc.setter] as any)(
                this.baseOffset + abs,
                v,
                true
              );
            },
          });
          break;

        case "vector": {
          // we can allocate one TypedArray per-instance in ctor,
          // but reuse the same getter/setter logic here:
          const Typed = f.elem.arrayType;
          Object.defineProperty(Ctor.prototype, f.name, {
            enumerable: true,
            get(this: any) {
              // lazily create and cache it on first access:
              if (!this.hasOwnProperty("__" + f.name)) {
                Object.defineProperty(this, "__" + f.name, {
                  value: new Typed(
                    this.buffer,
                    this.baseOffset + abs,
                    f.length
                  ),
                  writable: false,
                  enumerable: false,
                });
              }
              return this["__" + f.name];
            },
            set(this: any, arr: any[]) {
              const ta: any = (this as any)[f.name]; // triggers getter
              for (let i = 0; i < f.length; i++) ta[i] = arr[i];
            },
          });
          break;
        }
      }
    }

    // 5) Finally return the descriptor
    return {
      size: totalSize,
      create(buffer?: ArrayBuffer, baseOffset?: number) {
        return new (Ctor as any)(buffer, baseOffset);
      },
    };
  },
};
