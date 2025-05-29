import { c } from "./index.ts";

Deno.test("simple", () => {
  const Item = c.struct({
    color: c.float3(),
  });

  const item = Item.create();
  item.color = [1, 0, 0];

  console.log(item.buffer);
  if (item.buffer.byteLength !== 12) {
    throw new Error("Buffer size is not as expected");
  }
});

Deno.test("array", () => {
  const Item = c.struct({
    color: c.float3(),
  });

  const ItemArray = c.array(Item, 3);

  const items = ItemArray.create();
  items[0].color = [1, 0, 0];
  items[1].color = [0, 1, 0];
  items[2].color = [0, 0, 1];

  if (items.buffer.byteLength !== 36) {
    throw new Error("Buffer size for array is not as expected");
  }
});

Deno.test("nested struct", () => {
  const Color = c.struct({
    r: c.float(),
    g: c.float(),
    b: c.float(),
  });

  const Item = c.struct({
    color: Color,
  });

  const item = Item.create();
  item.color.r = 1;
  item.color.g = 0;
  item.color.b = 0;

  if (item.buffer.byteLength !== 12) {
    throw new Error("Buffer size for nested struct is not as expected");
  }
});
