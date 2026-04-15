const { z } = require("zod");
const schema = z.object({
  name: z.string().nullable(),
  items: z.array(z.object({ id: z.number().nullable() }))
});
console.log(JSON.stringify(z.toJSONSchema(schema, {
  target: "openapi-3.0"
}), null, 2));